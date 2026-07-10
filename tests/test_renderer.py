"""测试 HTML 渲染器"""
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

        # 检查关键元素
        assert "<html" in html
        assert "深度学习" in html
        assert "张三" in html
        # MathML 公式应该保留
        assert "math" in html.lower()
        # 参考文献链接
        assert "doi.org" in html

    def test_render_minimal_article(self):
        """测试渲染只有标题的文章"""
        parser = JATSParser(SAMPLE_PATH)
        article = parser.parse()
        # 清空大部分内容
        article.sections = []
        article.authors = []
        article.references = []
        article.keywords = []
        article.abstract = ""

        renderer = HTMLRenderer()
        html = renderer.render(article)
        assert html  # 不应该崩溃
        assert "article-title" in html

    def test_new_features_render(self):
        """双语/机构/自动编号/xref链接/Elsevier格式（需求1/3/5）"""
        article = JATSParser(SAMPLE_PATH).parse()
        html = HTMLRenderer().render(article)
        assert "ABSTRACT" in html, "应渲染英文摘要"
        assert "Keywords:" in html, "应渲染英文关键词"
        assert 'href="#f1"' in html, "应渲染 xref 可点击链接"
        assert "图1" in html, "应自动编号"
        assert "表1" in html
        assert "affiliation" in html, "应渲染机构"
        assert "vol. 1" in html, "Elsevier 格式应有 vol."
        assert "pp. 1192-1200" in html, "应有起止页"
        # 图表/公式应为 .layout-main 直接子元素（双栏跨栏前提，需求6）
        assert '<figure class="figure" id="f1">' in html

    def test_ref_style_gbt7714(self):
        """GB-T 7714 参考文献格式（需求5）"""
        article = JATSParser(SAMPLE_PATH).parse()
        html = HTMLRenderer().render(article, ref_style="gbt7714")
        assert "[J]" in html, "GB-T 7714 应有文献类型标识 [J]"
        assert "DOI: 10.1145" in html
        assert "1192-1200" in html


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
