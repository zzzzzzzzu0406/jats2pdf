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
    Reference,
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
        "page_size": "a4",
    }
    letter = server._get_settings(page_size="letter")
    assert letter["page_size"] == "letter"
    fallback = server._get_settings(font_style="unsafe class", font_size="99px", page_size="legal")
    assert fallback["font_style"] == "academic"
    assert fallback["font_size"] == "medium"
    assert fallback["page_size"] == "a4"


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


def test_article_id_and_image_paths_are_contained(tmp_path, monkeypatch):
    with pytest.raises(HTTPException) as exc:
        server._load_article("../../etc/passwd")
    assert exc.value.status_code == 400

    asset_dir = tmp_path / "assets"
    asset_dir.mkdir()
    outside = tmp_path / "outside.jpg"
    outside.write_bytes(b"not served")
    monkeypatch.setattr(server, "_IMAGE_SEARCH_DIRS", [str(asset_dir)])
    article = Article(title="Path test")
    assert server._find_article_image(article, "abc12345", "../outside.jpg") == ""

    with pytest.raises(HTTPException) as exc:
        asyncio.run(server.api_serve_file("figure.jpg", article_id="../../etc/passwd"))
    assert exc.value.status_code == 400


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


def test_encoded_image_reference_resolves_to_decoded_filename(tmp_path, monkeypatch):
    asset_dir = tmp_path / "assets"
    asset_dir.mkdir()
    image_path = asset_dir / "figure one.jpg"
    image_path.write_bytes(b"\xff\xd8\xffencoded-name")
    monkeypatch.setattr(server, "_ARTICLE_ASSET_DIR", str(tmp_path))
    monkeypatch.setattr(server, "_IMAGE_SEARCH_DIRS", [str(asset_dir)])

    figure = Figure(id="f1", caption="Encoded figure", graphic_href="images/figure%20one.jpg", number=1)
    article = Article(title="Encoded article", sections=[Section(title="Results", figures=[figure])])

    payload = server._article_editor_payload(article, "abc12345")
    assert "/api/files/figure%20one.jpg" in payload["paper"]["figures"][0]["src"]
    assert "%2520" not in payload["paper"]["figures"][0]["src"]
    assert server._find_article_image(article, "abc12345", figure.graphic_href) == str(image_path)


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
            page_size="letter",
        )
    )
    asyncio.run(
        server.api_download_pdf(
            article_id,
            ref_style="gbt7714",
            two_column=True,
            font_style="modern",
            font_size="large",
            page_size="letter",
        )
    )

    assert captured["html"] == preview.body.decode("utf-8")
    assert "font-size: 15px" in captured["html"]
    assert 'class="font-style-modern two-column"' in captured["html"]
    assert '<div class="article-front">' in captured["html"]
    assert '<main class="article-main">' in captured["html"]
    assert "column-gap: 7.5mm" in captured["html"]
    assert "width: 216mm" in captured["html"]
    assert "min-height: 279mm" in captured["html"]
    assert "size: Letter" in captured["html"]
    assert "margin: 18mm 19mm 18mm" in captured["html"]
    assert "column-span: all" not in captured["html"]


def test_pdf_renderer_can_skip_legacy_external_stylesheet():
    from src.renderer.pdf_renderer import PDFRenderer

    assert PDFRenderer(css_path="").css_path == ""
    assert PDFRenderer().css_path.endswith("templates/styles.css")


def test_formula_markup_removes_scripts_and_external_links():
    from src.renderer.formula_renderer import sanitize_formula_markup

    dirty = (
        '<svg onload="alert(1)" viewBox="0 0 10 10">'
        '<script>alert(2)</script><use href="https://evil.example/x.svg"/>'
        '<path d="M0 0"/></svg>'
    )
    clean = sanitize_formula_markup(dirty)

    assert "script" not in clean.lower()
    assert "onload" not in clean.lower()
    assert "evil.example" not in clean
    assert '<path d="M0 0"' in clean


def test_pdf_renderer_bytes_falls_back_when_weasyprint_fails(monkeypatch, tmp_path):
    import src.renderer.pdf_renderer as pdf_renderer

    class BrokenHTML:
        def __init__(self, **kwargs):
            pass

        def render(self, **kwargs):
            raise RuntimeError("simulated WeasyPrint failure")

    def fake_chrome(html_content, output_path, css_path=None, base_url=None):
        with open(output_path, "wb") as output:
            output.write(b"fallback-pdf")
        return output_path

    monkeypatch.setattr(pdf_renderer, "_HAS_WEASYPRINT", True)
    monkeypatch.setattr(pdf_renderer, "HTML", BrokenHTML)
    monkeypatch.setattr(pdf_renderer, "_chrome_render_to_file", fake_chrome)

    result = pdf_renderer.PDFRenderer(css_path="").render_to_bytes("<html/>", str(tmp_path))
    assert result == b"fallback-pdf"


