"""
学术期刊优化平台 — Web 服务层
============================
FastAPI 应用，连接前端模板与后端解析/渲染引擎。

启动:
    python -m src.server
    uvicorn src.server:app --reload --port 8000

页面路由 (返回完整 HTML):
    GET /               首页
    GET /upload         上传转换
    GET /article/{id}   论文详情
    GET /about          关于

API 路由:
    POST   /api/upload                    上传 XML → 解析 → 存储
    GET    /api/articles                  文章列表 (分页+搜索)
    GET    /api/articles/{id}             文章详情 JSON
    GET    /api/articles/{id}/preview     预览 HTML (iframe)
    GET    /api/articles/{id}/html        下载 HTML
    GET    /api/articles/{id}/pdf         下载 PDF
    GET    /api/filters                   筛选值
"""

import asyncio
import base64
import html
import io
import json
import mimetypes
import os
import pickle
import re
import shutil
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from contextlib import asynccontextmanager
from pathlib import PurePosixPath

from PIL import Image, ImageOps

from fastapi import FastAPI, File, UploadFile, Query, HTTPException
from fastapi.responses import (
    FileResponse,
    HTMLResponse,
    JSONResponse,
    RedirectResponse,
    Response,
)
from fastapi.staticfiles import StaticFiles

from .config import (
    is_dev,
    is_prod,
    startup_banner,
    PORTAL_DEV_URL,
    WEB_INDEX,
    WEB_ASSETS,
    STUDIO_DEV_URL,
    SAMPLE_DIRS,
    PMC_ASSET_DIR,
    ARTICLE_ASSET_DIR,
)
from .jinja_env import get_jinja_env
from .parser.jats_parser import JATSParser
from .renderer.html_renderer import HTMLRenderer
from .store import ArticleStore


# ── Jinja2 环境（统一实例）──
_jinja_env = get_jinja_env()

# ── 全局实例 ──────────────────────────────────

store = ArticleStore()
html_renderer = HTMLRenderer()

# 公式预渲染缓存：article_id → bool（是否已处理）
_formula_cache: set = set()
_pmc_asset_cache: dict[str, dict[str, str]] = {}
_pmc_asset_lock = threading.RLock()

_MAX_UPLOAD_BYTES = 10 * 1024 * 1024
_MAX_ZIP_UPLOAD_BYTES = 50 * 1024 * 1024
_MAX_ZIP_EXPANDED_BYTES = 100 * 1024 * 1024
_MAX_REMOTE_IMAGE_BYTES = 25 * 1024 * 1024
_MAX_PDF_IMAGE_EDGE = 2400
_MAX_ZIP_FILES = 500
_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".tif", ".tiff"}

# ── 生命周期 ──────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """启动时种子数据"""
    print(startup_banner())
    print("[server] 初始化数据存储...")
    store.initialize()
    with store._conn() as conn:
        count = conn.execute("SELECT COUNT(*) FROM articles").fetchone()[0]
    print(f"[server] 已就绪，共 {count} 篇文章")
    yield

app = FastAPI(title="学术期刊优化平台", lifespan=lifespan)

# 统一 React 应用与 API 由同一个 FastAPI 端口提供。
# 开发模式下 Vite 会把 /api 代理到本服务，因此无需开启宽泛 CORS。
if is_prod() and os.path.isdir(WEB_ASSETS):
    app.mount(
        "/assets",
        StaticFiles(directory=WEB_ASSETS),
        name="web-assets",
    )

# 向后兼容别名（测试和其他模块可能引用带下划线前缀的名称）
_ARTICLE_ASSET_DIR = ARTICLE_ASSET_DIR
_IMAGE_SEARCH_DIRS = SAMPLE_DIRS

# ── 辅助函数 ──────────────────────────────────

def _load_article(article_id: str):
    """加载 Article 并注入 id 属性"""
    article = store.get_article(article_id)
    if article is None:
        raise HTTPException(404, f"文章不存在: {article_id}")
    article.id = article_id
    if not getattr(article, "pmcid", ""):
        meta = store.get_meta(article_id) or {}
        match = re.search(r"pmc(\d+)", meta.get("original_filename", ""), re.I)
        if match:
            article.pmcid = f"PMC{match.group(1)}"
    return article


def _deep_merge(base: dict, overlay: dict) -> None:
    """原地将 overlay 合并到 base 中（深度合并，列表直接替换）。"""
    for key, value in overlay.items():
        if key in base and isinstance(base[key], dict) and isinstance(value, dict):
            _deep_merge(base[key], value)
        else:
            base[key] = value


