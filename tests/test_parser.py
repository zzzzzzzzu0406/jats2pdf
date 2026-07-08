"""测试 JATS XML 解析器"""
import os
import sys
import pytest

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.parser.jats_parser import JATSParser


SAMPLE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "samples",
    "sample1.xml",
)


class TestJATSParser:
    """JATS 解析器单元测试"""

    def test_parse_sample(self):
        """测试解析示例 JATS XML 文件"""
        if not os.path.exists(SAMPLE_PATH):
            pytest.skip(f"示例文件不存在: {SAMPLE_PATH}")

        parser = JATSParser(SAMPLE_PATH)
        article = parser.parse()

        # 基本断言
        assert article.title, "应该有标题"
        assert "深度学习" in article.title, "标题应包含预期关键词"
        assert len(article.authors) == 2, "应该解析出2位作者"
        assert article.authors[0].surname == "张"
        assert article.authors[0].given_names == "三"
        assert article.authors[0].orcid == "0000-0001-2345-6789"

        # 摘要
        assert article.abstract, "应该有摘要"
        assert "LayoutLM" in article.abstract

        # 关键词
        assert len(article.keywords) >= 3
        assert "LayoutLM" in article.keywords

        # 章节
        assert len(article.sections) >= 4
        # 检查子章节
        methods_sec = [s for s in article.sections if "方法" in s.title]
        if methods_sec:
            assert len(methods_sec[0].subsections) >= 2

        # 公式
        all_formulas = []
        for sec in article.sections:
            all_formulas.extend(sec.formulas)
        assert len(all_formulas) >= 1, "应该至少有一个公式"

        # 表格
        all_tables = []
        for sec in article.sections:
            all_tables.extend(sec.tables)
        assert len(all_tables) >= 1, "应该至少有一个表格"

        # 参考文献
        assert len(article.references) == 3

    def test_empty_xml(self, tmp_path):
        """测试解析最小化的 JATS XML"""
        minimal_xml = """<?xml version="1.0"?>
        <article>
          <front>
            <article-meta>
              <title-group>
                <article-title>Test Title</article-title>
              </title-group>
            </article-meta>
          </front>
          <body/>
          <back/>
        </article>"""
        xml_file = tmp_path / "minimal.xml"
        xml_file.write_text(minimal_xml, encoding="utf-8")

        parser = JATSParser(str(xml_file))
        article = parser.parse()
        assert article.title == "Test Title"
        assert article.authors == []
        assert article.sections == []

    def test_author_with_orcid(self):
        """测试解析作者ORCID信息"""
        assert os.path.exists(SAMPLE_PATH)
        parser = JATSParser(SAMPLE_PATH)
        article = parser.parse()

        orcid_authors = [a for a in article.authors if a.orcid]
        assert len(orcid_authors) > 0
        assert orcid_authors[0].orcid.startswith("0000-")

    def test_references_have_titles(self):
        """测试参考文献解析"""
        assert os.path.exists(SAMPLE_PATH)
        parser = JATSParser(SAMPLE_PATH)
        article = parser.parse()

        for ref in article.references:
            assert ref.id, f"参考文献 {ref} 应该有id"
            # 至少要有标题或作者
            assert ref.authors or ref.title, f"参考文献 {ref.id} 应至少有作者或标题"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
