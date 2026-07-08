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


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
