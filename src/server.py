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

from fastapi import FastAPI, File, UploadFile, Query, HTTPException, Request
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
from .parser.jats_parser import (
    Affiliation,
    Author,
    ContentBlock,
    Figure,
    JATSParser,
    Paragraph,
    Reference,
    Run,
    Section,
    Table,
    TableCell,
)
from .renderer.html_renderer import HTMLRenderer
from .store import ArticleStore


# ── Jinja2 环境（统一实例）──
_jinja_env = get_jinja_env()

# ── 全局实例 ──────────────────────────────────

store = ArticleStore()
html_renderer = HTMLRenderer()

# 公式预渲染缓存：article_id → bool（是否已处理）
_formula_cache: set = set()
_formula_lock = threading.RLock()
_pmc_asset_cache: dict[str, dict[str, str]] = {}
_pmc_asset_lock = threading.RLock()

_MAX_UPLOAD_BYTES = 10 * 1024 * 1024
_MAX_ZIP_UPLOAD_BYTES = 50 * 1024 * 1024
_MAX_ZIP_EXPANDED_BYTES = 100 * 1024 * 1024
_MAX_REMOTE_IMAGE_BYTES = 25 * 1024 * 1024
_MAX_PDF_IMAGE_EDGE = 2400
_MAX_ZIP_FILES = 500
_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".tif", ".tiff"}
_MAX_EDITOR_JSON_BYTES = 2 * 1024 * 1024
_MAX_EDITOR_STRING_BYTES = 200_000
_ARTICLE_ID_RE = re.compile(r"^[0-9a-f]{8}$")

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

def _validate_article_id(article_id: str) -> str:
    """只允许存储层生成的 8 位十六进制 ID，避免路径拼接越界。"""
    if not isinstance(article_id, str) or not _ARTICLE_ID_RE.fullmatch(article_id):
        raise HTTPException(400, "无效的文章 ID")
    return article_id


def _contained_path(base_dir: str, *parts: str) -> str:
    """返回位于 base_dir 内的规范路径；越界时返回空字符串。"""
    base = os.path.realpath(base_dir)
    candidate = os.path.realpath(os.path.join(base_dir, *parts))
    if candidate == base or candidate.startswith(base + os.sep):
        return candidate
    return ""

def _load_article(article_id: str):
    """加载 Article 并注入 id 属性"""
    article_id = _validate_article_id(article_id)
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


def _edited_path(article_id: str) -> str:
    article_id = _validate_article_id(article_id)
    return _contained_path(store.data_dir, f"{article_id}_edited.json")