def _extract_pmc_asset_map(page_html: str) -> dict[str, str]:
    """从 PMC 文章页提取 filename → 可信 NCBI CDN URL。"""
    assets = {}
    for raw_url in re.findall(
        r'https://cdn\.ncbi\.nlm\.nih\.gov/pmc/[^"\'<>\s]+',
        html.unescape(page_html),
    ):
        parsed = urllib.parse.urlparse(raw_url)
        if parsed.scheme != "https" or parsed.netloc != "cdn.ncbi.nlm.nih.gov":
            continue
        filename = os.path.basename(parsed.path)
        if filename:
            assets[filename] = raw_url
    return assets


def _fetch_remote_bytes(url: str, max_bytes: int, timeout: int = 15) -> bytes:
    """通过验证 TLS 的 urllib/curl 获取可信远程内容，并限制响应大小。"""
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "JATS2PDF/1.0 (+local academic renderer)"},
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = response.read(max_bytes + 1)
    except (OSError, urllib.error.URLError):
        curl = shutil.which("curl")
        if not curl:
            return b""
        try:
            result = subprocess.run(
                [
                    curl,
                    "--fail",
                    "--location",
                    "--silent",
                    "--show-error",
                    "--compressed",
                    "--retry",
                    "2",
                    "--retry-delay",
                    "1",
                    "--max-time",
                    str(timeout),
                    "--max-filesize",
                    str(max_bytes),
                    "--user-agent",
                    "JATS2PDF/1.0 (+local academic renderer)",
                    url,
                ],
                capture_output=True,
                timeout=timeout + 6,
            )
        except (OSError, subprocess.TimeoutExpired):
            return b""
        if result.returncode != 0:
            return b""
        payload = result.stdout
    return payload if len(payload) <= max_bytes else b""


def _lookup_pmc_asset(assets: dict[str, str], filename: str) -> str:
    """先精确匹配，再兼容大小写和扩展名差异。"""
    if filename in assets:
        return assets[filename]
    folded = filename.casefold()
    for name, url in assets.items():
        if name.casefold() == folded:
            return url
    wanted_stem = os.path.splitext(folded)[0]
    for name, url in assets.items():
        if os.path.splitext(name.casefold())[0] == wanted_stem:
            return url
    return ""


def _resolve_pmc_image_url(pmcid: str, filename: str) -> str:
    """按 PMCID 查询 PMC 页面并返回指定图片的可信 CDN URL。"""
    pmcid = pmcid.upper()
    if not re.fullmatch(r"PMC\d+", pmcid):
        return ""

    with _pmc_asset_lock:
        cached = _pmc_asset_cache.get(pmcid)
        if cached:
            return _lookup_pmc_asset(cached, filename)

        page_url = f"https://pmc.ncbi.nlm.nih.gov/articles/{pmcid}/"
        assets = {}
        for attempt in range(3):
            payload = _fetch_remote_bytes(page_url, 12 * 1024 * 1024)
            if payload:
                assets = _extract_pmc_asset_map(
                    payload.decode("utf-8", errors="replace")
                )
            if assets:
                break
            if attempt < 2:
                time.sleep(0.5 * (attempt + 1))
        # 空结果不缓存，避免 NCBI 限流/简化页面造成永久 404。
        if not assets:
            return ""
        _pmc_asset_cache[pmcid] = assets
        return _lookup_pmc_asset(assets, filename)


def _looks_like_image(payload: bytes) -> bool:
    head = payload[:512].lstrip()
    return (
        head.startswith(b"\xff\xd8\xff")
        or head.startswith(b"\x89PNG\r\n\x1a\n")
        or head.startswith((b"GIF87a", b"GIF89a", b"II*\x00", b"MM\x00*"))
        or (head.startswith(b"RIFF") and b"WEBP" in head[:16])
        or head.startswith((b"<svg", b"<?xml"))
    )


def _cache_pmc_image(pmcid: str, filename: str) -> str:
    """把可信 PMC CDN 图片下载到本地缓存，后续直接由本服务返回。"""
    pmcid = pmcid.upper()
    if not re.fullmatch(r"PMC\d+", pmcid):
        return ""
    safe_name = os.path.basename(filename)
    cache_dir = os.path.join(PMC_ASSET_DIR, pmcid)
    cache_path = os.path.join(cache_dir, safe_name)
    if os.path.isfile(cache_path):
        return cache_path

    with _pmc_asset_lock:
        if os.path.isfile(cache_path):
            return cache_path
        remote_url = _resolve_pmc_image_url(pmcid, safe_name)
        if not remote_url:
            return ""
        payload = b""
        for attempt in range(3):
            candidate = _fetch_remote_bytes(remote_url, _MAX_REMOTE_IMAGE_BYTES)
            if candidate and _looks_like_image(candidate):
                payload = candidate
                break
            if attempt < 2:
                time.sleep(0.5 * (attempt + 1))
        if not payload:
            return ""
        os.makedirs(cache_dir, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=cache_dir, delete=False) as tmp:
            tmp.write(payload)
            tmp_path = tmp.name
        os.replace(tmp_path, cache_path)
        return cache_path


