"""
统一的 Jinja2 环境
==================
提取 server.py 和 html_renderer.py 中重复的 Jinja2 配置，
共享同一个 Environment 实例和过滤器注册。
"""

import os
import re
import urllib.parse
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, pass_context, select_autoescape

from .config import TEMPLATE_DIR

# ── 单例 Environment ───────────────────────────

_env: Environment | None = None


def get_jinja_env() -> Environment:
    """获取（或创建）共享的 Jinja2 环境实例。"""
    global _env
    if _env is not None:
        return _env

    _env = Environment(
        loader=FileSystemLoader(TEMPLATE_DIR),
        autoescape=select_autoescape(enabled_extensions=("html", "xml")),
        trim_blocks=True,
        lstrip_blocks=True,
    )

    # ── 过滤器注册 ──────────────────────────────

    _env.filters["orcid_url"] = lambda orcid: f"https://orcid.org/{orcid}" if orcid else ""

    @pass_context
    def _resolve_image(context, href: str) -> str:
        """将 graphic_href 解析为可用的图片 URL。

        支持多种模式（通过模板 context 控制）:
        - data: URI → 原样返回
        - http/https URL → 检查 allow_remote_assets，否则返回 ""
        - local 模式 → 通过 asset_base 解析为 file:// URI
        - web 模式 → 解析为 /api/files/{basename}?...
        - 空字符串 → 原样返回
        """
        if not href:
            return href
        if href.startswith("data:"):
            return href
        if href.startswith(("http://", "https://", "//")):
            return href if context.get("allow_remote_assets", False) else ""

        # 本地模式：解析为 file:// URI（CLI/测试用）
        asset_mode = context.get("asset_mode", "web")
        asset_base = context.get("asset_base")
        if asset_mode == "local" and asset_base:
            base = Path(asset_base).resolve()
            local_href = urllib.parse.unquote(urllib.parse.urlparse(href).path)
            candidate = (base / local_href).resolve()
            if candidate.is_file() and (candidate == base or base in candidate.parents):
                return candidate.as_uri()
            return href

        # Web 模式：/api/files/{basename}?...（默认）
        image_path = urllib.parse.urlparse(href).path
        safe = urllib.parse.quote(os.path.basename(urllib.parse.unquote(image_path)), safe="")
        if safe:
            article = context.get("article")
            pmcid = str(getattr(article, "pmcid", "") or "").upper()
            article_id = str(getattr(article, "id", "") or "")
            params: dict[str, str] = {}
            if re.fullmatch(r"[0-9a-f]{8}", article_id):
                params["article_id"] = article_id
            if re.fullmatch(r"PMC\d+", pmcid):
                params["pmcid"] = pmcid
            suffix = f"?{urllib.parse.urlencode(params)}" if params else ""
            return f"/api/files/{safe}{suffix}"
        return href

    _env.filters["resolve_image"] = _resolve_image

    return _env
