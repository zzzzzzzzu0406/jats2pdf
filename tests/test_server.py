"""Web 上传边界的轻量回归测试（不依赖 TestClient/httpx）。"""

import asyncio
import concurrent.futures
import io
import json
import zipfile

import pytest
from fastapi import HTTPException, UploadFile

from src import server
from src.parser.jats_parser import (
    Article,
    Figure,
    Paragraph,
    Run,
    Section,
    Table,
    TableCell,
)
from src.store import ArticleStore


MINIMAL_XML = b"""<article><front><article-meta><title-group>
<article-title>Upload Test</article-title>
</title-group></article-meta></front><body/></article>"""


def test_render_settings_normalize_font_options():
    settings = server._get_settings(
        "gbt7714", True, font_style="modern", font_size="large"
    )
    assert settings == {
        "ref_style": "gbt7714",
        "two_column": True,
        "font_style": "modern",
        "font_size": "large",
    }
    fallback = server._get_settings(font_style="unsafe class", font_size="99px")
    assert fallback["font_style"] == "academic"
    assert fallback["font_size"] == "medium"


def test_upload_accepts_uppercase_extension_and_records_size(tmp_path, monkeypatch):
    store = ArticleStore(
        db_path=str(tmp_path / "articles.db"),
        data_dir=str(tmp_path / "articles"),
    )
    store.init_db()
    monkeypatch.setattr(server, "store", store)

    upload = UploadFile(filename="paper.XML", file=io.BytesIO(MINIMAL_XML))
    response = asyncio.run(server.api_upload(upload))
    payload = json.loads(response.body)
    meta = store.get_meta(payload["article_id"])

    assert payload["title"] == "Upload Test"
    assert meta["file_size"] == len(MINIMAL_XML)


def test_upload_rejects_oversized_xml(monkeypatch):
    monkeypatch.setattr(server, "_MAX_UPLOAD_BYTES", 100)
    upload = UploadFile(filename="paper.xml", file=io.BytesIO(b"x" * 101))

    with pytest.raises(HTTPException) as exc:
        asyncio.run(server.api_upload(upload))
    assert exc.value.status_code == 413


def test_extract_pmc_asset_map_only_accepts_trusted_cdn():
    page = """
    <img src="https://cdn.ncbi.nlm.nih.gov/pmc/blobs/a/1/b/figure.jpg">
    <img src="https://example.com/evil.jpg">
    """
    assets = server._extract_pmc_asset_map(page)
    assert assets == {
        "figure.jpg": "https://cdn.ncbi.nlm.nih.gov/pmc/blobs/a/1/b/figure.jpg"
    }


def test_pmc_asset_resolution_is_single_flight(monkeypatch):
    server._pmc_asset_cache.clear()
    calls = 0

    def fake_fetch(url, max_bytes, timeout=15):
        nonlocal calls
        calls += 1
        return b'<img src="https://cdn.ncbi.nlm.nih.gov/pmc/blobs/a/1/b/remote.jpg">'

    monkeypatch.setattr(server, "_fetch_remote_bytes", fake_fetch)
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        results = list(
            pool.map(
                lambda _: server._resolve_pmc_image_url("PMC123", "remote.jpg"),
                range(5),
            )
        )
    assert calls == 1
    assert all(result.endswith("/remote.jpg") for result in results)


def test_empty_pmc_page_is_not_cached(monkeypatch):
    server._pmc_asset_cache.clear()
    calls = 0

    def empty_fetch(*args, **kwargs):
        nonlocal calls
        calls += 1
        return b"<html/>"

    monkeypatch.setattr(server, "_fetch_remote_bytes", empty_fetch)
    monkeypatch.setattr(server.time, "sleep", lambda _: None)
    assert server._resolve_pmc_image_url("PMC123", "missing.jpg") == ""
    assert calls == 3
    assert "PMC123" not in server._pmc_asset_cache


def test_missing_local_image_is_served_from_pmc_cache(tmp_path, monkeypatch):
    cached = tmp_path / "remote.jpg"
    cached.write_bytes(b"\xff\xd8\xfftest")
    monkeypatch.setattr(server, "_cache_pmc_image", lambda pmcid, name: str(cached))
    response = asyncio.run(
        server.api_serve_file("remote.jpg", article_id="", pmcid="PMC123")
    )
    assert response.status_code == 200
    assert response.path == str(cached)


def test_zip_bundle_upload_stores_article_images(tmp_path, monkeypatch):
    store = ArticleStore(
        db_path=str(tmp_path / "articles.db"),
        data_dir=str(tmp_path / "articles"),
    )
    store.init_db()
    monkeypatch.setattr(server, "store", store)
    monkeypatch.setattr(server, "_ARTICLE_ASSET_DIR", str(tmp_path / "assets"))

    xml = b"""<article xmlns:xlink="http://www.w3.org/1999/xlink">
    <front><article-meta><title-group><article-title>Bundle</article-title></title-group></article-meta></front>
    <body><sec><title>Section</title><fig id="f1"><caption><p>Figure</p></caption>
    <graphic xlink:href="images/figure.jpg"/></fig></sec></body></article>"""
    bundle = io.BytesIO()
    with zipfile.ZipFile(bundle, "w") as archive:
        archive.writestr("paper/article.xml", xml)
        archive.writestr("paper/images/figure.jpg", b"\xff\xd8\xfftest-image")

    upload = UploadFile(filename="paper.zip", file=io.BytesIO(bundle.getvalue()))
    response = asyncio.run(server.api_upload(upload))
    payload = json.loads(response.body)
    assert payload["asset_count"] == 1

    image_response = asyncio.run(
        server.api_serve_file("figure.jpg", article_id=payload["article_id"])
    )
    assert image_response.status_code == 200
    assert image_response.path.endswith("figure.jpg")


