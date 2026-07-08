"""
HTML 渲染器 v3.0：支持多页面平台渲染
=============================
将 Article 数据 + 页面模板 → 自包含 HTML 网页
支持页面类型: article(论文详情) / index(首页) / browse(浏览) / upload(上传) / about(关于)
"""

import os
from jinja2 import Environment, FileSystemLoader
from ..parser.jats_parser import Article

_TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")
_ASSETS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "assets")


class HTMLRenderer:
    """多页面平台渲染器"""

    def __init__(self, template_dir: str = _TEMPLATE_DIR):
        self.template_dir = template_dir
        self.env = Environment(
            loader=FileSystemLoader(template_dir),
            autoescape=False,
            trim_blocks=True,
            lstrip_blocks=True,
        )
        self.env.filters["orcid_url"] = lambda o: f"https://orcid.org/{o}" if o else "#"

    def _read_css(self) -> str:
        """读取 platform.css"""
        css_path = os.path.join(_ASSETS_DIR, "css", "platform.css")
        if os.path.exists(css_path):
            with open(css_path, "r", encoding="utf-8") as f:
                return f.read()
        return ""

    def _read_js(self) -> str:
        """读取 platform.js"""
        js_path = os.path.join(_ASSETS_DIR, "js", "platform.js")
        if os.path.exists(js_path):
            with open(js_path, "r", encoding="utf-8") as f:
                return f.read()
        return ""

    def _render_page(self, template_name: str, context: dict) -> str:
        """渲染完整页面（base模板 + 内嵌CSS/JS）"""
        css = self._read_css()
        js = self._read_js()
        template = self.env.get_template(template_name)
        return template.render(inline_css=css, inline_js=js, **context)

    # ── 各页面渲染方法 ──

    def render_article(self, article: Article) -> str:
        """渲染论文详情页"""
        return self._render_page("article.html", {
            "article": article,
            "has_authors": bool(article.authors),
            "has_keywords": bool(article.keywords),
            "has_references": bool(article.references),
            "active_page": "browse",
            "journal_name": article.journal or None,
        })

    def render_index(self, articles: list[Article], journal_name: str = "") -> str:
        """渲染首页（带论文卡片列表）"""
        return self._render_page("index.html", {
            "articles": articles,
            "journal_name": journal_name,
            "active_page": "index",
        })

    def render_browse(self, articles: list[Article], journal_name: str = "") -> str:
        """渲染论文浏览页"""
        return self._render_page("browse.html", {
            "articles": articles,
            "journal_name": journal_name,
            "active_page": "browse",
        })

    def render_upload(self, journal_name: str = "") -> str:
        """渲染上传转换页"""
        return self._render_page("upload.html", {
            "journal_name": journal_name,
            "active_page": "upload",
        })

    def render_about(self, journal_name: str = "") -> str:
        """渲染关于页"""
        return self._render_page("about.html", {
            "journal_name": journal_name,
            "active_page": "about",
        })