def _read_edited_paper(article_id: str) -> dict:
    """读取已保存的 PaperData；损坏或旧格式按无编辑内容处理。"""
    try:
        with open(_edited_path(article_id), "r", encoding="utf-8") as stream:
            saved = json.load(stream)
        paper = saved.get("paper", saved) if isinstance(saved, dict) else {}
        return paper if isinstance(paper, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _write_edited_paper(article_id: str, paper: dict) -> None:
    """在线程中原子写入编辑 JSON，避免大请求阻塞事件循环。"""
    os.makedirs(store.data_dir, exist_ok=True)
    edited_path = _edited_path(article_id)
    fd, temp_path = tempfile.mkstemp(
        prefix=f"{article_id}_edited_", suffix=".tmp", dir=store.data_dir
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(
                {"paper": paper, "saved_at": time.strftime("%Y-%m-%d %H:%M:%S")},
                stream,
                ensure_ascii=False,
                indent=2,
            )
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp_path, edited_path)
    except OSError:
        try:
            os.unlink(temp_path)
        except OSError:
            pass
        raise


def _validate_editor_value(value, depth: int = 0) -> None:
    """限制编辑 JSON 的体积和深度，避免任意嵌套数据进入磁盘。"""
    if depth > 8:
        raise HTTPException(422, "编辑数据嵌套层级过深")
    if isinstance(value, str) and len(value.encode("utf-8")) > _MAX_EDITOR_STRING_BYTES:
        raise HTTPException(422, "单个编辑字段过长")
    if isinstance(value, list):
        if len(value) > 2000:
            raise HTTPException(422, "编辑数组项目过多")
        for item in value:
            _validate_editor_value(item, depth + 1)
    elif isinstance(value, dict):
        if len(value) > 200:
            raise HTTPException(422, "编辑对象字段过多")
        for key, item in value.items():
            _validate_editor_value(key, depth + 1)
            _validate_editor_value(item, depth + 1)


def _localized_value(value, lang: str) -> str:
    if isinstance(value, dict):
        preferred = value.get(lang) or value.get("en") or value.get("zh") or ""
        return str(preferred)
    return str(value or "")


def _apply_editor_paper(article, paper: dict):
    """将编辑器 PaperData 的安全字段应用到 Article 渲染模型。"""
    if not paper:
        return article

    lang = "en" if article.lang == "en" else "zh"
    for field in ("journal", "doi", "volume", "year", "pages"):
        if field in paper and isinstance(paper[field], (str, int, float)):
            if field == "journal":
                article.journal = str(paper[field])
            elif field == "doi":
                article.doi = str(paper[field])
            elif field == "year" and str(paper[field]).isdigit():
                article.publication_year = int(str(paper[field]))

    title = paper.get("title")
    if isinstance(title, dict):
        article.title = _localized_value(title, lang)
    abstract = paper.get("abstract")
    if isinstance(abstract, dict):
        article.abstract = _localized_value(abstract, "zh")
        article.abstract_en = _localized_value(abstract, "en")
    keywords = paper.get("keywords")
    if isinstance(keywords, dict):
        article.keywords = [str(item) for item in keywords.get("zh", []) if isinstance(item, (str, int, float))]
        article.keywords_en = [str(item) for item in keywords.get("en", []) if isinstance(item, (str, int, float))]

    authors = paper.get("authors")
    if isinstance(authors, list):
        mapped_authors = []
        for item in authors:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or item.get("nameZh") or "").strip()
            parts = name.split()
            mapped_authors.append(Author(
                given_name=" ".join(parts[:-1]),
                surname=parts[-1] if parts else "",
                affiliation=str(item.get("affKeys") or ""),
                email=str(item.get("email") or ""),
            ))
        article.authors = mapped_authors

    affiliations = paper.get("affiliations")
    if isinstance(affiliations, list):
        article.affiliations = [
            Affiliation(id=str(item.get("key") or index), name=str(item.get("text") or item.get("textZh") or ""))
            for index, item in enumerate(affiliations, 1)
            if isinstance(item, dict)
        ]

    def walk_sections(sections):
        for section in sections:
            yield section
            yield from walk_sections(getattr(section, "subsections", []) or [])

    original_sections = list(walk_sections(getattr(article, "sections", []) or []))
    section_by_id = {}
    def index_sections(sections, prefix=""):
        for index, section in enumerate(sections, 1):
            number = f"{prefix}.{index}" if prefix else str(index)
            section_by_id[f"section-{number.replace('.', '-')}"] = section
            index_sections(getattr(section, "subsections", []) or [], number)
    index_sections(getattr(article, "sections", []) or [])
    for index, section in enumerate(original_sections, 1):
        if getattr(section, "id", ""):
            section_by_id[section.id] = section
    edited_sections = paper.get("sections")
    if isinstance(edited_sections, list):
        section_ids_by_object = {
            id(section): section_id
            for section_id, section in section_by_id.items()
        }
        desired_section_ids = {
            str(item.get("id") or "")
            for item in edited_sections
            if isinstance(item, dict) and item.get("id")
        }

        def section_paragraphs(content: str):
            return [
                Paragraph(runs=[Run(kind="text", text=text.strip())])
                for text in content.split("\n\n")
                if text.strip()
            ]

        def set_section_content(section, item):
            if "title" in item:
                section.title = _localized_value(item["title"], lang)
            if "content" not in item:
                return
            paragraphs = section_paragraphs(_localized_value(item["content"], lang))
            section.paragraphs = paragraphs
            if getattr(section, "blocks", None):
                paragraph_index = 0
                blocks = []
                for block in section.blocks:
                    if block.kind != "paragraph":
                        blocks.append(block)
                        continue
                    if paragraph_index < len(paragraphs):
                        blocks.append(ContentBlock(kind="paragraph", value=paragraphs[paragraph_index]))
                        paragraph_index += 1
                while paragraph_index < len(paragraphs):
                    blocks.append(ContentBlock(kind="paragraph", value=paragraphs[paragraph_index]))
                    paragraph_index += 1
                section.blocks = blocks

        for item in edited_sections:
            if not isinstance(item, dict):
                continue
            item_id = str(item.get("id") or "")
            section = section_by_id.get(item_id)
            if section is None:
                section = Section(
                    title=_localized_value(item.get("title", ""), lang),
                    level=1,
                    paragraphs=section_paragraphs(_localized_value(item.get("content", ""), lang)),
                )
                section_by_id[item_id] = section
                section_ids_by_object[id(section)] = item_id
                article.sections.append(section)
                if getattr(article, "blocks", None):
                    article.blocks.append(ContentBlock(kind="section", value=section))
            set_section_content(section, item)

        # The editor sends the complete section list. Removing a section in the
        # panel therefore also removes it from the server-side render model.
        keep_objects = set()

        def prune_sections(sections):
            kept = []
            for section in sections:
                generated_id = next(
                    (key for key, value in section_by_id.items() if value is section),
                    "",
                )
                explicit_id = getattr(section, "id", "")
                if generated_id not in desired_section_ids and explicit_id not in desired_section_ids:
                    continue
                keep_objects.add(id(section))
                section.subsections = prune_sections(getattr(section, "subsections", []) or [])
                kept.append(section)
            return kept

        article.sections = prune_sections(getattr(article, "sections", []) or [])
        if getattr(article, "blocks", None):
            article.blocks = [
                block for block in article.blocks
                if block.kind != "section" or id(block.value) in keep_objects
            ]

    all_sections = list(walk_sections(getattr(article, "sections", []) or []))
    section_by_id = {}
    index_sections(getattr(article, "sections", []) or [])
    for section in all_sections:
        if getattr(section, "id", ""):
            section_by_id[section.id] = section
    if isinstance(edited_sections, list):
        for section in all_sections:
            section_id = section_ids_by_object.get(id(section))
            if section_id:
                section_by_id[section_id] = section

    figures_by_id = {}
    tables_by_id = {}
    for container in [article, *all_sections, *original_sections]:
        for figure in getattr(container, "figures", []) or []:
            if figure.id:
                figures_by_id[figure.id] = figure
        for table in getattr(container, "tables", []) or []:
            if table.id:
                tables_by_id[table.id] = table

    def detach_blocks(kind: str):
        for container in [article, *all_sections]:
            if getattr(container, "blocks", None):
                container.blocks = [block for block in container.blocks if block.kind != kind]

    def attach_block(container, kind: str, value):
        if getattr(container, "blocks", None):
            container.blocks.append(ContentBlock(kind=kind, value=value))

    def positive_int(value, fallback):
        try:
            return max(1, int(value))
        except (TypeError, ValueError):
            return fallback

    edited_figures = paper.get("figures")
    if isinstance(edited_figures, list):
        detach_blocks("figure")
        for container in [article, *all_sections]:
            container.figures = []
        for index, item in enumerate(edited_figures, 1):
            if not isinstance(item, dict):
                continue
            figure_id = str(item.get("id") or f"figure-{index}")
            figure = figures_by_id.get(figure_id) or Figure(id=figure_id)
            figure.number = positive_int(item.get("number"), index)
            figure.caption = _localized_value(item.get("caption", figure.caption), lang)
            if isinstance(item.get("src"), str):
                figure.graphic_href = item["src"]
            figure.label = "Figure " + str(figure.number) if article.lang == "en" else "图" + str(figure.number)
            section = section_by_id.get(str(item.get("sectionId") or ""))
            if section is not None:
                section.figures.append(figure)
                attach_block(section, "figure", figure)
            else:
                article.figures.append(figure)
                attach_block(article, "figure", figure)

    def map_cells(rows, force_header=False):
        result = []
        for row in rows if isinstance(rows, list) else []:
            if not isinstance(row, list):
                continue
            result.append([
                TableCell(
                    text=str(cell.get("text") or "") if isinstance(cell, dict) else str(cell),
                    colspan=positive_int(cell.get("colspan", 1), 1) if isinstance(cell, dict) else 1,
                    rowspan=positive_int(cell.get("rowspan", 1), 1) if isinstance(cell, dict) else 1,
                    is_header=force_header or bool(cell.get("isHeader")) if isinstance(cell, dict) else force_header,
                    align=str(cell.get("align") or "") if isinstance(cell, dict) else "",
                ) for cell in row
            ])
        return result

    edited_tables = paper.get("tables")
    if isinstance(edited_tables, list):
        detach_blocks("table")
        for container in [article, *all_sections]:
            container.tables = []
        for index, item in enumerate(edited_tables, 1):
            if not isinstance(item, dict):
                continue
            table_id = str(item.get("id") or f"table-{index}")
            table = tables_by_id.get(table_id) or Table(id=table_id)
            table.number = positive_int(item.get("number"), index)
            table.caption = _localized_value(item.get("caption", table.caption), lang)
            if "headerRows" in item or "bodyRows" in item:
                table.header_rows = map_cells(item.get("headerRows", []), force_header=True)
                table.body_rows = map_cells(item.get("bodyRows", []))
                table.headers = [cell.text for row in table.header_rows for cell in row]
                table.rows = [[cell.text for cell in row] for row in table.body_rows]
            elif "headers" in item or "rows" in item:
                table.headers = [str(value) for value in item.get("headers", []) if isinstance(value, (str, int, float))]
                table.rows = [
                    [str(value) for value in row.get("cells", [])]
                    for row in item.get("rows", [])
                    if isinstance(row, dict) and isinstance(row.get("cells"), list)
                ]
                table.header_rows = []
                table.body_rows = []
            table.footnotes = [str(note) for note in item.get("footnotes", []) if isinstance(note, (str, int, float))]
            section = section_by_id.get(str(item.get("sectionId") or ""))
            if section is not None:
                section.tables.append(table)
                attach_block(section, "table", table)
            else:
                article.tables.append(table)
                attach_block(article, "table", table)

    references = paper.get("references")
    if isinstance(references, list):
        mapped_refs = []
        for index, value in enumerate(references, 1):
            ref = article.references[index - 1] if index <= len(article.references) else Reference(id=f"ref-{index}")
            ref.authors = ""
            ref.journal = ""
            ref.doi = ""
            ref.title = str(value or "")
            mapped_refs.append(ref)
        article.references = mapped_refs
    return article


