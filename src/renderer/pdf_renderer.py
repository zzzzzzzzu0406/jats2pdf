"""
PDF 渲染器：将 HTML 字符串 → 最终 PDF 文件

这是整个流水线的第三步：HTML → PDF
使用 WeasyPrint 作为渲染引擎，支持 CSS Paged Media 进行排版控制
"""

import os
import logging
from weasyprint import HTML, CSS
from typing import Optional

logger = logging.getLogger(__name__)


class PDFRenderer:
    """通过 WeasyPrint 将 HTML 渲染为 PDF"""

    def __init__(self, css_path: Optional[str] = None):
        """
        Args:
            css_path: 自定义 CSS 文件路径，不传则使用默认样式
        """
        self.css_path = css_path or self._default_css()

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

        try:
            html = HTML(string=html_content, base_url=base_url)
            css = CSS(filename=self.css_path) if os.path.exists(self.css_path) else None

            doc = html.render(stylesheets=[css] if css else [])
            doc.write_pdf(output_path)

            logger.info(f"PDF 生成成功: {output_path}")
            return output_path

        except Exception as e:
            logger.error(f"PDF 生成失败: {e}")
            raise

    def render_to_bytes(self, html_content: str) -> bytes:
        """
        将 HTML 内容渲染为 PDF 并返回字节数据

        Args:
            html_content: 完整 HTML 文档字符串

        Returns:
            PDF 文件的字节数据
        """
        html = HTML(string=html_content)
        css = CSS(filename=self.css_path) if os.path.exists(self.css_path) else None
        doc = html.render(stylesheets=[css] if css else [])
        return doc.write_pdf()