def _render_formulas(article_id: str):
    """懒加载：首次请求时预渲染公式，之后缓存"""
    global _formula_cache
    if article_id in _formula_cache:
        return
    try:
        from .renderer.formula_renderer import FormulaRenderer
        article = store.get_article(article_id)
        if article is None:
            return
        FormulaRenderer(method="auto").process_article_formulas(article)
        # 直接覆盖 pickle（保留原有 article_id）
        pickle_path = os.path.join(store.data_dir, f"{article_id}.pkl")
        with open(pickle_path, "wb") as f:
            pickle.dump(article, f)
        _formula_cache.add(article_id)
    except Exception as e:
        print(f"[server] 公式预渲染失败 {article_id}: {e}")

def _get_settings(
    ref_style: str = "elsevier",
    two_column: bool = False,
    font_style: str = "academic",
    font_size: str = "medium",
):
    """解析渲染参数"""
    if font_style not in {"academic", "modern", "international"}:
        font_style = "academic"
    if font_size not in {"small", "medium", "large"}:
        font_size = "medium"
    return {
        "ref_style": ref_style,
        "two_column": two_column,
        "font_style": font_style,
        "font_size": font_size,
    }

def _render_article_html(article, settings: dict) -> str:
    """渲染论文详情 HTML（与 preview 共用 article_preview.html）。"""
    font_map = {"small": "13px", "medium": "14px", "large": "15px"}
    template = _jinja_env.get_template("article_preview.html")
    html = template.render(
        article=article,
        has_authors=bool(article.authors),
        has_keywords=bool(article.keywords or article.keywords_en),
        has_references=bool(article.references),
        ref_style=settings["ref_style"],
        two_column=settings.get("two_column", False),
        font_size=font_map.get(settings.get("font_size", "medium"), "14px"),
        font_style=settings.get("font_style", "academic"),
    )
    return html


def _render_preview_html(article, settings: dict) -> str:
    """渲染屏幕预览与 PDF 共用的文档，保证 DOM 和样式来源一致。"""
    # 中文期刊双栏正文通常约 9.5-11pt；96dpi 下对应约 13-15px。
    font_map = {"small": "13px", "medium": "14px", "large": "15px"}
    template = _jinja_env.get_template("article_preview.html")
    return template.render(
        article=article,
        has_authors=bool(article.authors),
        has_keywords=bool(article.keywords or article.keywords_en),
        has_references=bool(article.references),
        ref_style=settings["ref_style"],
        two_column=settings["two_column"],
        font_size=font_map[settings["font_size"]],
        font_style=settings["font_style"],
    )


def _iter_article_figures(article):
    """按正文顺序遍历所有图片，兼容新 blocks 与历史 pickle。"""
    seen = set()

    def emit(figure):
        marker = id(figure)
        if marker in seen:
            return None
        seen.add(marker)
        return figure

    def walk(container):
        blocks = getattr(container, "blocks", None) or []
        if blocks:
            for block in blocks:
                if block.kind == "figure":
                    figure = emit(block.value)
                    if figure is not None:
                        yield figure
                elif block.kind == "section":
                    yield from walk(block.value)
        else:
            for figure in getattr(container, "figures", []) or []:
                unique = emit(figure)
                if unique is not None:
                    yield unique
            for section in getattr(container, "sections", []) or getattr(container, "subsections", []) or []:
                yield from walk(section)

    yield from walk(article)


def _find_article_image(article, article_id: str, href: str) -> str:
    """解析图片到可信本地文件，供 PDF 内嵌和编辑器预览复用。"""
    if not href or href.startswith("data:"):
        return ""
    safe_name = os.path.basename(urllib.parse.urlparse(href).path)
    if not safe_name:
        return ""

    candidates = []
    if re.fullmatch(r"[0-9a-f]{8}", article_id):
        candidates.append(os.path.join(_ARTICLE_ASSET_DIR, article_id, safe_name))
    for search_dir in _IMAGE_SEARCH_DIRS:
        candidates.append(os.path.join(search_dir, safe_name))
        if not href.startswith(("http://", "https://", "//")):
            candidates.append(os.path.join(search_dir, href))
    for candidate in candidates:
        if os.path.isfile(candidate):
            return candidate

    pmcid = str(getattr(article, "pmcid", "") or "").upper()
    if re.fullmatch(r"PMC\d+", pmcid):
        return _cache_pmc_image(pmcid, safe_name)
    return ""


