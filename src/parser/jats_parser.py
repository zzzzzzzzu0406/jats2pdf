"""
JATS XML 解析器
将 JATS 1.0/1.1 标准 XML 文件解析为结构化的 Python 数据模型

JATS (Journal Article Tag Suite) 参考: https://jats.nlm.nih.gov/
"""

from dataclasses import dataclass, field
from typing import Optional
from lxml import etree

# ─── 数据模型 ───────────────────────────────────────────

@dataclass
class Author:
    """作者信息"""
    given_name: str = ""
    surname: str = ""
    orcid: str = ""
    affiliation: str = ""
    email: str = ""

@dataclass
class Affiliation:
    """机构信息"""
    id: str = ""
    name: str = ""
    department: str = ""
    city: str = ""
    country: str = ""

@dataclass
class Figure:
    """图表"""
    id: str = ""
    label: str = ""          # 图1, Figure 1
    caption: str = ""        # 图题
    graphic_href: str = ""   # 图片路径
    credit: str = ""         # 来源说明

@dataclass
class Table:
    """表格"""
    id: str = ""
    label: str = ""
    caption: str = ""
    headers: list[str] = field(default_factory=list)
    rows: list[list[str]] = field(default_factory=list)

@dataclass
class Formula:
    """数学公式"""
    id: str = ""
    label: str = ""
    mathml: str = ""         # MathML 标记
    latex: str = ""          # LaTeX 备用形式
    is_inline: bool = False

@dataclass
class Reference:
    """参考文献"""
    id: str = ""
    authors: str = ""
    title: str = ""
    journal: str = ""
    year: str = ""
    volume: str = ""
    issue: str = ""
    pages: str = ""
    doi: str = ""
    url: str = ""

@dataclass
class Section:
    """论文章节"""
    title: str = ""
    level: int = 1           # 1=一级标题, 2=二级标题...
    paragraphs: list[str] = field(default_factory=list)
    subsections: list["Section"] = field(default_factory=list)
    figures: list[Figure] = field(default_factory=list)
    tables: list[Table] = field(default_factory=list)
    formulas: list[Formula] = field(default_factory=list)

@dataclass
class Article:
    """完整的论文结构"""
    title: str = ""
    subtitle: str = ""
    authors: list[Author] = field(default_factory=list)
    affiliations: list[Affiliation] = field(default_factory=list)
    abstract: str = ""
    keywords: list[str] = field(default_factory=list)
    doi: str = ""
    journal: str = ""
    sections: list[Section] = field(default_factory=list)
    references: list[Reference] = field(default_factory=list)
    figures: list[Figure] = field(default_factory=list)    # 浮动图表
    tables: list[Table] = field(default_factory=list)

# ─── 命名空间 ────────────────────────────────────────────

JATS_NS = {
    "jats": "https://jats.nlm.nih.gov/",
    "mml": "http://www.w3.org/1998/Math/MathML",
    "xlink": "http://www.w3.org/1999/xlink",
    "ali": "http://www.niso.org/schemas/ali/1.0/",
}

def _xpath(el, expr, ns=JATS_NS):
    """快捷 XPath 查询"""
    return el.xpath(expr, namespaces=ns)

def _text(el, expr, ns=JATS_NS):
    """获取 XPath 匹配的第一个文本（递归提取所有文本节点）"""
    results = el.xpath(expr, namespaces=ns)
    if not results:
        return ""
    r = results[0]
    # lxml Element: 使用 itertext() 提取所有嵌套文本
    if hasattr(r, "itertext"):
        return "".join(r.itertext()).strip()
    return str(r).strip()

# ─── 解析器 ─────────────────────────────────────────────