def test_pdf_images_are_embedded_and_downscaled(tmp_path, monkeypatch):
    article_id = "abc12345"
    asset_dir = tmp_path / article_id
    asset_dir.mkdir(parents=True)
    image_path = asset_dir / "figure.png"

    from PIL import Image

    Image.new("RGB", (3000, 1200), "white").save(image_path)
    figure = Figure(id="f1", caption="Figure", graphic_href="figure.png", number=1)
    section = Section(title="Results", figures=[figure])
    article = Article(title="Image article", sections=[section])

    monkeypatch.setattr(server, "_ARTICLE_ASSET_DIR", str(tmp_path))
    embedded = server._embed_article_images(article, article_id)

    assert embedded == 1
    assert figure.graphic_href.startswith("data:image/jpeg;base64,")

    payload = figure.graphic_href.split(",", 1)[1]
    decoded = io.BytesIO(__import__("base64").b64decode(payload))
    with Image.open(decoded) as optimized:
        assert max(optimized.size) == server._MAX_PDF_IMAGE_EDGE


def test_editor_payload_preserves_real_sections_and_images():
    paragraph = Paragraph(runs=[Run(kind="text", text="Real backend paragraph")])
    figure = Figure(id="f1", caption="Real figure", graphic_href="figure.jpg", number=1)
    table = Table(
        id="t1",
        caption="Structured table",
        number=1,
        header_rows=[[
            TableCell(text="Group", rowspan=2, is_header=True),
            TableCell(text="Metrics", colspan=2, is_header=True),
        ]],
        body_rows=[[
            TableCell(text="A", is_header=True),
            TableCell(text="10", align="right"),
            TableCell(text="20", align="char"),
        ]],
        footnotes=["Table note"],
    )
    section = Section(title="Introduction", paragraphs=[paragraph], figures=[figure], tables=[table])
    article = Article(
        title="Real article",
        journal="Test Journal",
        lang="en",
        sections=[section],
    )

    payload = server._article_editor_payload(article, "abc12345")

    assert payload["paper"]["title"]["en"] == "Real article"
    assert payload["paper"]["sections"][0]["content"]["en"] == "Real backend paragraph"
    assert payload["paper"]["figures"][0]["src"].startswith(
        "/api/files/figure.jpg?article_id=abc12345"
    )
    assert payload["paper"]["figures"][0]["sectionId"] == "section-1"
    assert payload["paper"]["figures"][0]["order"] == 1
    editor_table = payload["paper"]["tables"][0]
    assert editor_table["sectionId"] == "section-1"
    assert editor_table["order"] == 2
    assert editor_table["headerRows"][0][0]["rowspan"] == 2
    assert editor_table["headerRows"][0][1]["colspan"] == 2
    assert editor_table["bodyRows"][0][0]["isHeader"] is True
    assert editor_table["bodyRows"][0][1]["align"] == "right"
    assert editor_table["footnotes"] == ["Table note"]


def test_backend_preview_and_pdf_use_identical_document(tmp_path, monkeypatch):
    store = ArticleStore(
        db_path=str(tmp_path / "articles.db"),
        data_dir=str(tmp_path / "articles"),
    )
    store.init_db()
    article_id = store.add_article(Article(title="Same layout", lang="en"))
    monkeypatch.setattr(server, "store", store)
    monkeypatch.setattr(server, "_render_formulas", lambda _: None)

    captured = {}

    def fake_render(self, html_content, base_url=None):
        captured["html"] = html_content
        return b"%PDF-1.4\n%%EOF"

    from src.renderer.pdf_renderer import PDFRenderer

    monkeypatch.setattr(PDFRenderer, "render_to_bytes", fake_render)
    preview = asyncio.run(
        server.api_preview(
            article_id,
            ref_style="gbt7714",
            two_column=True,
            font_size="large",
            font_style="modern",
        )
    )
    asyncio.run(
        server.api_download_pdf(
            article_id,
            ref_style="gbt7714",
            two_column=True,
            font_style="modern",
            font_size="large",
        )
    )

    assert captured["html"] == preview.body.decode("utf-8")
    assert "font-size: 15px" in captured["html"]
    assert 'class="font-style-modern two-column"' in captured["html"]
    assert '<div class="article-front">' in captured["html"]
    assert '<main class="article-main">' in captured["html"]
    assert "column-gap: 7.5mm" in captured["html"]
    assert "margin: 18mm 19mm 18mm" in captured["html"]
    assert "column-span: all" not in captured["html"]


def test_pdf_renderer_can_skip_legacy_external_stylesheet():
    from src.renderer.pdf_renderer import PDFRenderer

    assert PDFRenderer(css_path="").css_path == ""
    assert PDFRenderer().css_path.endswith("templates/styles.css")