def test_editor_save_is_read_back_and_used_by_all_render_exports(tmp_path, monkeypatch):
    store = ArticleStore(
        db_path=str(tmp_path / "articles.db"),
        data_dir=str(tmp_path / "articles"),
    )
    store.init_db()
    figure = Figure(id="f1", caption="Old figure", graphic_href="old.png", number=1)
    table = Table(
        id="t1",
        caption="Old table",
        number=1,
        headers=["Old heading"],
        rows=[["Old value"]],
    )
    section = Section(
        title="Old section",
        paragraphs=[Paragraph(runs=[Run(kind="text", text="Old paragraph")])],
        figures=[figure],
        tables=[table],
    )
    article_id = store.add_article(
        Article(
            title="Old title",
            lang="en",
            sections=[section],
            references=[Reference(title="Old reference", number=1)],
        )
    )
    monkeypatch.setattr(server, "store", store)
    monkeypatch.setattr(server, "_render_formulas", lambda _: None)

    edited_paper = {
        "title": {"en": "Edited title", "zh": "编辑后的标题"},
        "abstract": {"en": "Edited abstract", "zh": "编辑后的摘要"},
        "sections": [{
            "id": "section-1",
            "title": {"en": "Edited section", "zh": "编辑后的章节"},
            "content": {"en": "Edited paragraph", "zh": "编辑后的段落"},
        }],
        "figures": [{
            "id": "f1",
            "number": 1,
            "caption": {"en": "Edited figure", "zh": "编辑后的图片"},
            "sectionId": "section-1",
            "src": "figure.png",
        }],
        "tables": [{
            "id": "t1",
            "number": 1,
            "caption": {"en": "Edited table", "zh": "编辑后的表格"},
            "sectionId": "section-1",
            "headerRows": [[{"text": "Edited heading", "isHeader": True}]],
            "bodyRows": [[{"text": "Edited value", "align": "right"}]],
            "footnotes": ["Edited note"],
        }],
        "references": ["Edited reference"],
    }

    # Exercise the same {paper: ...} request body that the React editor sends.
    saved = asyncio.run(server.api_update_editor_article(article_id, {"paper": edited_paper}))
    assert saved.status_code == 200

    editor = asyncio.run(server.api_get_editor_article(article_id))
    editor_payload = json.loads(editor.body)
    assert editor_payload["paper"]["title"]["en"] == "Edited title"
    assert editor_payload["paper"]["sections"][0]["content"]["en"] == "Edited paragraph"

    effective = server._load_effective_article(article_id)
    assert effective.title == "Edited title"
    assert effective.sections[0].title == "Edited section"
    assert effective.sections[0].paragraphs[0].runs[0].text == "Edited paragraph"
    assert effective.sections[0].figures[0].caption == "Edited figure"
    assert effective.sections[0].tables[0].header_rows[0][0].text == "Edited heading"
    assert effective.references[0].title == "Edited reference"

    preview = asyncio.run(server.api_preview(article_id, two_column=True, font_style="international"))
    assert "Edited title" in preview.body.decode("utf-8")
    assert "Edited paragraph" in preview.body.decode("utf-8")
    assert "Edited heading" in preview.body.decode("utf-8")
    html = asyncio.run(server.api_download_html(article_id))
    assert "Edited reference" in html.body.decode("utf-8")

    from src.renderer.pdf_renderer import PDFRenderer

    captured = {}

    def fake_render(self, html_content, base_url=None):
        captured["html"] = html_content
        return b"%PDF-1.4\n%%EOF"

    monkeypatch.setattr(PDFRenderer, "render_to_bytes", fake_render)
    pdf = asyncio.run(server.api_download_pdf(article_id))
    assert pdf.status_code == 200
    assert "Edited title" in captured["html"]
    assert "Edited table" in captured["html"]


def test_editor_add_and_delete_items_are_reflected_in_effective_article(tmp_path, monkeypatch):
    store = ArticleStore(
        db_path=str(tmp_path / "articles.db"),
        data_dir=str(tmp_path / "articles"),
    )
    store.init_db()
    old_section = Section(
        title="Old section",
        paragraphs=[Paragraph(runs=[Run(kind="text", text="Old text")])],
        figures=[Figure(id="old-figure", caption="Old", number=1)],
    )
    article = Article(title="Article", lang="en", sections=[old_section])
    article_id = store.add_article(article)
    monkeypatch.setattr(server, "store", store)

    paper = {
        "sections": [{
            "id": "section-added",
            "title": {"en": "Added section", "zh": "新增章节"},
            "content": {"en": "Added text", "zh": "新增正文"},
        }],
        "figures": [{
            "id": "new-figure",
            "number": 2,
            "caption": {"en": "New figure", "zh": "新图片"},
            "sectionId": "section-added",
            "src": "new.png",
        }],
        "tables": [],
    }
    asyncio.run(server.api_update_editor_article(article_id, paper))
    effective = server._load_effective_article(article_id)

    assert [section.title for section in effective.sections] == ["Added section"]
    assert effective.sections[0].paragraphs[0].runs[0].text == "Added text"
    assert [figure.id for figure in effective.sections[0].figures] == ["new-figure"]
    assert effective.figures == []
