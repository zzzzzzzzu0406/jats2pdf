"""测试 HTML 渲染器（article_preview.html 模板）"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.parser.jats_parser import JATSParser
from src.renderer.html_renderer import HTMLRenderer

SAMPLE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "samples",
    "sample1.xml",
)


class TestHTMLRenderer:
    """HTML 渲染器单元测试"""

    def test_render_sample(self):
        """测试将示例论文渲染为 HTML"""
        if not os.path.exists(SAMPLE_PATH):
            import pytest
            pytest.skip(f"示例文件不存在: {SAMPLE_PATH}")

        parser = JATSParser(SAMPLE_PATH)
        article = parser.parse()
        renderer = HTMLRenderer()
        html = renderer.render(article)

        assert "<html" in html
        assert "深度学习" in html
        assert "张三" in html
        assert "math" in html.lower()
        assert "doi.org" in html

    def test_render_minimal_article(self):
        """测试渲染只有标题的文章"""
        parser = JATSParser(SAMPLE_PATH)
        article = parser.parse()
        article.sections = []
        article.authors = []
        article.references = []
        article.keywords = []
        article.abstract = ""

        renderer = HTMLRenderer()
        html = renderer.render(article)
        assert html
        assert "<html" in html  # 能够渲染

    def test_new_features_render(self):
        """双语/机构/自动编号/xref链接"""
        article = JATSParser(SAMPLE_PATH).parse()
        html = HTMLRenderer().render(article)
        assert "ABSTRACT" in html or "abstract" in html.lower()
        assert "Keywords:" in html or "keywords" in html.lower()
        assert "张三" in html
        assert "李四" in html

    def test_ref_style_gbt7714(self):
        """GB-T 7714 参考文献格式"""
        article = JATSParser(SAMPLE_PATH).parse()
        html = HTMLRenderer().render(article, ref_style="gbt7714")
        assert "[J]" in html, "GB-T 7714 应有文献类型标识 [J]"
        assert "DOI: 10.1145" in html
        assert "1192-1200" in html

    def test_autoescape_untrusted_article_text(self):
        """上传文章文本必须显示为文本，不能变成可执行 HTML。"""
        article = JATSParser(SAMPLE_PATH).parse()
        article.title = '<img src=x onerror="alert(1)">'
        html = HTMLRenderer().render(article)
        assert '<img src=x onerror="alert(1)">' not in html
        assert "&lt;img src=x onerror=&#34;alert(1)&#34;&gt;" in html

    def test_ordered_blocks_render_in_xml_order(self, tmp_path):
        xml = """<article><front><article-meta><title-group><article-title>Order</article-title></title-group></article-meta></front>
        <body><sec><title>S</title><p>AAA_BEFORE</p><fig id="f"><caption><p>BBB_CAPTION</p></caption></fig><p>CCC_AFTER</p></sec></body></article>"""
        path = tmp_path / "order.xml"
        path.write_text(xml, encoding="utf-8")
        html = HTMLRenderer().render(JATSParser(str(path)).parse())
        assert html.index("AAA_BEFORE") < html.index("BBB_CAPTION") < html.index("CCC_AFTER")

    def test_web_pmc_image_url_contains_pmcid(self):
        path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "samples", "real", "pmc3128412.xml",
        )
        article = JATSParser(path).parse()
        html = HTMLRenderer().render_article(article, asset_mode="web")
        assert "/api/files/amiajnl-2011-000217fig1.jpg?pmcid=PMC3128412" in html

    def test_structured_table_render_and_legacy_fallback(self):
        """结构化表格输出跨格/表注，旧 pickle 对象仍可渲染。"""
        real_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "samples", "real", "pmc3128412.xml",
        )
        html = HTMLRenderer().render(JATSParser(real_path).parse())
        assert "The gold standard was determined by security officers." in html

        legacy_article = JATSParser(SAMPLE_PATH).parse()
        legacy_table = next(
            table
            for section in legacy_article.sections
            for subsection in [section] + section.subsections
            for table in subsection.tables
        )
        expected_header = legacy_table.headers[0]
        del legacy_table.header_rows
        del legacy_table.body_rows
        del legacy_table.footnotes
        legacy_html = HTMLRenderer().render(legacy_article)
        assert expected_header in legacy_html

    def test_font_style_and_size_are_rendered_as_safe_classes(self):
        article = JATSParser(SAMPLE_PATH).parse()
        html = HTMLRenderer().render(article, font_style="modern", font_size="large")
        assert "font-style-modern" in html
        assert "15px" in html  # large maps to 15px in body font-size

        fallback = HTMLRenderer().render(article, font_style="not-a-style", font_size="99px")
        assert "font-style-academic" in fallback
        assert "14px" in fallback  # medium fallback


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
