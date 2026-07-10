"""
构建脚本：生成学术期刊优化平台所有静态页面
用法: python build_site.py
输出: samples/output/ 目录下的所有页面
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.parser.jats_parser import JATSParser
from src.renderer.html_renderer import HTMLRenderer

OUTPUT_DIR = os.path.join("samples", "output")
SAMPLE_XML = os.path.join("samples", "sample1.xml")


def build_all():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 解析示例论文
    print("Parsing sample JATS XML...")
    article = JATSParser(SAMPLE_XML).parse()
    article.journal = "计算机学报"
    print(f"   OK: {article.title[:40]}...")

    # 公式预渲染 MathML→SVG（需 Node.js + mathjax-node，详见 src/renderer/formula_renderer.py）
    try:
        from src.renderer.formula_renderer import FormulaRenderer
        FormulaRenderer(method="auto").process_article_formulas(article)
        print("   OK: formulas pre-rendered to SVG")
    except Exception as e:
        print(f"   SKIP formula pre-render: {e}")

    renderer = HTMLRenderer()

    # ── 1. 首页 ──
    print("Generating index.html...")
    html = renderer.render_index(
        articles=[article],
        journal_name=article.journal,
    )
    with open(os.path.join(OUTPUT_DIR, "index.html"), "w", encoding="utf-8") as f:
        f.write(html)
    print("   OK: index.html")

    # ── 2. 浏览页 ──
    print("Generating browse.html...")
    html = renderer.render_browse(
        articles=[article],
        journal_name=article.journal,
    )
    with open(os.path.join(OUTPUT_DIR, "browse.html"), "w", encoding="utf-8") as f:
        f.write(html)
    print("   OK: browse.html")

    # ── 3. 上传页 ──
    print("Generating upload.html...")
    html = renderer.render_upload(journal_name=article.journal)
    with open(os.path.join(OUTPUT_DIR, "upload.html"), "w", encoding="utf-8") as f:
        f.write(html)
    print("   OK: upload.html")

    # ── 4. 论文详情页 ──
    print("Generating article.html...")
    html = renderer.render_article(article)
    with open(os.path.join(OUTPUT_DIR, "article.html"), "w", encoding="utf-8") as f:
        f.write(html)
    print("   OK: article.html")

    # ── 5. 关于页 ──
    print("Generating about.html...")
    html = renderer.render_about(journal_name=article.journal)
    with open(os.path.join(OUTPUT_DIR, "about.html"), "w", encoding="utf-8") as f:
        f.write(html)
    print("   OK: about.html")

    print(f"\nAll done! Output: {os.path.abspath(OUTPUT_DIR)}/")
    print("   Open: samples/output/index.html")


if __name__ == "__main__":
    build_all()