def _load_effective_article(article_id: str):
    article = _load_article(article_id)
    return _apply_editor_paper(article, _read_edited_paper(article_id))


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


def _image_name_from_href(href: str) -> str:
    """从 JATS 图片引用中提取真实文件名，兼容 URL 编码路径。"""
    path = urllib.parse.urlparse(str(href or "")).path
    return os.path.basename(urllib.parse.unquote(path))


def _cache_pmc_image(pmcid: str, filename: str) -> str:
    """把可信 PMC CDN 图片下载到本地缓存，后续直接由本服务返回。"""
    pmcid = pmcid.upper()
    if not re.fullmatch(r"PMC\d+", pmcid):
        return ""
    safe_name = _image_name_from_href(filename)
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
    with _formula_lock:
        if article_id in _formula_cache:
            return
        try:
            from .renderer.formula_renderer import FormulaRenderer
            article = store.get_article(article_id)
            if article is None:
                return
            FormulaRenderer(method="auto").process_article_formulas(article)
            pickle_path = os.path.join(store.data_dir, f"{article_id}.pkl")
            fd, temp_path = tempfile.mkstemp(prefix=f".{article_id}.formula.", suffix=".tmp", dir=store.data_dir)
            try:
                with os.fdopen(fd, "wb") as stream:
                    pickle.dump(article, stream, protocol=pickle.HIGHEST_PROTOCOL)
                    stream.flush()
                    os.fsync(stream.fileno())
                os.replace(temp_path, pickle_path)
            finally:
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
            _formula_cache.add(article_id)
        except Exception as e:
            print(f"[server] 公式预渲染失败 {article_id}: {e}")

