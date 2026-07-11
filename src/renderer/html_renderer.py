"""
HTML 渲染器 v3.0：支持多页面平台渲染
=============================
将 Article 数据 + 页面模板 → 自包含 HTML 网页
支持页面类型: article(论文详情) / index(首页) / browse(浏览) / upload(上传) / about(关于)
"""

import os
import re
import urllib.parse
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, pass_context, select_autoescape
from ..parser.jats_parser import Article

_TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")
_ASSETS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "assets")


class HTMLRenderer:
    """多页面平台渲染器"""

    def __init__(self, template_dir: str = _TEMPLATE_DIR):
        self.template_dir = template_dir
        self.env = Environment(
            loader=FileSystemLoader(template_dir),
            autoescape=select_autoescape(enabled_extensions=("html", "xml")),
            trim_blocks=True,
            lstrip_blocks=True,
        )
        self.env.filters["orcid_url"] = lambda o: f"https://orcid.org/{o}" if o else "#"

        @pass_context
        def _resolve_image(context, href: str) -> str:
            if not href:
                return href
            if href.startswith("data:"):
                return href
            if href.startswith(("http://", "https://", "//")):
                return href if context.get("allow_remote_assets", False) else ""

            asset_mode = context.get("asset_mode", "local")
            asset_base = context.get("asset_base")
            if asset_mode == "local" and asset_base:
                base = Path(asset_base).resolve()
                candidate = (base / href).resolve()
                if candidate.is_file() and (candidate == base or base in candidate.parents):
                    return candidate.as_uri()
                return href

            safe = os.path.basename(href)
            if asset_mode == "web" and safe:
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
            return href

        self.env.filters["resolve_image"] = _resolve_image

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

    # ── 通用入口（CLI / 测试使用） ──

    def render(
        self,
        article: Article,
        ref_style: str = "elsevier",
        font_style: str = "academic",
        font_size: str = "medium",
        asset_mode: str = "local",
        asset_base: str | None = None,
    ) -> str:
        """渲染单篇论文为自包含 HTML。

        v3.0 重构后渲染器拆分为多页面方法（render_article/render_index/...），
        此方法作为 CLI（main.py）与单元测试的统一入口，转发到论文详情页。
        ref_style: 参考文献格式，elsevier（默认）或 gbt7714。
        """
        return self.render_article(
            article,
            ref_style=ref_style,
            font_style=font_style,
            font_size=font_size,
            asset_mode=asset_mode,
            asset_base=asset_base,
        )

    # ── 各页面渲染方法 ──

    def render_article(
        self,
        article: Article,
        ref_style: str = "elsevier",
        two_column: bool = False,
        font_style: str = "academic",
        font_size: str = "medium",
        asset_mode: str = "local",
        asset_base: str | None = None,
    ) -> str:
        """渲染论文详情页"""
        if font_style not in {"academic", "modern", "international"}:
            font_style = "academic"
        if font_size not in {"small", "medium", "large"}:
            font_size = "medium"
        return self._render_page("article.html", {
            "article": article,
            "has_authors": bool(article.authors),
            "has_keywords": bool(article.keywords),
            "has_references": bool(article.references),
            "active_page": "browse",
            "journal_name": article.journal or None,
            "ref_style": ref_style,
            "two_column": two_column,
            "font_style": font_style,
            "font_size": font_size,
            "asset_mode": asset_mode,
            "asset_base": asset_base,
            "allow_remote_assets": False,
            "citation_authors": ", ".join(
                f"{author.surname}{author.given_name}" for author in article.authors[:3]
            ),
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
