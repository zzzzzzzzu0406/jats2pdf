"""
主入口：命令行工具
用法:
    python -m src.main input.xml -o output.pdf
    python -m src.main input.xml --html        # 只生成 HTML（调试用）
"""

import argparse
import logging
import sys
import os

from .parser.jats_parser import JATSParser
from .renderer.html_renderer import HTMLRenderer
from .renderer.pdf_renderer import PDFRenderer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("jats2pdf")


def main():
    parser = argparse.ArgumentParser(
        prog="jats2pdf",
        description="JATS XML → PDF 学术期刊自动排版工具",
        epilog="选题2: 基于JATS XML结构数据的PDF自动排版与生成",
    )
    parser.add_argument("input", help="输入的 JATS XML 文件路径")
    parser.add_argument("-o", "--output", default="output.pdf", help="输出 PDF 路径 (默认: output.pdf)")
    parser.add_argument("--html", action="store_true", help="只生成中间 HTML，不生成 PDF（调试用）")
    parser.add_argument("--html-output", default=None, help="HTML 输出路径")
    parser.add_argument("--css", default=None, help="自定义 CSS 样式表路径")

    args = parser.parse_args()

    # ── Step 1: 解析 JATS XML ──
    logger.info(f"📄 正在解析 JATS XML: {args.input}")
    try:
        parser_obj = JATSParser(args.input)
        article = parser_obj.parse()
    except Exception as e:
        logger.error(f"❌ XML 解析失败: {e}")
        sys.exit(1)

    logger.info(f"✅ 解析成功: 标题={article.title[:40]}..., "
                f"作者={len(article.authors)}人, "
                f"章节={len(article.sections)}个, "
                f"参考文献={len(article.references)}条")

    # ── Step 2: 渲染 HTML ──
    logger.info("🔧 正在渲染 HTML...")
    html_renderer = HTMLRenderer()
    html_content = html_renderer.render(article)

    if args.html_output:
        with open(args.html_output, "w", encoding="utf-8") as f:
            f.write(html_content)
        logger.info(f"📝 HTML 已保存: {args.html_output}")

    if args.html:
        # 只生成 HTML
        if not args.html_output:
            print(html_content)
        return

    # ── Step 3: 生成 PDF ──
    logger.info(f"🖨️ 正在生成 PDF: {args.output}")
    try:
        pdf_renderer = PDFRenderer(css_path=args.css)
        pdf_renderer.render_to_file(html_content, args.output)
        logger.info(f"🎉 PDF 生成完成: {args.output}")
    except Exception as e:
        logger.error(f"❌ PDF 生成失败: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
