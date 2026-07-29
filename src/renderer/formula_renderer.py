"""
公式预渲染：MathML / LaTeX → SVG（经 mathjax-node）
=================================================
赛题要求：数学公式（MathML 格式）的高保真渲染。

问题：WeasyPrint 不执行 JavaScript、也不渲染 MathML；若直接把 <mml:math> 塞进
HTML，PDF 里公式会退化成裸文本堆叠（h i σ W ...），结构丢失。

方案：先用 mathjax-node 把 MathML/LaTeX 预渲染为矢量 SVG，再写回 Formula.mathml，
模板 `{{ fm.mathml | safe }}` 即输出 <svg>，WeasyPrint 完美渲染矢量 SVG。

依赖：Node.js + mathjax-node。
  ⚠ mathjax-node 对含非 ASCII 字符的安装路径有 bug（内部会把路径 URL 编码导致
    找不到 MathJax.js），故需装在无中文路径下：
      mkdir -p ~/mjnode && cd ~/mjnode && npm install mathjax-node
  本模块会在该目录自举生成辅助脚本 mathml2svg.js。
  可用环境变量 JATS2PDF_MJDIR 指定目录（默认 ~/mjnode）。
"""

import html as html_lib
import os
import shutil
import subprocess
import tempfile
import logging
from typing import Optional

from lxml import etree

logger = logging.getLogger(__name__)

_FORMULA_TAGS = {
    "math", "annotation", "semantics", "mrow", "mi", "mn", "mo", "ms", "mtext",
    "mspace", "msup", "msub", "msubsup", "mfrac", "msqrt", "mroot", "mfenced",
    "menclose", "mover", "munder", "munderover", "mpadded", "mphantom", "mstyle",
    "mmultiscripts", "mtable", "mtr", "mtd", "maligngroup", "malignmark", "mglyph",
    "none", "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline",
    "polygon", "defs", "use", "title", "desc", "symbol", "clippath", "mask",
}
_FORMULA_ATTRS = {
    "xmlns", "xmlns:xlink", "xlink", "viewbox", "width", "height", "version",
    "preserveaspectratio", "class", "id", "role", "aria-label", "display", "mathvariant",
    "mathsize", "scriptlevel", "stretchy", "movablelimits", "form", "fence", "accent",
    "separator", "open", "close", "symmetric", "lspace", "rspace", "linethickness",
    "columnalign", "rowalign", "columnspacing", "rowspacing", "x", "y", "x1", "x2",
    "y1", "y2", "d", "fill", "fill-rule", "stroke", "stroke-width", "stroke-linecap",
    "stroke-linejoin", "stroke-miterlimit", "transform", "opacity", "fill-opacity",
    "stroke-opacity", "clip-path", "text-anchor", "font-family", "font-size", "font-style",
    "font-weight", "href",
}


def _formula_local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower() if isinstance(tag, str) else ""


def sanitize_formula_markup(markup: str) -> str:
    """保留公式所需 MathML/SVG，移除脚本、事件属性和外部资源。"""
    if not markup:
        return ""
    if not markup.lstrip().startswith("<"):
        return html_lib.escape(markup)
    parser = etree.XMLParser(resolve_entities=False, no_network=True, recover=False, huge_tree=False)
    try:
        root = etree.fromstring(markup.encode("utf-8"), parser)
    except (etree.XMLSyntaxError, UnicodeEncodeError):
        return html_lib.escape(markup)
    if _formula_local_name(root.tag) not in _FORMULA_TAGS:
        return html_lib.escape(markup)

    changed = False

    def clean(element):
        nonlocal changed
        for child in list(element):
            if _formula_local_name(child.tag) not in _FORMULA_TAGS:
                element.remove(child)
                changed = True
                continue
            clean(child)
        for attr, value in list(element.attrib.items()):
            attr_name = _formula_local_name(attr)
            if attr_name not in _FORMULA_ATTRS or attr_name == "style":
                del element.attrib[attr]
                changed = True
                continue
            if attr_name in {"href", "xlink"} and not str(value).startswith("#"):
                del element.attrib[attr]
                changed = True

    clean(root)
    if not changed:
        return markup
    return etree.tostring(root, encoding="unicode")


# mathjax-node 调用脚本：读入公式文件 → 输出 SVG 到 stdout
_HELPER_JS = r'''#!/usr/bin/env node
const fs = require('fs');
const mj = require('mathjax-node');
mj.start();
const inp = process.argv[2];
const fmt = process.argv[3] || 'MathML';
const math = fs.readFileSync(inp, 'utf8').trim();
mj.typeset({ math: math, format: fmt, svg: true }).then(r => {
  if (r && r.svg) { process.stdout.write(r.svg); process.exit(0); }
  process.stderr.write('no svg produced\n'); process.exit(1);
}).catch(e => { process.stderr.write(String(e) + '\n'); process.exit(2); });
'''


def _mj_dir() -> str:
    """mathjax-node 安装目录（无中文路径）。"""
    return os.environ.get("JATS2PDF_MJDIR") or os.path.expanduser("~/mjnode")


def _helper_script() -> str:
    return os.path.join(_mj_dir(), "mathml2svg.js")


