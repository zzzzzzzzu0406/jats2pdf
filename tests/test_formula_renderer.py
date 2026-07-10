"""FormulaRenderer 测试（需求4：MathML→SVG 预渲染）"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.parser.jats_parser import JATSParser
from src.renderer.formula_renderer import FormulaRenderer

SAMPLE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "samples",
    "sample1.xml",
)


def _first_display_formula(article):
    """递归找第一个块级公式"""
    def walk(secs):
        for s in secs:
            for fm in s.formulas:
                if not fm.is_inline:
                    return fm
            r = walk(s.subsections)
            if r:
                return r
        return None
    return walk(article.sections)


class TestFormulaRenderer:
    def test_passthrough_unchanged(self):
        """passthrough 模式不改变 MathML"""
        fr = FormulaRenderer(method="passthrough")
        a = JATSParser(SAMPLE).parse()
        before = _first_display_formula(a).mathml
        fr.process_article_formulas(a)
        after = _first_display_formula(a).mathml
        assert before and after == before, "passthrough 应保持原样"

    def test_detect_method_no_crash(self):
        """_detect_method 不抛异常、返回合法值；修复了不检查 returncode 的误判 bug"""
        fr = FormulaRenderer(method="auto")
        assert fr.method in ("mathjax-node", "passthrough")

    def test_svg_render_integration(self):
        """若 mathjax-node 可用，块级公式应被替换为 <svg>（集成测试）"""
        fr = FormulaRenderer(method="auto")
        if fr.method != "mathjax-node":
            import pytest
            pytest.skip("mathjax-node 不可用（需 ~/mjnode 装 mathjax-node）")
        a = JATSParser(SAMPLE).parse()
        fr.process_article_formulas(a)
        fm = _first_display_formula(a)
        assert fm.mathml.startswith("<svg"), "块级公式应被预渲染为 SVG"

    def test_inline_formula_processed(self):
        """行内公式也应被预渲染（若有 mathjax-node）"""
        fr = FormulaRenderer(method="auto")
        if fr.method != "mathjax-node":
            import pytest
            pytest.skip("mathjax-node 不可用")
        a = JATSParser(SAMPLE).parse()
        fr.process_article_formulas(a)
        # 找行内公式 run
        def walk(secs):
            for s in secs:
                for p in s.paragraphs:
                    for r in p.runs:
                        if r.kind == "formula" and r.formula:
                            return r.formula
                r = walk(s.subsections)
                if r:
                    return r
            return None
        fm = walk(a.sections)
        assert fm and fm.mathml.startswith("<svg"), "行内公式应被预渲染为 SVG"


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