class JATSParser:
    """JATS XML 文件解析器"""

    def __init__(self, xml_path: str):
        self.xml_path = xml_path
        self.tree = etree.parse(xml_path)
        self.root = self.tree.getroot()

    def parse(self) -> Article:
        """解析整个 JATS XML 文件，返回 Article 对象"""
        article = Article()
        # 获取 <article> 根元素（可能在 <article> 或 <article/front> 内）
        article_el = self.root if self.root.tag.endswith("article") else None
        if article_el is None:
            article_el = self.root.find(".//{*}article")
        if article_el is None:
            article_el = self.root

        front = article_el.find(".//{*}front")
        if front is None:
            front = self.root.find(".//{*}front")

        body = article_el.find(".//{*}body")
        if body is None:
            body = self.root.find(".//{*}body")

        back = article_el.find(".//{*}back")
        if back is None:
            back = self.root.find(".//{*}back")

        if front is not None:
            self._parse_front(front, article)

        if body is not None:
            self._parse_body(body, article)

        if back is not None:
            self._parse_back(back, article)

        return article

    def _parse_front(self, front, article: Article):
        """解析 <front> 区域：标题、作者、摘要、关键词"""
        # 标题
        article.title = _text(front, ".//*[local-name()='article-title']")
        article.subtitle = _text(front, ".//*[local-name()='subtitle']")

        # DOI
        for el in front.iter():
            if el.tag.endswith("article-id") and el.get("pub-id-type") == "doi":
                article.doi = (el.text or "").strip()
                break

        # 作者
        for contrib in front.iter():
            if not contrib.tag.endswith("contrib"):
                continue
            if contrib.get("contrib-type") != "author":
                continue
            author = Author()
            author.given_name = _text(contrib, ".//*[local-name()='given-names']")
            author.surname = _text(contrib, ".//*[local-name()='surname']")
            # ORCID
            for cid in contrib.iter():
                if cid.tag.endswith("contrib-id") and cid.get("contrib-id-type") == "orcid":
                    author.orcid = (cid.text or "").strip()
                    break
            # Email
            author.email = _text(contrib, ".//*[local-name()='email']")
            article.authors.append(author)

        # ⚠ 简化处理：作者与机构的关联关系在完整版中进一步实现

        # 摘要
        article.abstract = _text(front, ".//*[local-name()='abstract']")

        # 关键词
        for kwd in front.iter():
            if kwd.tag.endswith("kwd"):
                text = (kwd.text or "").strip()
                if text:
                    article.keywords.append(text)

    def _parse_body(self, body, article: Article):
        """解析 <body> 区域：章节、段落、图表、公式"""
        current_section = None
        section_stack: list[Section] = []

        for el in body.iter():
            tag = el.tag.split("}")[-1] if "}" in el.tag else el.tag

            if tag == "sec":
                level = self._get_section_level(el)
                sec = Section(
                    title=_text(el, "./*[local-name()='title']"),
                    level=level,
                )
                # 找到合适的父章节
                while section_stack and section_stack[-1].level >= level:
                    section_stack.pop()
                if section_stack:
                    section_stack[-1].subsections.append(sec)
                else:
                    article.sections.append(sec)
                section_stack.append(sec)
                current_section = sec

            elif tag == "p" and el.text:
                text = "".join(el.itertext()).strip()
                if text and current_section:
                    current_section.paragraphs.append(text)

            elif tag == "fig":
                fig = self._parse_figure(el)
                if current_section:
                    current_section.figures.append(fig)
                else:
                    article.figures.append(fig)

            elif tag == "table-wrap":
                tbl = self._parse_table(el)
                if current_section:
                    current_section.tables.append(tbl)
                else:
                    article.tables.append(tbl)

            elif tag == "disp-formula":
                formula = self._parse_formula(el, inline=False)
                if current_section:
                    current_section.formulas.append(formula)

    def _parse_back(self, back, article: Article):
        """解析 <back> 区域：参考文献"""
        for ref in back.iter():
            if not ref.tag.endswith("ref"):
                continue
            r = Reference()
            r.id = ref.get("id", "")
            # 作者
            person_names = []
            for pn in ref.iter():
                if pn.tag.endswith("person-name"):
                    sn = _text(pn, ".//*[local-name()='surname']")
                    gn = _text(pn, ".//*[local-name()='given-names']")
                    person_names.append(f"{gn} {sn}".strip())
            r.authors = ", ".join(person_names)
            r.title = _text(ref, ".//*[local-name()='article-title']")
            r.journal = _text(ref, ".//*[local-name()='source']")
            r.year = _text(ref, ".//*[local-name()='year']")
            r.volume = _text(ref, ".//*[local-name()='volume']")
            r.issue = _text(ref, ".//*[local-name()='issue']")
            r.pages = _text(ref, ".//*[local-name()='fpage']")
            r.doi = _text(ref, ".//*[local-name()='pub-id' and @pub-id-type='doi']")
            r.url = _text(ref, ".//*[local-name()='ext-link']")
            article.references.append(r)

    # ─── 辅助方法 ───────────────────────────────────────

    def _get_section_level(self, el) -> int:
        """推断章节层级"""
        depth = 0
        parent = el.getparent()
        while parent is not None:
            tag = parent.tag.split("}")[-1] if "}" in parent.tag else parent.tag
            if tag == "sec":
                depth += 1
            parent = parent.getparent()
        return min(depth + 1, 6)  # 最多6级

    def _parse_figure(self, fig_el) -> Figure:
        fig = Figure()
        fig.id = fig_el.get("id", "")
        fig.label = _text(fig_el, ".//*[local-name()='label']")
        fig.caption = _text(fig_el, ".//*[local-name()='caption']//*[local-name()='p']")
        if not fig.caption:
            fig.caption = _text(fig_el, ".//*[local-name()='caption']")
        # 图片路径
        graphic = fig_el.find(".//{*}graphic")
        if graphic is not None:
            fig.graphic_href = graphic.get("{http://www.w3.org/1999/xlink}href", "")
        fig.credit = _text(fig_el, ".//*[local-name()='attrib']")
        return fig

    def _parse_table(self, tbl_el) -> Table:
        tbl = Table()
        tbl.id = tbl_el.get("id", "")
        tbl.label = _text(tbl_el, ".//*[local-name()='label']")
        tbl.caption = _text(tbl_el, ".//*[local-name()='caption']//*[local-name()='p']")
        # 表头
        for th in tbl_el.iter():
            if th.tag.endswith("th") and th.text:
                tbl.headers.append(th.text.strip())
        # 数据行
        for tr in tbl_el.iter():
            if not tr.tag.endswith("tr"):
                continue
            row = []
            for td in tr:
                if td.tag.endswith("td"):
                    row.append("".join(td.itertext()).strip())
            if row:
                tbl.rows.append(row)
        return tbl

    def _parse_formula(self, fm_el, inline: bool = False) -> Formula:
        fm = Formula()
        fm.id = fm_el.get("id", "")
        fm.label = _text(fm_el, ".//*[local-name()='label']")
        fm.is_inline = inline
        # 提取 MathML
        mml = fm_el.find(".//{http://www.w3.org/1998/Math/MathML}math")
        if mml is not None:
            fm.mathml = etree.tostring(mml, encoding="unicode", pretty_print=True)
        else:
            # 尝试任何命名空间的 math
            for child in fm_el.iter():
                if child.tag.endswith("math"):
                    fm.mathml = etree.tostring(child, encoding="unicode", pretty_print=True)
                    break
        # 也尝试提取 TeX 替代文本
        tex = fm_el.find(".//{*}tex-math")
        if tex is not None and tex.text:
            fm.latex = tex.text.strip()
        return fm
