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

import mimetypes
import os
import pickle
import tempfile
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, UploadFile, Query, HTTPException
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response

from .parser.jats_parser import JATSParser
from .renderer.html_renderer import HTMLRenderer
from .store import ArticleStore
from jinja2 import Environment, FileSystemLoader

# ── Jinja2 环境（复用模板目录）──
_TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "templates")
_jinja_env = Environment(loader=FileSystemLoader(_TEMPLATE_DIR))
_jinja_env.filters["orcid_url"] = lambda orcid: f"https://orcid.org/{orcid}" if orcid else ""


def _resolve_image_path(href: str) -> str:
    """将 graphic_href 解析为可用的图片 URL。
    - 绝对 URL (http/https/data:) → 原样返回
    - 相对路径 (如 arch.svg) → /api/files/{basename}
    - 空字符串 → 原样返回
    """
    if not href:
        return href
    if href.startswith(("http://", "https://", "data:", "//")):
        return href
    safe = os.path.basename(href)
    return f"/api/files/{safe}" if safe else href


_jinja_env.filters["resolve_image"] = _resolve_image_path

# ── 全局实例 ──────────────────────────────────

store = ArticleStore()
html_renderer = HTMLRenderer()

# 公式预渲染缓存：article_id → bool（是否已处理）
_formula_cache: set = set()

# 图片文件搜索目录（按优先级排列）
_IMAGE_SEARCH_DIRS = [
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "samples", "output"),
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "samples", "real"),
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "samples"),
]

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
    return article

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
    html = html_renderer.render_article(article, ref_style=settings["ref_style"])
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

    # 直接用模板渲染，传入 two_column 供工具栏使用
    has_authors = len(article.authors) > 0
    has_keywords = bool(article.keywords or article.keywords_en)
    has_references = len(article.references) > 0

    template = _jinja_env.get_template("article.html")
    html = template.render(
        article=article,
        has_authors=has_authors,
        has_keywords=has_keywords,
        has_references=has_references,
        active_page="browse",
        journal_name=article.journal or "学术期刊优化平台",
        ref_style=settings["ref_style"],
        two_column=settings["two_column"],
        inline_css=html_renderer._read_css(),
        inline_js=html_renderer._read_js(),
    )

    if settings["two_column"]:
        html = html.replace("<body>", '<body class="two-column">', 1)
    return html

@app.get("/about", response_class=HTMLResponse)
async def page_about():
    return html_renderer.render_about(journal_name="学术期刊优化平台")

# ── API 路由 ──────────────────────────────────

@app.post("/api/upload")
async def api_upload(file: UploadFile = File(...)):
    """上传 JATS XML，解析并存储"""
    if not file.filename.endswith(".xml"):
        raise HTTPException(400, "仅支持 .xml 格式的 JATS 文件")

    try:
        content = await file.read()
        # 写入临时文件供 lxml 解析
        with tempfile.NamedTemporaryFile(suffix=".xml", delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        article = JATSParser(tmp_path).parse()
        os.unlink(tmp_path)

        article_id = store.add_article(
            article,
            filename=file.filename,
            source="upload",
            filepath="",  # 已删除临时文件
        )
        article.id = article_id

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
        })

    except Exception as e:
        raise HTTPException(400, f"XML 解析失败: {str(e)}")


@app.get("/api/articles")
async def api_list_articles(
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=50),
    search: str = Query(""),
    field: str = Query(""),
    year: str = Query(""),
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
async def api_serve_file(filename: str):
    """提供静态图片文件。在已知目录中搜索，使用 basename 防止路径遍历。"""
    safe_name = os.path.basename(filename)
    if not safe_name:
        raise HTTPException(404, "无效文件名")

    for search_dir in _IMAGE_SEARCH_DIRS:
        filepath = os.path.join(search_dir, safe_name)
        if os.path.isfile(filepath):
            media_type, _ = mimetypes.guess_type(filepath)
            return FileResponse(filepath, media_type=media_type or "application/octet-stream")

    raise HTTPException(404, f"文件未找到: {safe_name}")


# ── 健康检查 ──────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok"}


# ── 直接运行入口 ──────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.server:app", host="0.0.0.0", port=8000, reload=True)