def _image_data_uri(path: str) -> str:
    """纠正 EXIF 方向并限制超大图片尺寸，输出适合 PDF 的内嵌资源。"""
    if not path or not os.path.isfile(path):
        return ""
    suffix = os.path.splitext(path)[1].lower()
    if suffix == ".svg":
        with open(path, "rb") as source:
            payload = source.read(_MAX_REMOTE_IMAGE_BYTES + 1)
        if len(payload) > _MAX_REMOTE_IMAGE_BYTES:
            return ""
        return "data:image/svg+xml;base64," + base64.b64encode(payload).decode("ascii")

    try:
        with Image.open(path) as source:
            image = ImageOps.exif_transpose(source)
            image.seek(0)
            if max(image.size) > _MAX_PDF_IMAGE_EDGE:
                image.thumbnail((_MAX_PDF_IMAGE_EDGE, _MAX_PDF_IMAGE_EDGE), Image.Resampling.LANCZOS)
            output = io.BytesIO()
            has_alpha = image.mode in {"RGBA", "LA"} or "transparency" in image.info
            if has_alpha:
                image.convert("RGBA").save(output, format="PNG", optimize=True)
                media_type = "image/png"
            else:
                image.convert("RGB").save(
                    output,
                    format="JPEG",
                    quality=90,
                    optimize=True,
                    progressive=True,
                    dpi=(300, 300),
                )
                media_type = "image/jpeg"
            payload = output.getvalue()
    except Exception:
        with open(path, "rb") as source:
            payload = source.read(_MAX_REMOTE_IMAGE_BYTES + 1)
        if len(payload) > _MAX_REMOTE_IMAGE_BYTES or not _looks_like_image(payload):
            return ""
        media_type = mimetypes.guess_type(path)[0] or "application/octet-stream"
    return f"data:{media_type};base64,{base64.b64encode(payload).decode('ascii')}"


def _embed_article_images(article, article_id: str) -> int:
    """把文章图片转成 data URI，避免 PDF 引擎无法访问相对 /api URL。"""
    embedded = 0
    for figure in _iter_article_figures(article):
        href = str(getattr(figure, "graphic_href", "") or "")
        if href.startswith("data:"):
            embedded += 1
            continue
        local_path = _find_article_image(article, article_id, href)
        data_uri = _image_data_uri(local_path)
        if data_uri:
            figure.graphic_href = data_uri
            embedded += 1
    return embedded


def _paragraph_text(article, paragraph) -> str:
    parts = []
    for run in getattr(paragraph, "runs", []) or []:
        if run.kind == "xref":
            parts.append(article.xref_label(run.rid, run.text))
        elif run.kind == "formula" and run.formula:
            parts.append(run.formula.latex or "[formula]")
        else:
            parts.append(run.text)
    return "".join(parts).strip()


def _reference_text(reference) -> str:
    parts = []
    if reference.authors:
        parts.append(f"{reference.authors}.")
    if reference.title:
        parts.append(f"{reference.title}.")
    if reference.journal:
        parts.append(reference.journal)
    detail = " ".join(value for value in [reference.year, reference.volume, reference.issue, reference.pages] if value)
    if detail:
        parts.append(detail)
    if reference.doi:
        parts.append(f"doi:{reference.doi}")
    return " ".join(parts).strip()