def _get_settings(
    ref_style: str = "elsevier",
    two_column: bool = False,
    font_style: str = "academic",
    font_size: str = "medium",
    page_size: str = "a4",
):
    """解析渲染参数"""
    if font_style not in {"academic", "modern", "international"}:
        font_style = "academic"
    if font_size not in {"small", "medium", "large"}:
        font_size = "medium"
    if page_size not in {"a4", "letter"}:
        page_size = "a4"
    return {
        "ref_style": ref_style,
        "two_column": two_column,
        "font_style": font_style,
        "font_size": font_size,
        "page_size": page_size,
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
        page_size=settings.get("page_size", "a4"),
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
        page_size=settings.get("page_size", "a4"),
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
    safe_name = _image_name_from_href(href)
    if not safe_name:
        return ""

    candidates = []
    if _ARTICLE_ID_RE.fullmatch(article_id):
        article_asset = _contained_path(_ARTICLE_ASSET_DIR, article_id, safe_name)
        if article_asset:
            candidates.append(article_asset)
    for search_dir in _IMAGE_SEARCH_DIRS:
        candidate = _contained_path(search_dir, safe_name)
        if candidate:
            candidates.append(candidate)
        if not href.startswith(("http://", "https://", "//")):
            candidate = _contained_path(search_dir, href)
            if candidate:
                candidates.append(candidate)
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
        safe_name = _image_name_from_href(figure.graphic_href or "")
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


@app.get("/samples", response_class=HTMLResponse)
@app.get("/samples/", response_class=HTMLResponse)
@app.get("/samples/{rest:path}", response_class=HTMLResponse)
async def page_samples(request: Request):
    """让生产环境的 React Router 也能直接打开样例深层链接。"""
    if is_dev():
        return RedirectResponse(f"{PORTAL_DEV_URL}{request.url.path}", status_code=307)
    if os.path.isfile(WEB_INDEX):
        return FileResponse(WEB_INDEX, media_type="text/html")
    return RedirectResponse("/", status_code=307)


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
    page_size: str = Query("a4"),
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
    article = _load_effective_article(article_id)
    article.id = article_id
    settings = _get_settings(ref_style, two_column, font_style, font_size, page_size)
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


def _write_bytes(path: str, content: bytes) -> None:
    with open(path, "wb") as target:
        target.write(content)


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
            await asyncio.to_thread(_write_bytes, source_path, content)
            xml_path, assets_dir = await asyncio.to_thread(_extract_zip_bundle, content, temp_dir)
        else:
            source_path = xml_path = os.path.join(temp_dir, "article.xml")
            await asyncio.to_thread(_write_bytes, xml_path, content)

        article = await asyncio.to_thread(JATSParser(xml_path).parse)

        article_id = await asyncio.to_thread(
            store.add_article,
            article,
            filename,
            "upload_bundle" if is_zip else "upload",
            source_path,
        )
        article.id = article_id
        if assets_dir:
            await asyncio.to_thread(_store_article_assets, article_id, assets_dir)

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
    return await asyncio.to_thread(
        store.list_articles,
        page=page,
        per_page=per_page,
        search=search,
        field=field,
        year=year,
    )


@app.get("/api/articles/{article_id}")
async def api_get_article(article_id: str):
    """获取文章详情（JSON + 渲染 HTML）"""
    article = await asyncio.to_thread(_load_article, article_id)
    await asyncio.to_thread(_render_formulas, article_id)
    article = await asyncio.to_thread(_load_effective_article, article_id)
    article.id = article_id

    settings = _get_settings()
    html = await asyncio.to_thread(_render_article_html, article, settings)

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
    article = await asyncio.to_thread(_load_article, article_id)
    article.id = article_id
    payload = await asyncio.to_thread(_article_editor_payload, article, article_id)

    saved_paper = await asyncio.to_thread(_read_edited_paper, article_id)
    if saved_paper:
        _deep_merge(payload.get("paper", {}), saved_paper)

    return JSONResponse(payload)


@app.put("/api/articles/{article_id}/editor")
async def api_update_editor_article(article_id: str, paper: dict | None = None):
    """保存 React 文章编辑器的修改内容。
    编辑数据存储为 JSON，不影响原始 JATS 解析结果。"""
    _validate_article_id(article_id)
    # 验证文章存在
    try:
        await asyncio.to_thread(_load_article, article_id)
    except HTTPException as exc:
        if exc.status_code == 400:
            raise
        raise HTTPException(404, f"文章不存在: {article_id}")

    if paper is None:
        paper = {}
    # The React editor sends {"paper": PaperData}; accept a raw PaperData body
    # as well so API clients do not need to duplicate the transport wrapper.
    if set(paper) == {"paper"} and isinstance(paper.get("paper"), dict):
        paper = paper["paper"]
    _validate_editor_value(paper)
    if len(json.dumps(paper, ensure_ascii=False).encode("utf-8")) > _MAX_EDITOR_JSON_BYTES:
        raise HTTPException(413, "编辑内容不能超过 2 MB")

    try:
        await asyncio.to_thread(_write_edited_paper, article_id, paper)
    except OSError:
        raise HTTPException(500, "编辑内容保存失败")

    return JSONResponse({"status": "ok", "article_id": article_id})


@app.get("/api/articles/{article_id}/preview")
async def api_preview(
    article_id: str,
    ref_style: str = Query("elsevier"),
    two_column: bool = Query(False),
    font_size: str = Query("medium"),
    font_style: str = Query("academic"),
    page_size: str = Query("a4"),
):
    """获取 iframe 预览 HTML（使用干净模板，无导航/页脚）"""
    article = await asyncio.to_thread(_load_article, article_id)
    await asyncio.to_thread(_render_formulas, article_id)
    article = await asyncio.to_thread(_load_effective_article, article_id)
    article.id = article_id

    settings = _get_settings(ref_style, two_column, font_style, font_size, page_size)
    return HTMLResponse(await asyncio.to_thread(_render_preview_html, article, settings))


@app.get("/api/articles/{article_id}/html")
async def api_download_html(
    article_id: str,
    ref_style: str = Query("elsevier"),
    two_column: bool = Query(False),
    font_style: str = Query("academic"),
    font_size: str = Query("medium"),
    page_size: str = Query("a4"),
):
    """下载独立 HTML 文件"""
    article = await asyncio.to_thread(_load_article, article_id)
    await asyncio.to_thread(_render_formulas, article_id)
    article = await asyncio.to_thread(_load_effective_article, article_id)
    article.id = article_id

    settings = _get_settings(ref_style, two_column, font_style, font_size, page_size)
    html = await asyncio.to_thread(_render_preview_html, article, settings)

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
    page_size: str = Query("a4"),
):
    """生成并下载 PDF"""
    article = await asyncio.to_thread(_load_article, article_id)
    await asyncio.to_thread(_render_formulas, article_id)
    article = await asyncio.to_thread(_load_effective_article, article_id)
    article.id = article_id

    settings = _get_settings(ref_style, two_column, font_style, font_size, page_size)
    embedded_images = await asyncio.to_thread(_embed_article_images, article, article_id)
    html = await asyncio.to_thread(_render_preview_html, article, settings)

    try:
        from .renderer.pdf_renderer import PDFRenderer
        # article_preview.html 已包含与屏幕预览完全相同的自包含 CSS；
        # 不再叠加旧 styles.css，否则会重新引入卡片、跨栏等冲突规则。
        pdf_renderer = PDFRenderer(css_path="")
        pdf_bytes = await asyncio.to_thread(pdf_renderer.render_to_bytes, html)
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
    return await asyncio.to_thread(store.get_filter_values)


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

    if article_id:
        _validate_article_id(article_id)
        article_asset = _contained_path(_ARTICLE_ASSET_DIR, article_id, safe_name)
        if os.path.isfile(article_asset):
            media_type, _ = mimetypes.guess_type(article_asset)
            return FileResponse(
                article_asset,
                media_type=media_type or "application/octet-stream",
            )

    for search_dir in _IMAGE_SEARCH_DIRS:
        filepath = _contained_path(search_dir, safe_name)
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
