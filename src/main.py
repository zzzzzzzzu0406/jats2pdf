"""
JATS2PDF — 主入口（命令行工具）
=============================
选题2: JATS XML → PDF 学术期刊智能排版

用法:
    # 基本用法
    python -m src.main input.xml -o output.pdf

    # 双栏模式
    python -m src.main input.xml --two-column -o output.pdf

    # 预渲染公式（MathML/LaTeX → SVG，提高PDF兼容性）
    python -m src.main input.xml --render-formulas -o output.pdf

    # 只生成 HTML（调试用）
    python -m src.main input.xml --html

    # 完整示例
    python -m src.main samples/sample1.xml --two-column --render-formulas -o output.pdf
"""

import argparse
import logging
import sys
import os

from .parser.jats_parser import JATSParser
from .renderer.html_renderer import HTMLRenderer
# PDFRenderer / FormulaRenderer 延迟加载，避免 Windows 上 GTK 缺失导致 --html 模式也无法运行

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("jats2pdf")


def main():
    parser = argparse.ArgumentParser(
        prog="jats2pdf",
        description="JATS XML → PDF 学术期刊智能排版工具",
        epilog="选题2: 基于JATS XML结构数据的PDF自动排版与生成",
    )
    parser.add_argument("input", help="输入的 JATS XML 文件路径")
    parser.add_argument("-o", "--output", default="output.pdf",
                        help="输出 PDF 路径 (默认: output.pdf)")
    parser.add_argument("--html", action="store_true",
                        help="只生成中间 HTML，不生成 PDF（调试用）")
    parser.add_argument("--html-output", default=None,
                        help="HTML 输出路径（调试用）")
    parser.add_argument("--css", default=None,
                        help="自定义 CSS 样式表路径")
    parser.add_argument("--two-column", action="store_true",
                        help="启用双栏排版模式")
    parser.add_argument("--no-render-formulas", action="store_true",
                        help="关闭公式预渲染（默认开启：MathML→SVG，需 Node.js+mathjax-node-cli）")
    parser.add_argument("--ref-style", choices=["elsevier", "gbt7714"], default="elsevier",
                        help="参考文献格式：elsevier（默认）或 gbt7714")

    args = parser.parse_args()

    # ──────────────────────────────────────
    # Step 1: 解析 JATS XML
    # ──────────────────────────────────────
    logger.info(f"📄 正在解析 JATS XML: {args.input}")
    try:
        xml_parser = JATSParser(args.input)
        article = xml_parser.parse()
    except Exception as e:
        logger.error(f"❌ XML 解析失败: {e}")
        sys.exit(1)

    logger.info(
        f"✅ 解析成功: "
        f"标题={article.title[:50]}..., "
        f"作者={len(article.authors)}人, "
        f"章节={len(article.sections)}个, "
        f"参考文献={len(article.references)}条"
    )

    # ──────────────────────────────────────
    # Step 1.5: 预渲染公式（默认开启；--no-render-formulas 可关）
    # ──────────────────────────────────────
    if not args.no_render_formulas:
        logger.info("🧮 正在预渲染公式 (MathML/LaTeX → SVG)...")
        try:
            from .renderer.formula_renderer import FormulaRenderer
            formula_renderer = FormulaRenderer(method="auto")
            article = formula_renderer.process_article_formulas(article)
            logger.info("✅ 公式预渲染完成")
        except Exception as e:
            logger.warning(f"⚠️ 公式预渲染失败（将继续使用原始标记）: {e}")

    # ──────────────────────────────────────
    # Step 2: 渲染 HTML
    # ──────────────────────────────────────
    logger.info("🔧 正在渲染 HTML...")
    html_renderer = HTMLRenderer()
    html_content = html_renderer.render(article, ref_style=args.ref_style)

    # 双栏模式：在 <body> 上添加 class
    if args.two_column:
        logger.info("📐 启用双栏排版")
        html_content = html_content.replace(
            "<body>", '<body class="two-column">', 1
        )

    if args.html_output:
        with open(args.html_output, "w", encoding="utf-8") as f:
            f.write(html_content)
        logger.info(f"📝 HTML 已保存: {args.html_output}")

    if args.html:
        if not args.html_output:
            print(html_content)
        return

    # ──────────────────────────────────────
    # Step 3: 生成 PDF
    # ──────────────────────────────────────
    logger.info(f"🖨️ 正在生成 PDF: {args.output}")
    try:
        from .renderer.pdf_renderer import PDFRenderer
        pdf_renderer = PDFRenderer(css_path=args.css)
        pdf_renderer.render_to_file(html_content, args.output)
        logger.info(f"🎉 PDF 生成完成: {args.output}")
    except Exception as e:
        logger.error(f"❌ PDF 生成失败: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