def _article_editor_payload(article, article_id: str) -> dict:
    """把真实 JATS Article 映射到仓库原版编辑器 PaperData。"""
    sections = []
    section_ids = {}

    def add_section(section, number: str):
        paragraphs = [
            _paragraph_text(article, paragraph)
            for paragraph in getattr(section, "paragraphs", []) or []
        ]
        content = "\n\n".join(text for text in paragraphs if text)
        title_en = section.title if article.lang == "en" else ""
        title_zh = section.title if article.lang != "en" else ""
        section_id = f"section-{number.replace('.', '-')}"
        section_ids[id(section)] = section_id
        sections.append({
            "id": section_id,
            "number": number,
            "title": {"en": title_en or section.title, "zh": title_zh or section.title},
            "content": {"en": content, "zh": content},
            "subsections": [],
        })
        for index, child in enumerate(getattr(section, "subsections", []) or [], 1):
            add_section(child, f"{number}.{index}")

    for index, section in enumerate(getattr(article, "sections", []) or [], 1):
        add_section(section, str(index))

    placements = {}
    content_order = 0

    def record_placement(kind: str, value, section_id: str):
        nonlocal content_order
        marker = (kind, id(value))
        if marker in placements:
            return
        content_order += 1
        placements[marker] = {"sectionId": section_id, "order": content_order}

    def map_content(container, section_id: str = ""):
        blocks = getattr(container, "blocks", None) or []
        if blocks:
            for block in blocks:
                if block.kind in {"figure", "table"}:
                    record_placement(block.kind, block.value, section_id)
                elif block.kind == "section":
                    child_id = section_ids.get(id(block.value), section_id)
                    map_content(block.value, child_id)
            return
        for figure in getattr(container, "figures", []) or []:
            record_placement("figure", figure, section_id)
        for table in getattr(container, "tables", []) or []:
            record_placement("table", table, section_id)
        for child in getattr(container, "sections", []) or getattr(container, "subsections", []) or []:
            map_content(child, section_ids.get(id(child), section_id))

    map_content(article)

    figures = []
    for index, figure in enumerate(_iter_article_figures(article), 1):
        safe_name = os.path.basename(urllib.parse.urlparse(figure.graphic_href or "").path)
        params = {"article_id": article_id}
        pmcid = str(getattr(article, "pmcid", "") or "").upper()
        if re.fullmatch(r"PMC\d+", pmcid):
            params["pmcid"] = pmcid
        src = f"/api/files/{urllib.parse.quote(safe_name)}?{urllib.parse.urlencode(params)}" if safe_name else ""
        figures.append({
            "id": figure.id or f"figure-{index}",
            "number": figure.number or index,
            "caption": {"en": figure.caption, "zh": figure.caption},
            "placeholder": "#eef2f7",
            "src": src,
            **placements.get(("figure", id(figure)), {}),
        })

    tables = []
    seen_tables = set()

    def table_cell_payload(cell):
        return {
            "text": cell.text,
            "colspan": max(1, int(getattr(cell, "colspan", 1) or 1)),
            "rowspan": max(1, int(getattr(cell, "rowspan", 1) or 1)),
            "isHeader": bool(getattr(cell, "is_header", False)),
            "align": str(getattr(cell, "align", "") or ""),
        }

    def add_tables(container):
        for table in getattr(container, "tables", []) or []:
            marker = id(table)
            if marker in seen_tables:
                continue
            seen_tables.add(marker)
            header_rows = getattr(table, "header_rows", []) or []
            body_rows = getattr(table, "body_rows", []) or []
            headers = [cell.text for cell in header_rows[0]] if header_rows else list(getattr(table, "headers", []) or [])
            rows = [[cell.text for cell in row] for row in body_rows] if body_rows else list(getattr(table, "rows", []) or [])
            tables.append({
                "id": table.id or f"table-{len(tables) + 1}",
                "number": table.number or len(tables) + 1,
                "caption": {"en": table.caption, "zh": table.caption},
                "headers": headers,
                "rows": [{"cells": row} for row in rows],
                "headerRows": [[table_cell_payload(cell) for cell in row] for row in header_rows],
                "bodyRows": [[table_cell_payload(cell) for cell in row] for row in body_rows],
                "footnotes": list(getattr(table, "footnotes", []) or []),
                **placements.get(("table", id(table)), {}),
            })
        for section in getattr(container, "sections", []) or getattr(container, "subsections", []) or []:
            add_tables(section)

    add_tables(article)

    title_en = article.title if article.lang == "en" else (article.subtitle or article.title)
    title_zh = article.title if article.lang != "en" else (article.subtitle or article.title)
    abstract_en = article.abstract_en or (article.abstract if article.lang == "en" else "")
    abstract_zh = article.abstract if article.lang != "en" else ""
    keywords_en = article.keywords_en or (article.keywords if article.lang == "en" else [])
    keywords_zh = article.keywords if article.lang != "en" else []

    return {
        "article_id": article_id,
        "paper": {
            "journal": article.journal,
            "journalZh": article.journal,
            "issn": "",
            "doi": article.doi,
            "volume": "",
            "year": str(article.publication_year or ""),
            "pages": "",
            "received": "",
            "revised": "",
            "accepted": "",
            "title": {"en": title_en, "zh": title_zh},
            "authors": [{
                "name": f"{author.given_name} {author.surname}".strip(),
                "nameZh": f"{author.given_name} {author.surname}".strip(),
                "affKeys": author.affiliation,
                "email": author.email,
            } for author in article.authors],
            "affiliations": [{
                "key": str(index),
                "text": " ".join(value for value in [aff.department, aff.name, aff.city, aff.country] if value),
                "textZh": " ".join(value for value in [aff.department, aff.name, aff.city, aff.country] if value),
            } for index, aff in enumerate(article.affiliations, 1)],
            "highlights": [],
            "highlightsZh": [],
            "abstract": {"en": abstract_en, "zh": abstract_zh or abstract_en},
            "keywords": {"en": keywords_en, "zh": keywords_zh or keywords_en},
            "sections": sections,
            "figures": figures,
            "tables": tables,
            "references": [_reference_text(reference) for reference in article.references],
        },
    }

# ── 页面路由 ──────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def page_index():
    if is_dev():
        return RedirectResponse(f"{PORTAL_DEV_URL}/", status_code=307)
    if os.path.isfile(WEB_INDEX):
        return FileResponse(WEB_INDEX, media_type="text/html")
    articles = []
    for item in store.list_articles(per_page=20)["items"]:
        article = _load_article(item["id"])
        articles.append(article)
    return html_renderer.render_index(
        articles=articles,
        journal_name="学术期刊优化平台",
    )


