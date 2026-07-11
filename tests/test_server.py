"""Web 上传边界的轻量回归测试（不依赖 TestClient/httpx）。"""

import asyncio
import concurrent.futures
import io
import json
import zipfile

import pytest
from fastapi import HTTPException, UploadFile

from src import server
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
