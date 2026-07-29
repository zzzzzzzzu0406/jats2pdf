"""
PDF 渲染器：将 HTML 字符串 → 最终 PDF 文件

这是整个流水线的第三步：HTML → PDF

渲染引擎选择（自动）：
  1. 优先 WeasyPrint —— 支持 CSS Paged Media，排版能力最强。
  2. 若 WeasyPrint 因缺少系统 GTK 库而无法导入（macOS 上常见，需
     `brew install pango`），自动回退到系统已安装的 Chromium 内核浏览器
     （Google Chrome / Edge / Brave / Chromium 均可）headless 打印 PDF。
     这条回退路径无需 Homebrew、无需 GTK、零额外下载，只要机器上装了
     Chromium 内核浏览器即可。
"""

import os
import io
import contextlib
import logging
import shutil
import subprocess
import tempfile
from typing import Optional

logger = logging.getLogger(__name__)

# ── 尝试加载 WeasyPrint；失败则进入 Chrome 回退路径 ──
# 导入期 weasyprint 缺 GTK 库时，ffi.py 用 print() 往 stdout 打印一大段安装指引，
# 看着像“生成失败”。这里捕获丢弃，仅在失败时保留异常对象供日志摘要。
HTML = CSS = None
_HAS_WEASYPRINT = False
_WEASYPRINT_IMPORT_ERROR: Optional[Exception] = None
_silence = io.StringIO()
try:
    with contextlib.redirect_stdout(_silence), contextlib.redirect_stderr(_silence):
        from weasyprint import HTML, CSS  # noqa: E402
    _HAS_WEASYPRINT = True
except Exception as e:  # noqa: BLE001  环境缺库时 weasyprint 在 import 期即抛 OSError
    _WEASYPRINT_IMPORT_ERROR = e


# macOS / Linux 上 Chromium 内核浏览器的常见安装路径
_CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
]


def _find_chrome() -> Optional[str]:
    """定位可用的 Chromium 内核浏览器可执行文件，找不到返回 None。"""
    # 1) 环境变量显式指定
    env = os.environ.get("JATS2PDF_CHROME") or os.environ.get("PUPPETEER_EXECUTABLE_PATH")
    if env and os.path.exists(env):
        return env
    # 2) 常见安装路径
    for p in _CHROME_CANDIDATES:
        if os.path.exists(p):
            return p
    # 3) PATH 中的常见命令名
    for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome"):
        found = shutil.which(name)
        if found:
            return found
    return None


def _chrome_render_to_file(
    html_content: str,
    output_path: str,
    css_path: Optional[str] = None,
    base_url: Optional[str] = None,
) -> str:
    """用 Chrome headless 把 HTML 打印成 PDF 文件。"""
    chrome = _find_chrome()
    if not chrome:
        raise RuntimeError(
            "WeasyPrint 不可用（缺少系统 GTK 库），且未找到 Chrome/Chromium/Edge 浏览器。\n"
            "两种方式任选其一：\n"
            "  1) 安装 Homebrew 后 `brew install pango` 启用 WeasyPrint；\n"
            "  2) 安装任意 Chromium 内核浏览器（Google Chrome / Edge / Brave / Chromium）。\n"
            "或用环境变量 JATS2PDF_CHROME 指定浏览器可执行文件路径。"
        )

    # 与 WeasyPrint 路径一致：把打印样式表注入 HTML（若提供且存在）
    style_tag = ""
    if css_path and os.path.exists(css_path):
        with open(css_path, "r", encoding="utf-8") as f:
            style_tag = f'<style type="text/css">\n{f.read()}\n</style>\n'
    if "</head>" in html_content:
        styled = html_content.replace("</head>", f"{style_tag}</head>", 1)
    elif style_tag:
        styled = style_tag + html_content
    else:
        styled = html_content

    # 把临时 HTML 写到 base_url 目录（若有），以保证 HTML 内相对资源可解析；
    # 否则写进临时目录。HTML 通常是自包含的（CSS/JS 已内联）。
    work_dir = base_url if (base_url and os.path.isdir(base_url)) else None
    cleanup = False
    if work_dir:
        html_file = os.path.join(work_dir, ".jats2pdf_tmp.html")
    else:
        work_dir = tempfile.mkdtemp(prefix="jats2pdf_")
        html_file = os.path.join(work_dir, "doc.html")
        cleanup = True
    try:
        with open(html_file, "w", encoding="utf-8") as f:
            f.write(styled)
        file_url = "file://" + os.path.abspath(html_file)
        cmd = [
            chrome, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
            "--virtual-time-budget=5000",
            f"--print-to-pdf={output_path}", file_url,
        ]
        logger.info(f"使用 Chrome headless 生成 PDF: {chrome}")
        proc = subprocess.run(cmd, capture_output=True, text=True)
        if proc.returncode != 0 or not os.path.exists(output_path):
            raise RuntimeError(
                f"Chrome headless 打印失败(exit={proc.returncode}):\n{proc.stderr.strip()[:800]}"
            )
        logger.info(f"PDF 生成成功(Chrome): {output_path}")
        return output_path
    finally:
        try:
            if os.path.exists(html_file):
                os.remove(html_file)
            if cleanup:
                shutil.rmtree(work_dir, ignore_errors=True)
        except OSError:
            pass