@app.get("/studio", response_class=HTMLResponse)
@app.get("/studio/", response_class=HTMLResponse)
@app.get("/studio/{rest:path}", response_class=HTMLResponse)
async def page_studio():
    if is_dev():
        return RedirectResponse(f"{STUDIO_DEV_URL}/studio/", status_code=307)
    if os.path.isfile(WEB_INDEX):
        return FileResponse(WEB_INDEX, media_type="text/html")
    return RedirectResponse("/?view=library", status_code=307)


@app.get("/upload", response_class=HTMLResponse)
async def page_upload():
    if is_dev():
        return RedirectResponse(f"{PORTAL_DEV_URL}/", status_code=307)
    if os.path.isfile(WEB_INDEX):
        return RedirectResponse("/?view=upload", status_code=307)
    return html_renderer.render_upload(journal_name="学术期刊优化平台")


@app.get("/article/{article_id}", response_class=HTMLResponse)
async def page_article(
    article_id: str,
    ref_style: str = Query("elsevier"),
    two_column: bool = Query(False),
    font_style: str = Query("academic"),
    font_size: str = Query("medium"),
):
    if is_dev():
        return RedirectResponse(
            f"{STUDIO_DEV_URL}/studio/editor?article={urllib.parse.quote(article_id)}",
            status_code=307,
        )
    if os.path.isfile(WEB_INDEX):
        return RedirectResponse(
            f"/studio/editor?article={urllib.parse.quote(article_id)}",
            status_code=307,
        )
    article = _load_article(article_id)
    _render_formulas(article_id)
    article = _load_article(article_id)
    article.id = article_id
    settings = _get_settings(ref_style, two_column, font_style, font_size)
    return _render_article_html(article, settings)


@app.get("/about", response_class=HTMLResponse)
async def page_about():
    if is_dev():
        return RedirectResponse(f"{PORTAL_DEV_URL}/", status_code=307)
    if os.path.isfile(WEB_INDEX):
        return FileResponse(WEB_INDEX, media_type="text/html")
    return html_renderer.render_about(journal_name="学术期刊优化平台")

# ── API 路由 ──────────────────────────────────


def _extract_zip_bundle(content: bytes, temp_dir: str) -> tuple[str, str]:
    """安全提取一个 XML + 多张栅格图片，返回 XML 路径和图片目录。"""
    try:
        archive = zipfile.ZipFile(io.BytesIO(content))
    except zipfile.BadZipFile as exc:
        raise ValueError("ZIP 文件损坏或格式无效") from exc

    with archive:
        members = [member for member in archive.infolist() if not member.is_dir()]
        if len(members) > _MAX_ZIP_FILES:
            raise ValueError(f"ZIP 内文件数量不能超过 {_MAX_ZIP_FILES}")
        if sum(member.file_size for member in members) > _MAX_ZIP_EXPANDED_BYTES:
            raise ValueError("ZIP 解压后总大小不能超过 100 MB")

        safe_members = []
        for member in members:
            normalized = member.filename.replace("\\", "/")
            path = PurePosixPath(normalized)
            if path.is_absolute() or ".." in path.parts:
                raise ValueError("ZIP 包含不安全的文件路径")
            safe_members.append((member, path))

        xml_members = [
            (member, path)
            for member, path in safe_members
            if path.suffix.lower() == ".xml"
        ]
        if len(xml_members) != 1:
            raise ValueError("ZIP 中必须且只能包含一个 JATS XML 文件")

        xml_path = os.path.join(temp_dir, "article.xml")
        with archive.open(xml_members[0][0]) as source, open(xml_path, "wb") as target:
            shutil.copyfileobj(source, target)

        assets_dir = os.path.join(temp_dir, "assets")
        os.makedirs(assets_dir, exist_ok=True)
        seen_names = set()
        for member, path in safe_members:
            if path.suffix.lower() not in _IMAGE_EXTENSIONS:
                continue
            safe_name = os.path.basename(path.name)
            folded = safe_name.casefold()
            if folded in seen_names:
                raise ValueError(f"ZIP 中存在同名图片: {safe_name}")
            seen_names.add(folded)
            with archive.open(member) as source, open(
                os.path.join(assets_dir, safe_name), "wb"
            ) as target:
                shutil.copyfileobj(source, target)
        return xml_path, assets_dir


def _store_article_assets(article_id: str, assets_dir: str):
    """把上传资源按 article_id 隔离保存，避免不同论文同名图片冲突。"""
    files = [
        name
        for name in os.listdir(assets_dir)
        if os.path.isfile(os.path.join(assets_dir, name))
    ]
    if not files:
        return
    target_dir = os.path.join(_ARTICLE_ASSET_DIR, article_id)
    os.makedirs(target_dir, exist_ok=True)
    for name in files:
        shutil.copy2(os.path.join(assets_dir, name), os.path.join(target_dir, name))