def _ensure_helper():
    """若辅助脚本不存在则自举创建（需 mathjax-node 已装在该目录）。"""
    p = _helper_script()
    if not os.path.exists(p):
        try:
            os.makedirs(_mj_dir(), exist_ok=True)
            with open(p, "w", encoding="utf-8") as f:
                f.write(_HELPER_JS)
            logger.info(f"已生成公式预渲染脚本: {p}")
        except OSError as e:
            logger.warning(f"无法创建公式预渲染脚本 {p}: {e}")
    return p


class FormulaRenderer:
    """将 MathML / LaTeX 预渲染为 SVG（经 mathjax-node）。"""

    def __init__(self, method: str = "auto"):
        """
        Args:
            method: "mathjax-node"（强制）/"auto"（自动检测）/ "passthrough"（原样）
        """
        self.method = self._detect_method(method)

    def _detect_method(self, method: str) -> str:
        """检测可用的公式渲染工具；passthrough 表示原样输出 MathML。"""
        if method != "auto":
            return method
        if not shutil.which("node"):
            logger.warning("⚠️ 未找到 Node.js，公式将原样输出 MathML（WeasyPrint 不渲染）")
            return "passthrough"
        helper = _ensure_helper()
        if not os.path.exists(helper):
            logger.warning("⚠️ 未找到公式预渲染脚本，公式原样输出")
            return "passthrough"
        # 实测一次最小 MathML，确认 mathjax-node 真正可用（而非仅 node 存在）
        try:
            svg = self._run_helper(
                '<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math>',
                "MathML",
            )
            if svg and svg.strip().startswith("<svg"):
                logger.info("✅ 检测到 mathjax-node（MathML→SVG 可用）")
                return "mathjax-node"
            logger.warning("⚠️ mathjax-node 未产出 SVG，公式原样输出；请确认已 `npm install mathjax-node` 于 %s", _mj_dir())
        except Exception as e:  # noqa: BLE001
            logger.warning(f"⚠️ mathjax-node 检测失败({e})，公式原样输出")
        return "passthrough"

    def _run_helper(self, math_str: str, fmt: str) -> str:
        """调用 node mathml2svg.js 把公式转为 SVG，返回 SVG 字符串（失败返回空串）。"""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".mml", delete=False, encoding="utf-8"
        ) as f:
            f.write(math_str)
            tmp = f.name
        try:
            r = subprocess.run(
                ["node", _helper_script(), tmp, fmt],
                capture_output=True, text=True, timeout=30,
            )
            if r.returncode == 0 and r.stdout.strip().startswith("<svg"):
                return r.stdout.strip()
            if r.stderr:
                logger.debug(f"mathjax-node stderr: {r.stderr.strip()[:200]}")
            return ""
        except (subprocess.TimeoutExpired, FileNotFoundError) as e:
            logger.debug(f"mathjax-node 调用异常: {e}")
            return ""
        finally:
            try:
                os.unlink(tmp)
            except OSError:
                pass

    def mathml_to_svg(self, mathml: str, inline: bool = False) -> str:
        """MathML → SVG。passthrough 模式原样返回。"""
        mathml = sanitize_formula_markup(mathml)
        if self.method == "passthrough":
            return mathml
        svg = self._run_helper(mathml, "MathML")
        return sanitize_formula_markup(svg or mathml)

    def latex_to_svg(self, latex: str, display: bool = True) -> str:
        """LaTeX → SVG。"""
        if self.method == "passthrough":
            return sanitize_formula_markup(f"$${latex}$$" if display else f"${latex}$")
        svg = self._run_helper(latex, "TeX")
        return sanitize_formula_markup(svg or (f"$${latex}$$" if display else f"${latex}$"))

    def process_article_formulas(self, article):
        """预处理整篇文章公式：块级公式 + 行内公式（段落 FormulaRun）→ SVG。"""
        # 0) body 根级公式/段落（真实 JATS 允许内容不包在 sec 内）
        for fm in getattr(article, "formulas", []):
            self._process_formula(fm, display=True)
        for block in getattr(article, "blocks", []):
            if block.kind == "paragraph":
                self._process_paragraph_formulas(block.value)

        # 1) 块级公式（section.formulas 中 is_inline=False）
        for section in self._iter_sections(article.sections):
            for fm in section.formulas:
                if fm.is_inline:
                    continue
                self._process_formula(fm, display=True)
        # 2) 行内公式（段落 runs 中的 FormulaRun）
        for section in self._iter_sections(article.sections):
            for para in section.paragraphs:
                self._process_paragraph_formulas(para)
        return article

    def _process_paragraph_formulas(self, paragraph):
        for run in paragraph.runs:
            if run.kind == "formula" and run.formula is not None:
                self._process_formula(run.formula, display=False)

    def _process_formula(self, formula, display: bool):
        if formula.mathml:
            formula.mathml = self.mathml_to_svg(formula.mathml, inline=not display)
            formula.is_svg = formula.mathml.strip().startswith("<svg")
        elif formula.latex:
            formula.mathml = self.latex_to_svg(formula.latex, display=display)
            formula.is_svg = formula.mathml.strip().startswith("<svg")

    def _iter_sections(self, sections):
        """递归遍历所有章节。"""
        for section in sections:
            yield section
            yield from self._iter_sections(section.subsections)