class PDFRenderer:
    """将 HTML 渲染为 PDF：优先 WeasyPrint，缺 GTK 时自动回退到 Chrome headless。"""

    def __init__(self, css_path: Optional[str] = None):
        """
        Args:
            css_path: 自定义 CSS 文件路径；不传则使用默认样式。
                传空字符串表示 HTML 已自包含完整样式，不再叠加外部 CSS。
        """
        self.css_path = self._default_css() if css_path is None else css_path

    @staticmethod
    def _default_css() -> str:
        """默认 CSS 路径"""
        return os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "templates",
            "styles.css",
        )

    def render_to_file(
        self,
        html_content: str,
        output_path: str,
        base_url: Optional[str] = None,
    ) -> str:
        """
        将 HTML 内容渲染为 PDF 文件

        Args:
            html_content: 完整 HTML 文档字符串
            output_path: 输出 PDF 路径
            base_url: HTML 中相对路径的基 URL（如图片、CSS引用）

        Returns:
            生成的 PDF 文件路径
        """
        if base_url is None:
            base_url = os.path.dirname(output_path)

        if _HAS_WEASYPRINT:
            try:
                html = HTML(string=html_content, base_url=base_url)
                css = CSS(filename=self.css_path) if os.path.exists(self.css_path) else None
                doc = html.render(stylesheets=[css] if css else [])
                doc.write_pdf(output_path)
                logger.info(f"PDF 生成成功(WeasyPrint): {output_path}")
                return output_path
            except Exception as e:
                logger.warning(
                    f"WeasyPrint 运行失败({e})，回退到 Chrome headless"
                )
        else:
            logger.warning(
                f"WeasyPrint 不可用({_WEASYPRINT_IMPORT_ERROR.__class__.__name__})，"
                f"回退到 Chrome headless 渲染"
            )

        return _chrome_render_to_file(html_content, output_path, self.css_path, base_url)

    def render_to_bytes(
        self,
        html_content: str,
        base_url: Optional[str] = None,
    ) -> bytes:
        """
        将 HTML 内容渲染为 PDF 并返回字节数据。

        base_url 用于解析仍存在的相对资源；Web 服务会优先把文章图片内嵌为
        data URI，因此即使渲染器运行在独立进程中也不会丢图。
        """
        if _HAS_WEASYPRINT:
            try:
                html = HTML(string=html_content, base_url=base_url)
                css = CSS(filename=self.css_path) if os.path.exists(self.css_path) else None
                doc = html.render(stylesheets=[css] if css else [])
                return doc.write_pdf()
            except Exception as e:
                logger.warning("WeasyPrint 运行失败(%s)，回退到 Chrome headless", e)
        # Chrome 回退：写临时文件再读回
        with tempfile.TemporaryDirectory(prefix="jats2pdf_") as td:
            tmp_pdf = os.path.join(td, "out.pdf")
            _chrome_render_to_file(html_content, tmp_pdf, self.css_path, base_url)
            with open(tmp_pdf, "rb") as f:
                return f.read()