@app.post("/api/upload")
async def api_upload(file: UploadFile = File(...)):
    """上传单个 JATS XML，或包含一个 XML 与多张图片的 ZIP 资源包。"""
    filename = file.filename or ""
    lower_name = filename.lower()
    is_zip = lower_name.endswith(".zip")
    if not (lower_name.endswith(".xml") or is_zip):
        raise HTTPException(400, "仅支持 .xml 或 .zip 格式")

    temp_dir = tempfile.mkdtemp(prefix="jats2pdf_upload_")
    try:
        max_upload = _MAX_ZIP_UPLOAD_BYTES if is_zip else _MAX_UPLOAD_BYTES
        content = await file.read(max_upload + 1)
        if len(content) > max_upload:
            limit_mb = max_upload // (1024 * 1024)
            raise HTTPException(413, f"上传文件不能超过 {limit_mb} MB")

        assets_dir = ""
        if is_zip:
            source_path = os.path.join(temp_dir, "bundle.zip")
            with open(source_path, "wb") as target:
                target.write(content)
            xml_path, assets_dir = _extract_zip_bundle(content, temp_dir)
        else:
            source_path = xml_path = os.path.join(temp_dir, "article.xml")
            with open(xml_path, "wb") as target:
                target.write(content)

        article = JATSParser(xml_path).parse()

        article_id = store.add_article(
            article,
            filename=filename,
            source="upload_bundle" if is_zip else "upload",
            filepath=source_path,
        )
        article.id = article_id
        if assets_dir:
            _store_article_assets(article_id, assets_dir)

        # 构建元数据响应（预览 HTML 由前端单独请求 /api/articles/{id}/preview 获取）
        authors_list = [{"name": f"{a.given_name} {a.surname}".strip(), "affiliation": a.affiliation}
                        for a in article.authors]

        return JSONResponse({
            "article_id": article_id,
            "title": article.title,
            "authors": authors_list,
            "journal": article.journal,
            "doi": article.doi,
            "lang": article.lang,
            "ref_count": len(article.references),
            "asset_count": len(os.listdir(assets_dir)) if assets_dir else 0,
        })

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"XML 解析失败: {str(e)}")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
        await file.close()


@app.get("/api/articles")
async def api_list_articles(
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=50),
    search: str = Query(""),
    field: str = Query(""),
    year: int | None = Query(None, ge=1000, le=9999),
):
    """文章列表（分页+搜索+筛选）"""
    return store.list_articles(page=page, per_page=per_page, search=search, field=field, year=year)


@app.get("/api/articles/{article_id}")
async def api_get_article(article_id: str):
    """获取文章详情（JSON + 渲染 HTML）"""
    article = _load_article(article_id)
    _render_formulas(article_id)
    article = _load_article(article_id)
    article.id = article_id

    settings = _get_settings()
    html = _render_article_html(article, settings)

    return JSONResponse({
        "article_id": article_id,
        "title": article.title,
        "abstract": article.abstract,
        "abstract_en": article.abstract_en,
        "authors": [{"name": f"{a.given_name} {a.surname}".strip()} for a in article.authors],
        "rendered_html": html,
    })


@app.get("/api/articles/{article_id}/editor")
async def api_get_editor_article(article_id: str):
    """获取供原版 React 文章编辑器使用的真实结构化数据。
    如果有已保存的编辑内容，会合并在解析结果之上。"""
    article = _load_article(article_id)
    article.id = article_id
    payload = _article_editor_payload(article, article_id)

    # 合并已保存的编辑（如果有）
    edited_path = os.path.join(store.data_dir, f"{article_id}_edited.json")
    if os.path.isfile(edited_path):
        try:
            with open(edited_path, "r", encoding="utf-8") as f:
                saved = json.load(f)
            if isinstance(saved, dict):
                saved_paper = saved.get("paper", saved)
                current_paper = payload.get("paper", {})
                _deep_merge(current_paper, saved_paper)
        except (json.JSONDecodeError, OSError):
            pass

    return JSONResponse(payload)


@app.put("/api/articles/{article_id}/editor")
async def api_update_editor_article(article_id: str, paper: dict | None = None):
    """保存 React 文章编辑器的修改内容。
    编辑数据存储为 JSON，不影响原始 JATS 解析结果。"""
    # 验证文章存在
    try:
        _load_article(article_id)
    except HTTPException:
        raise HTTPException(404, f"文章不存在: {article_id}")

    if not paper:
        paper = {}

    os.makedirs(store.data_dir, exist_ok=True)
    edited_path = os.path.join(store.data_dir, f"{article_id}_edited.json")
    with open(edited_path, "w", encoding="utf-8") as f:
        json.dump({"paper": paper, "saved_at": time.strftime("%Y-%m-%d %H:%M:%S")},
                  f, ensure_ascii=False, indent=2)

    return JSONResponse({"status": "ok", "article_id": article_id})


