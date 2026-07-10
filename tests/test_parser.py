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
        assert article.journal == "计算机学报", "应该解析出期刊名"
        assert len(article.authors) == 2, "应该解析出2位作者"
        assert article.authors[0].surname == "张"
        assert article.authors[0].given_name == "三"
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

        # 公式 / 表格：递归收集（含子章节），样本中的公式与表格都位于 subsections
        def _collect(sections, attr):
            out = []
            for sec in sections:
                out.extend(getattr(sec, attr))
                out.extend(_collect(sec.subsections, attr))
            return out

        all_formulas = _collect(article.sections, "formulas")
        assert len(all_formulas) >= 1, "应该至少有一个公式"

        all_tables = _collect(article.sections, "tables")
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

    @staticmethod
    def _all_paragraphs(sections):
        """递归遍历所有章节的段落（含子章节）"""
        for s in sections:
            for p in s.paragraphs:
                yield p
            yield from TestJATSParser._all_paragraphs(s.subsections)

    def test_bilingual_and_affiliations(self):
        """中英双语摘要/关键词 + 机构信息（需求1）"""
        article = JATSParser(SAMPLE_PATH).parse()
        assert article.abstract_en, "应有英文摘要"
        assert "Document structure recognition" in article.abstract_en
        assert article.keywords_en, "应有英文关键词"
        assert "LayoutLM" in article.keywords_en
        assert len(article.affiliations) == 2, "应解析出2个机构"
        assert article.affiliations[0].id == "aff1"
        assert "智能文档处理" in article.affiliations[0].name
        # 作者机构序号上标
        assert article.authors[0].affiliation == "1"
        assert article.authors[1].affiliation == "2"

    def test_numbering_and_xref(self):
        """图表/公式自动编号 + xref_map + 段落交叉引用 run + 行内公式（需求3/4）"""
        article = JATSParser(SAMPLE_PATH).parse()
        # 自动编号映射
        assert article.xref_map["f1"]["label"] == "图1"
        assert article.xref_map["t1"]["label"] == "表1"
        assert article.xref_map["eq1"]["label"] == "(1)"
        assert article.xref_label("f1") == "图1"
        assert article.xref_anchor("eq1") == "eq1"
        # 段落 runs
        runs = [r for p in self._all_paragraphs(article.sections) for r in p.runs]
        xrefs = [r for r in runs if r.kind == "xref"]
        assert xrefs, "段落应含 xref run"
        assert any(r.rid == "f1" and r.ref_type == "fig" for r in xrefs)
        assert any(r.rid == "t1" and r.ref_type == "table" for r in xrefs)
        assert any(r.rid == "eq1" for r in xrefs), "应有指向公式的 xref"
        # bibr 文献引用：单 rid → [1]，多 rid → [2], [3]
        assert any(r.rid == "r1" and r.ref_type == "bibr" for r in xrefs), "应有 bibr 引用"
        assert article.xref_label("r1") == "[1]"
        assert article.xref_label("r2 r3") == "[2], [3]"
        # 行内公式 run
        assert any(r.kind == "formula" for r in runs), "段落应含行内公式 run"

    def test_reference_authors_pages_pubtype(self):
        """参考文献作者/起止页/出版类型（需求5：修复 person-name→name、补 lpage）"""
        article = JATSParser(SAMPLE_PATH).parse()
        r1 = article.references[0]
        assert "Xu" in r1.authors and "Li" in r1.authors, "作者应解析出 Xu/Li"
        assert r1.pages == "1192-1200", "页码应为起止区间"
        assert r1.pub_type == "journal"
        assert r1.doi == "10.1145/3394486.3403172"
        # 表格题注（修复 caption/title 回退）
        def find_tbl(secs):
            for s in secs:
                for t in s.tables:
                    return t
                r = find_tbl(s.subsections)
                if r:
                    return r
            return None
        tbl = find_tbl(article.sections)
        assert tbl and tbl.caption == "数据集统计信息", "表格题注应解析 caption/title"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
