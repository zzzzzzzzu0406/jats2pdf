"""
全局配置模块
============
单一配置来源，读取环境变量并导出项目路径、模式标识等。

环境变量:
    JATS2PDF_DEV    设为 "true" 开启开发模式（默认 false）
"""

import os

# ── 模式 ──────────────────────────────────────

_is_dev = os.environ.get("JATS2PDF_DEV", "").strip().lower() in ("1", "true", "yes", "on")


def is_dev() -> bool:
    """开发模式：前端由 Vite dev server 提供，支持 HMR。"""
    return _is_dev


def is_prod() -> bool:
    """生产模式：前端由 FastAPI serve 预构建的 dist/ 文件。"""
    return not _is_dev


# ── 项目路径 ──────────────────────────────────

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_SRC_DIR = os.path.dirname(os.path.abspath(__file__))

TEMPLATE_DIR = os.path.join(_SRC_DIR, "templates")

WEB_DIST = os.path.join(_PROJECT_ROOT, "web", "dist")
WEB_INDEX = os.path.join(WEB_DIST, "index.html")
WEB_ASSETS = os.path.join(WEB_DIST, "assets")

# 兼容旧路径
PORTAL_DIST = WEB_DIST
PORTAL_INDEX = WEB_INDEX
PORTAL_ASSETS = WEB_ASSETS
STUDIO_DIST = WEB_DIST
STUDIO_INDEX = WEB_INDEX
STUDIO_ASSETS = WEB_ASSETS

# 样本文件和图片搜索路径
SAMPLE_DIRS = [
    os.path.join(_PROJECT_ROOT, "samples", "output"),
    os.path.join(_PROJECT_ROOT, "samples", "real"),
    os.path.join(_PROJECT_ROOT, "samples"),
]

DATA_DIR = os.path.join(_PROJECT_ROOT, "data")
PMC_ASSET_DIR = os.path.join(DATA_DIR, "pmc_assets")
ARTICLE_ASSET_DIR = os.path.join(DATA_DIR, "article_assets")

# ── Vite 开发服务器 URL（内部端口，不直接访问）────

WEB_DEV_URL = "http://127.0.0.1:5173"
PORTAL_DEV_URL = WEB_DEV_URL
STUDIO_DEV_URL = WEB_DEV_URL


def startup_banner() -> str:
    """返回启动时打印的横幅信息。"""
    if is_dev():
        return (
            "\n"
            "╔══════════════════════════════════════════════╗\n"
            "║  JATS2PDF 开发模式 (JATS2PDF_DEV=true)       ║\n"
            "║                                              ║\n"
            "║  请确保已启动 Vite dev server:               ║\n"
            "║    npm run web:dev                            ║\n"
            "║                                              ║\n"
            "║  后端 API: http://127.0.0.1:8000/            ║\n"
            "║  前端:     http://127.0.0.1:5173/            ║\n"
            "╚══════════════════════════════════════════════╝\n"
        )
    else:
        return (
            "\n"
            "╔══════════════════════════════════════════════╗\n"
            "║  JATS2PDF 运行中                             ║\n"
            "║  http://127.0.0.1:8000/                      ║\n"
            "║  (设置 JATS2PDF_DEV=true 开启开发模式)       ║\n"
            "╚══════════════════════════════════════════════╝\n"
        )
