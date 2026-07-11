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
import html
import io
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

from fastapi import FastAPI, File, UploadFile, Query, HTTPException
from fastapi.responses import (
    FileResponse,
    HTMLResponse,
    JSONResponse,
    Response,
)

from .parser.jats_parser import JATSParser
from .renderer.html_renderer import HTMLRenderer
from .store import ArticleStore
from jinja2 import Environment, FileSystemLoader, pass_context, select_autoescape

# ── Jinja2 环境（复用模板目录）──
_TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "templates")
_jinja_env = Environment(
    loader=FileSystemLoader(_TEMPLATE_DIR),
    autoescape=select_autoescape(enabled_extensions=("html", "xml")),
)
_jinja_env.filters["orcid_url"] = lambda orcid: f"https://orcid.org/{orcid}" if orcid else ""


@pass_context
def _resolve_image_path(context, href: str) -> str:
    """将 graphic_href 解析为可用的图片 URL。
    - 绝对 URL (http/https/data:) → 原样返回
    - 相对路径 (如 arch.svg) → /api/files/{basename}
    - 空字符串 → 原样返回
    """
    if not href:
        return href
    if href.startswith("data:"):
        return href
    if href.startswith(("http://", "https://", "//")):
        return ""
    safe = os.path.basename(href)
    if not safe:
        return href
    article = context.get("article")
    pmcid = str(getattr(article, "pmcid", "") or "").upper()
    article_id = str(getattr(article, "id", "") or "")
    params = {}
    if re.fullmatch(r"[0-9a-f]{8}", article_id):
        params["article_id"] = article_id
    if re.fullmatch(r"PMC\d+", pmcid):
        params["pmcid"] = pmcid
    suffix = f"?{urllib.parse.urlencode(params)}" if params else ""
    return f"/api/files/{safe}{suffix}"


_jinja_env.filters["resolve_image"] = _resolve_image_path

# ── 全局实例 ──────────────────────────────────

store = ArticleStore()
html_renderer = HTMLRenderer()

# 公式预渲染缓存：article_id → bool（是否已处理）
_formula_cache: set = set()
_pmc_asset_cache: dict[str, dict[str, str]] = {}
_pmc_asset_lock = threading.RLock()

# 图片文件搜索目录（按优先级排列）
_IMAGE_SEARCH_DIRS = [
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "samples", "output"),
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "samples", "real"),
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "samples"),
]
_MAX_UPLOAD_BYTES = 10 * 1024 * 1024
_MAX_ZIP_UPLOAD_BYTES = 50 * 1024 * 1024
_MAX_ZIP_EXPANDED_BYTES = 100 * 1024 * 1024
_MAX_REMOTE_IMAGE_BYTES = 25 * 1024 * 1024
_MAX_ZIP_FILES = 500
_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".tif", ".tiff"}
_PMC_ASSET_DIR = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "data", "pmc_assets"
)
_ARTICLE_ASSET_DIR = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "data", "article_assets"
)

# ── 生命周期 ──────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """启动时种子数据"""
    print("[server] 初始化数据存储...")
    store.initialize()
    with store._conn() as conn:
        count = conn.execute("SELECT COUNT(*) FROM articles").fetchone()[0]
    print(f"[server] 已就绪，共 {count} 篇文章")
    yield

app = FastAPI(title="学术期刊优化平台", lifespan=lifespan)

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
    cache_dir = os.path.join(_PMC_ASSET_DIR, pmcid)
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

def _get_settings(ref_style: str = "elsevier", two_column: bool = False):
    """解析渲染参数"""
    return {"ref_style": ref_style, "two_column": two_column}

def _render_article_html(article, settings: dict) -> str:
    """渲染论文详情 HTML"""
    html = html_renderer.render_article(
        article,
        ref_style=settings["ref_style"],
        two_column=settings.get("two_column", False),
        asset_mode="web",
    )
    if settings.get("two_column"):
        html = html.replace("<body>", '<body class="two-column">', 1)
    return html

# ── 页面路由 ──────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def page_index():
    articles = []
    for item in store.list_articles(per_page=20)["items"]:
        article = _load_article(item["id"])
        articles.append(article)
    return html_renderer.render_index(
        articles=articles,
        journal_name="学术期刊优化平台",
    )

@app.get("/upload", response_class=HTMLResponse)
async def page_upload():
    return html_renderer.render_upload(journal_name="学术期刊优化平台")

@app.get("/article/{article_id}", response_class=HTMLResponse)
async def page_article(
    article_id: str,
    ref_style: str = Query("elsevier"),
    two_column: bool = Query(False),
):
    article = _load_article(article_id)
    _render_formulas(article_id)
    article = _load_article(article_id)  # 重新加载（含 SVG 公式）
    article.id = article_id

    settings = _get_settings(ref_style, two_column)

    return _render_article_html(article, settings)

@app.get("/about", response_class=HTMLResponse)
async def page_about():
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


@app.get("/api/articles/{article_id}/preview")
async def api_preview(
    article_id: str,
    ref_style: str = Query("elsevier"),
    two_column: bool = Query(False),
    font_size: str = Query("medium"),
):
    """获取 iframe 预览 HTML（使用干净模板，无导航/页脚）"""
    article = _load_article(article_id)
    _render_formulas(article_id)
    article = _load_article(article_id)
    article.id = article_id

    has_authors = len(article.authors) > 0
    has_keywords = bool(article.keywords or article.keywords_en)
    has_references = len(article.references) > 0

    font_map = {"small": "15px", "medium": "17px", "large": "19px"}
    font_size_css = font_map.get(font_size, "17px")

    template = _jinja_env.get_template("article_preview.html")
    html = template.render(
        article=article,
        has_authors=has_authors,
        has_keywords=has_keywords,
        has_references=has_references,
        ref_style=ref_style,
        two_column=two_column,
        font_size=font_size_css,
    )

    return HTMLResponse(html)


@app.get("/api/articles/{article_id}/html")
async def api_download_html(
    article_id: str,
    ref_style: str = Query("elsevier"),
    two_column: bool = Query(False),
):
    """下载独立 HTML 文件"""
    article = _load_article(article_id)
    _render_formulas(article_id)
    article = _load_article(article_id)
    article.id = article_id

    settings = _get_settings(ref_style, two_column)
    html = _render_article_html(article, settings)

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
):
    """生成并下载 PDF"""
    article = _load_article(article_id)
    _render_formulas(article_id)
    article = _load_article(article_id)
    article.id = article_id

    settings = _get_settings(ref_style, two_column)
    html = _render_article_html(article, settings)

    try:
        from .renderer.pdf_renderer import PDFRenderer
        pdf_renderer = PDFRenderer()
        pdf_bytes = pdf_renderer.render_to_bytes(html)
    except Exception as e:
        raise HTTPException(500, f"PDF 生成失败: {str(e)}")

    # 文件名只保留 ASCII 字符
    safe_title = article.title.encode("ascii", "ignore").decode()[:30].strip() or "article"
    safe_title = safe_title.replace("/", "-").replace(" ", "_")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_title}.pdf"'},
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

    if re.fullmatch(r"PMC\d+", pmcid.upper()):
        cached_path = await asyncio.to_thread(
            _cache_pmc_image,
            pmcid,
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
