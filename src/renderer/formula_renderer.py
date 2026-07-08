"""
公式预渲染工具
=============
赛题要求：数学公式的 MathML 格式高保真渲染

问题：WeasyPrint 不支持 JavaScript，无法执行 MathJax。
解决方案：先用 MathJax-node CLI 将 MathML/LaTeX 预渲染为 SVG，
         再把 SVG 嵌入 HTML，WeasyPrint 完美渲染 SVG。

工作流程：
  1. 从 JATS XML 中提取 MathML / LaTeX
  2. 调用 mathjax-node-cli 转为 SVG
  3. 将 SVG 嵌入 HTML 模板
  4. WeasyPrint 渲染 HTML → PDF

依赖：需要安装 Node.js 和 mathjax-node-cli
      npm install -g mathjax-node-cli
"""

import subprocess
import tempfile
import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


class FormulaRenderer:
    """将 MathML / LaTeX 公式预渲染为 SVG"""

    def __init__(self, method: str = "auto"):
        """
        Args:
            method: 渲染方式
                - "mathjax-node": 使用 mathjax-node-cli（推荐）
                - "katex": 使用 katex CLI
                - "auto": 自动检测可用工具
        """
        self.method = self._detect_method(method)

    def _detect_method(self, method: str) -> str:
        """检测可用的公式渲染工具"""
        if method != "auto":
            return method

        # 优先检测 mathjax-node-cli
        try:
            subprocess.run(
                ["npx", "mathjax-node-cli", "--version"],
                capture_output=True, timeout=10,
            )
            logger.info("✅ 检测到 mathjax-node-cli")
            return "mathjax-node"
        except Exception:
            pass

        # 回退到本地 MathJax（如果安装了 node_modules）
        if os.path.exists("node_modules/mathjax"):
            logger.info("✅ 检测到本地 mathjax")
            return "mathjax-local"

        logger.warning("⚠️ 未找到公式渲染工具，将直接嵌入MathML（WeasyPrint可能有兼容性问题）")
        return "passthrough"

    def mathml_to_svg(self, mathml: str) -> str:
        """
        将 MathML 字符串渲染为 SVG

        Args:
            mathml: MathML 标记字符串

        Returns:
            SVG 字符串（可直接嵌入 HTML）
        """
        if self.method == "passthrough":
            return mathml  # 原样返回 MathML

        if self.method == "mathjax-node":
            return self._render_with_mathjax_node(mathml, input_type="mml")

        return mathml

    def latex_to_svg(self, latex: str, display: bool = True) -> str:
        """
        将 LaTeX 字符串渲染为 SVG

        Args:
            latex: LaTeX 公式字符串
            display: True=块级公式, False=行内公式

        Returns:
            SVG 字符串
        """
        if self.method == "passthrough":
            # 直接返回 LaTeX + MathJax 标记
            delimiter = "$$" if display else "$"
            return f"{delimiter}{latex}{delimiter}"

        if self.method == "mathjax-node":
            return self._render_with_mathjax_node(latex, input_type="tex")

        return latex

    def _render_with_mathjax_node(self, formula: str, input_type: str = "mml") -> str:
        """
        使用 mathjax-node-cli 渲染公式为 SVG

        Args:
            formula: MathML 或 LaTeX 字符串
            input_type: "mml" 或 "tex"

        Returns:
            SVG 字符串
        """
        try:
            # 将公式写入临时文件
            with tempfile.NamedTemporaryFile(
                mode="w", suffix=f".{input_type}", delete=False, encoding="utf-8"
            ) as f:
                f.write(formula)
                temp_input = f.name

            # 调用 mathjax-node-cli
            result = subprocess.run(
                [
                    "npx", "mathjax-node-cli",
                    "--input", input_type,
                    "--output", "svg",
                    "--inline", "true" if input_type == "tex" else "false",
                    temp_input,
                ],
                capture_output=True,
                text=True,
                timeout=30,
            )

            # 清理临时文件
            os.unlink(temp_input)

            if result.returncode == 0:
                return result.stdout.strip()
            else:
                logger.error(f"MathJax 渲染失败: {result.stderr}")
                return formula  # 回退

        except FileNotFoundError:
            logger.warning("⚠️ mathjax-node-cli 未安装，运行: npm install -g mathjax-node-cli")
            return formula
        except Exception as e:
            logger.error(f"公式渲染异常: {e}")
            return formula

    def process_article_formulas(self, article):
        """
        预处理整篇文章的所有公式，将 MathML/LaTeX 转为 SVG

        Args:
            article: Article 对象（会被原地修改）

        Returns:
            处理后的 Article 对象
        """
        from ..parser.jats_parser import Formula

        for section in self._iter_sections(article.sections):
            for formula in section.formulas:
                svg = None
                if formula.mathml:
                    svg = self.mathml_to_svg(formula.mathml)
                elif formula.latex:
                    svg = self.latex_to_svg(formula.latex)
                if svg:
                    # 用 SVG 替换原始标记
                    formula.mathml = svg
                    formula.latex = ""
        return article

    def _iter_sections(self, sections):
        """递归遍历所有章节"""
        for section in sections:
            yield section
            yield from self._iter_sections(section.subsections)