@app.get("/api/articles/{article_id}/preview")
async def api_preview(
    article_id: str,
    ref_style: str = Query("elsevier"),
    two_column: bool = Query(False),
    font_size: str = Query("medium"),
    font_style: str = Query("academic"),
):
    """获取 iframe 预览 HTML（使用干净模板，无导航/页脚）"""
    article = _load_article(article_id)
    _render_formulas(article_id)
    article = _load_article(article_id)
    article.id = article_id

    settings = _get_settings(ref_style, two_column, font_style, font_size)
    return HTMLResponse(_render_preview_html(article, settings))


@app.get("/api/articles/{article_id}/html")
async def api_download_html(
    article_id: str,
    ref_style: str = Query("elsevier"),
    two_column: bool = Query(False),
    font_style: str = Query("academic"),
    font_size: str = Query("medium"),
):
    """下载独立 HTML 文件"""
    article = _load_article(article_id)
    _render_formulas(article_id)
    article = _load_article(article_id)
    article.id = article_id

    settings = _get_settings(ref_style, two_column, font_style, font_size)
    html = _render_preview_html(article, settings)

    # 文件名只保留 ASCII 字符
    safe_title = article.title.encode("ascii", "ignore").decode()[:30].strip() or "article"
    safe_title = safe_title.replace("/", "-").replace(" ", "_")
    return Response(
        content=html,
        media_type="text/html",
        headers={"Content-Disposition": f'attachment; filename="{safe_title}.html"'},
    )


@app.get("/api/articles/{article_id}/pdf")
async def api_download_pdf(
    article_id: str,
    ref_style: str = Query("elsevier"),
    two_column: bool = Query(False),
    font_style: str = Query("academic"),
    font_size: str = Query("medium"),
):
    """生成并下载 PDF"""
    article = _load_article(article_id)
    _render_formulas(article_id)
    article = _load_article(article_id)
    article.id = article_id

    settings = _get_settings(ref_style, two_column, font_style, font_size)
    embedded_images = await asyncio.to_thread(_embed_article_images, article, article_id)
    html = _render_preview_html(article, settings)

    try:
        from .renderer.pdf_renderer import PDFRenderer
        # article_preview.html 已包含与屏幕预览完全相同的自包含 CSS；
        # 不再叠加旧 styles.css，否则会重新引入卡片、跨栏等冲突规则。
        pdf_renderer = PDFRenderer(css_path="")
        pdf_bytes = pdf_renderer.render_to_bytes(html)
    except Exception as e:
        raise HTTPException(500, f"PDF 生成失败: {str(e)}")

    # 文件名只保留 ASCII 字符
    safe_title = article.title.encode("ascii", "ignore").decode()[:30].strip() or "article"
    safe_title = safe_title.replace("/", "-").replace(" ", "_")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_title}.pdf"',
            "X-Embedded-Images": str(embedded_images),
        },
    )


@app.get("/api/filters")
async def api_filters():
    """获取可用筛选值"""
    return store.get_filter_values()


@app.get("/api/files/{filename}")
async def api_serve_file(
    filename: str,
    article_id: str = Query(""),
    pmcid: str = Query(""),
):
    """优先提供本地图片；缺失时仅从可信 PMC/NCBI CDN 回退。"""
    safe_name = os.path.basename(filename)
    if not safe_name:
        raise HTTPException(404, "无效文件名")

    if re.fullmatch(r"[0-9a-f]{8}", article_id):
        article_asset = os.path.join(_ARTICLE_ASSET_DIR, article_id, safe_name)
        if os.path.isfile(article_asset):
            media_type, _ = mimetypes.guess_type(article_asset)
            return FileResponse(
                article_asset,
                media_type=media_type or "application/octet-stream",
            )

    for search_dir in _IMAGE_SEARCH_DIRS:
        filepath = os.path.join(search_dir, safe_name)
        if os.path.isfile(filepath):
            media_type, _ = mimetypes.guess_type(filepath)
            return FileResponse(filepath, media_type=media_type or "application/octet-stream")

    pmcid_str = str(pmcid) if not isinstance(pmcid, str) else pmcid
    if re.fullmatch(r"PMC\d+", pmcid_str.upper()):
        cached_path = await asyncio.to_thread(
            _cache_pmc_image,
            pmcid_str,
            safe_name,
        )
        if cached_path:
            media_type, _ = mimetypes.guess_type(cached_path)
            return FileResponse(
                cached_path,
                media_type=media_type or "application/octet-stream",
            )

    raise HTTPException(404, f"文件未找到: {safe_name}")


# ── 健康检查 ──────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok"}


# ── 直接运行入口 ──────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.server:app", host="0.0.0.0", port=8000, reload=True)
