"""
JATS XML 解析器
将 JATS 1.0/1.1 标准 XML 文件解析为结构化的 Python 数据模型

JATS (Journal Article Tag Suite) 参考: https://jats.nlm.nih.gov/

数据模型支持：
- 标题/副标题/期刊名/DOI
- 作者(含 ORCID、email、机构关联) + 机构列表
- 中英双语摘要 / 关键词
- 章节树(多级嵌套) + 段落(含内联交叉引用 <xref>、行内公式 <inline-formula>)
- 图/表/公式(带按文档顺序的自动编号 number)
- 参考文献(作者/起止页/出版类型/出版社，供 Elsevier 与 GB-T 7714 格式化)
- xref_map: rid → {type, number, anchor, label}，供模板渲染可点击交叉引用
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
    affiliation: str = ""        # 机构序号(上标)，如 "1" 或 "1,2"
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
    number: int = 0          # 自动编号(按文档顺序)

@dataclass
class Table:
    """表格"""
    id: str = ""
    label: str = ""
    caption: str = ""
    headers: list[str] = field(default_factory=list)
    rows: list[list[str]] = field(default_factory=list)
    number: int = 0

@dataclass
class Formula:
    """数学公式"""
    id: str = ""
    label: str = ""          # (1)、(2)
    mathml: str = ""         # MathML 标记(预渲染后替换为 <svg>)
    latex: str = ""          # LaTeX 备用形式
    is_inline: bool = False
    is_svg: bool = False     # True 表示 mathml 包含预渲染的 SVG
    number: int = 0          # 块级公式自动编号

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
    pages: str = ""          # 起止页 "1192-1200"
    doi: str = ""
    url: str = ""
    pub_type: str = ""       # publication-type: journal/book/conference/thesis/web
    publisher: str = ""
    publisher_loc: str = ""
    edition: str = ""
    number: int = 0          # 参考文献序号（供 bibr 交叉引用渲染为 [N]）

@dataclass
class Run:
    """段落内联片段：文本 / 交叉引用 / 行内公式"""
    kind: str = "text"       # text | xref | formula
    text: str = ""
    rid: str = ""            # xref 目标 id
    ref_type: str = ""       # fig / table / aff / bibr ...
    formula: Optional[Formula] = None  # 行内公式

@dataclass
class Paragraph:
    """段落：有序的内联片段序列"""
    runs: list = field(default_factory=list)

@dataclass
class Section:
    """论文章节"""
    title: str = ""
    level: int = 1           # 1=一级标题, 2=二级标题...
    paragraphs: list[Paragraph] = field(default_factory=list)
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
    abstract_en: str = ""            # 英文摘要(trans-abstract / abstract xml:lang=en)
    keywords: list[str] = field(default_factory=list)
    keywords_en: list[str] = field(default_factory=list)
    doi: str = ""
    journal: str = ""
    lang: str = "zh"        # zh / en，决定图表/标题标签语言
    sections: list[Section] = field(default_factory=list)
    references: list[Reference] = field(default_factory=list)
    figures: list[Figure] = field(default_factory=list)    # 浮动图表
    tables: list[Table] = field(default_factory=list)
    xref_map: dict = field(default_factory=dict)  # rid → {type,number,anchor,label}

    # ── 交叉引用解析辅助（供模板调用）──
    @staticmethod
    def _rids(rid: str) -> list:
        """rid 可能是空格分隔的多个 id（如 bibr rid="b1 b2"）。"""
        return rid.split() if rid else []

    def xref_anchor(self, rid: str) -> str:
        """取首个 rid 的锚点（多 rid 时链接指向第一个）。"""
        rids = self._rids(rid)
        if not rids:
            return rid
        info = self.xref_map.get(rids[0])
        return info["anchor"] if info else rids[0]

    def xref_label(self, rid: str, fallback: str = "") -> str:
        """交叉引用显示文本：图N / 表N / (N) / [N]；多 rid 合并；任一未登记则回退 fallback（原文）。"""
        rids = self._rids(rid)
        if not rids:
            return fallback
        labels = []
        for r in rids:
            info = self.xref_map.get(r)
            if not info:
                return fallback  # 含未登记 rid（如 box/sec）→ 用原文
            labels.append(info["label"])
        return labels[0] if len(labels) == 1 else ", ".join(labels)

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

def _local(tag: str) -> str:
    """去掉命名空间前缀的本地标签名"""
    if not isinstance(tag, str):
        return ""
    return tag.split("}")[-1] if "}" in tag else tag

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

        # 语言检测（决定图表/章节标签语言：图/Figure、参考文献/References）
        al = (article_el.get("{http://www.w3.org/XML/1998/namespace}lang", "") or "").lower()
        if al.startswith("en"):
            article.lang = "en"
        elif al.startswith("zh"):
            article.lang = "zh"
        else:
            # 无 xml:lang：按标题是否含汉字判定
            article.lang = "zh" if any("一" <= c <= "鿿" for c in article.title) else "en"

        # 自动编号 + 构建 xref_map（图表/公式按文档顺序 + 参考文献供 bibr 引用）
        self._number_and_index(article)

        return article

    # ── front：标题、作者、机构、摘要、关键词 ──

    def _parse_front(self, front, article: Article):
        # 标题
        article.title = _text(front, ".//*[local-name()='article-title']")
        article.subtitle = _text(front, ".//*[local-name()='subtitle']")

        # 期刊名（journal-meta/journal-title-group/journal-title）— 用于页眉 running header
        article.journal = _text(front, ".//*[local-name()='journal-title']")

        # DOI
        for el in front.iter():
            if el.tag.endswith("article-id") and el.get("pub-id-type") == "doi":
                article.doi = (el.text or "").strip()
                break

        # 机构 <aff>（先解析，供作者关联查序号）
        aff_index: dict[str, int] = {}   # aff id → 序号
        for aff in front.iter():
            if not _local(aff.tag) == "aff":
                continue
            a = Affiliation()
            a.id = aff.get("id", "")
            # 机构名：优先 <institution>，其次 <named-content>，最后整段文本（去掉 label）
            a.name = _text(aff, ".//*[local-name()='institution']")
            if not a.name:
                a.name = _text(aff, ".//*[local-name()='named-content']")
            if not a.name:
                a.name = "".join(aff.itertext()).strip()
                # 去掉开头的机构编号 label（如 "1 " 或 "1. "）
                a.name = a.name.lstrip("0123456789.- ").strip()
            a.department = _text(aff, ".//*[local-name()='institution'][@content-type='dept']")
            a.city = _text(aff, ".//*[local-name()='addr-line']")
            a.country = _text(aff, ".//*[local-name()='country']")
            if a.id:
                aff_index[a.id] = len(article.affiliations) + 1
            article.affiliations.append(a)

        # 作者
        for contrib in front.iter():
            if not _local(contrib.tag) == "contrib":
                continue
            if contrib.get("contrib-type") != "author":
                continue
            author = Author()
            author.given_name = _text(contrib, ".//*[local-name()='given-names']")
            author.surname = _text(contrib, ".//*[local-name()='surname']")
            # ORCID
            for cid in contrib.iter():
                if _local(cid.tag) == "contrib-id" and cid.get("contrib-id-type") == "orcid":
                    author.orcid = (cid.text or "").strip()
                    break
            # Email
            author.email = _text(contrib, ".//*[local-name()='email']")
            # 机构关联：<xref ref-type="aff" rid="aff1"/>
            aff_nums = []
            for xr in contrib.iter():
                if _local(xr.tag) == "xref" and xr.get("ref-type") == "aff":
                    rid = xr.get("rid", "")
                    if rid in aff_index:
                        aff_nums.append(str(aff_index[rid]))
            author.affiliation = ", ".join(aff_nums)
            article.authors.append(author)

        # 摘要：按 xml:lang 区分中/英（trans-abstract 也视为英文）
        for ab in front.iter():
            if _local(ab.tag) == "abstract":
                lang = ab.get("{http://www.w3.org/XML/1998/namespace}lang", "")
                text = _text(ab, ".//*[local-name()='p']") or "".join(ab.itertext()).strip()
                if not text:
                    continue
                if lang.lower().startswith("en"):
                    article.abstract_en = text
                else:
                    if not article.abstract:
                        article.abstract = text
            elif _local(ab.tag) == "trans-abstract":
                text = _text(ab, ".//*[local-name()='p']") or "".join(ab.itertext()).strip()
                if text:
                    article.abstract_en = text

        # 关键词：按 <kwd-group> 的 xml:lang 分组
        for kg in front.iter():
            if _local(kg.tag) != "kwd-group":
                continue
            lang = kg.get("{http://www.w3.org/XML/1998/namespace}lang", "")
            kwds = [(_text_or_text(k) or "").strip() for k in kg.iter() if _local(k.tag) == "kwd"]
            kwds = [k for k in kwds if k]
            if lang.lower().startswith("en"):
                article.keywords_en.extend(kwds)
            else:
                article.keywords.extend(kwds)

        # 兜底：若无分组关键词，扫所有 <kwd>
        if not article.keywords:
            for kwd in front.iter():
                if _local(kwd.tag) == "kwd":
                    t = (kwd.text or "").strip()
                    if t:
                        article.keywords.append(t)

    # ── body：章节、段落(含 xref/inline-formula)、图表、公式 ──

    def _parse_body(self, body, article: Article):
        current_section = None
        section_stack: list[Section] = []

        for el in body.iter():
            tag = _local(el.tag)

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

            elif tag == "p":
                para = self._parse_paragraph(el)
                if para.runs and current_section:
                    current_section.paragraphs.append(para)

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

            # inline-formula 由 _parse_paragraph 在段落内部捕获为 FormulaRun，不在此重复登记

    def _parse_paragraph(self, p_el) -> Paragraph:
        """解析 <p> 为 Paragraph，按直接子节点顺序保留 <xref> 与 <inline-formula> 的内联结构。"""
        para = Paragraph()
        # <p> 起始文本
        if p_el.text:
            para.runs.append(Run(kind="text", text=p_el.text))
        for child in p_el:
            tag = _local(child.tag)
            if tag == "xref":
                rid = child.get("rid", "")
                ref_type = child.get("ref-type", "")
                xtext = "".join(child.itertext()).strip()
                para.runs.append(Run(kind="xref", rid=rid, ref_type=ref_type, text=xtext))
            elif tag == "inline-formula":
                fm = self._parse_formula(child, inline=True)
                para.runs.append(Run(kind="formula", formula=fm))
            else:
                # 其他内联元素（<italic>/<bold>/<sub>/<sup>...）→ 取全部文本
                para.runs.append(Run(kind="text", text="".join(child.itertext())))
            # 该子元素之后的尾部文本
            if child.tail:
                para.runs.append(Run(kind="text", text=child.tail))
        para.runs = self._merge_text_runs(para.runs)
        return para

    @staticmethod
    def _merge_text_runs(runs: list) -> list:
        out = []
        buf = ""
        for r in runs:
            if r.kind == "text":
                buf += r.text
            else:
                if buf:
                    out.append(Run(kind="text", text=buf))
                    buf = ""
                out.append(r)
        if buf:
            out.append(Run(kind="text", text=buf))
        return out

    # ── back：参考文献 ──

    def _parse_back(self, back, article: Article):
        for ref in back.iter():
            if not _local(ref.tag) == "ref":
                continue
            r = Reference()
            r.id = ref.get("id", "")
            # 出版类型（element-citation @publication-type）→ GB-T 7714 类型标识
            cite = ref.find(".//*[@publication-type]")
            if cite is not None:
                r.pub_type = cite.get("publication-type", "")
            # 作者：JATS 标准是 <person-group> 内的 <name>(surname/given-names)
            person_names = []
            for name in ref.iter():
                if _local(name.tag) == "name" and _local(name.getparent().tag) == "person-group":
                    sn = _text(name, ".//*[local-name()='surname']")
                    gn = _text(name, ".//*[local-name()='given-names']")
                    person_names.append(f"{gn} {sn}".strip())
            r.authors = ", ".join(person_names)
            r.title = _text(ref, ".//*[local-name()='article-title']")
            if not r.title:
                r.title = _text(ref, ".//*[local-name()='data-title']")
            r.journal = _text(ref, ".//*[local-name()='source']")
            r.year = _text(ref, ".//*[local-name()='year']")
            r.volume = _text(ref, ".//*[local-name()='volume']")
            r.issue = _text(ref, ".//*[local-name()='issue']")
            # 起止页区间
            fp = _text(ref, ".//*[local-name()='fpage']")
            lp = _text(ref, ".//*[local-name()='lpage']")
            if fp and lp:
                r.pages = f"{fp}-{lp}"
            elif fp:
                r.pages = fp
            elif lp:
                r.pages = lp
            r.doi = _text(ref, ".//*[local-name()='pub-id' and @pub-id-type='doi']")
            r.url = _text(ref, ".//*[local-name()='ext-link']")
            r.publisher = _text(ref, ".//*[local-name()='publisher-name']")
            r.publisher_loc = _text(ref, ".//*[local-name()='publisher-loc']")
            r.edition = _text(ref, ".//*[local-name()='edition']")
            article.references.append(r)

    # ─── 自动编号 + xref_map ───────────────────────────

    def _number_and_index(self, article: Article):
        """按文档顺序对图/表/块级公式自动编号，并构建 rid→信息 映射；登记参考文献供 bibr 引用。"""
        fig_tmpl = "图{n}" if article.lang == "zh" else "Figure {n}"
        tbl_tmpl = "表{n}" if article.lang == "zh" else "Table {n}"
        fig_no = tbl_no = eq_no = 0

        def reg(obj, kind, num, label_tmpl):
            obj.number = num
            obj.label = label_tmpl.format(n=num)
            anchor = obj.id or f"{kind}-{num}"
            article.xref_map[anchor] = {
                "type": kind, "number": num, "anchor": anchor,
                "label": label_tmpl.format(n=num),
            }
            # 同时按原始 id 登记（若与 anchor 不同）
            if obj.id and obj.id != anchor:
                article.xref_map[obj.id] = article.xref_map[anchor]

        def walk(sections):
            nonlocal fig_no, tbl_no, eq_no
            for sec in sections:
                for fig in sec.figures:
                    fig_no += 1
                    reg(fig, "fig", fig_no, fig_tmpl)
                for tbl in sec.tables:
                    tbl_no += 1
                    reg(tbl, "table", tbl_no, tbl_tmpl)
                for fm in sec.formulas:
                    if fm.is_inline:
                        continue
                    eq_no += 1
                    reg(fm, "formula", eq_no, "({n})")
                walk(sec.subsections)

        walk(article.sections)
        # 浮动图表（不在 section 内的）
        for fig in article.figures:
            fig_no += 1
            reg(fig, "fig", fig_no, fig_tmpl)
        for tbl in article.tables:
            tbl_no += 1
            reg(tbl, "table", tbl_no, tbl_tmpl)

        # 参考文献编号 + 登记（供 bibr 交叉引用渲染为 [N]，锚点指向参考文献列表项）
        for i, ref in enumerate(article.references, 1):
            ref.number = i
            if not ref.id:
                ref.id = f"ref-{i}"
            article.xref_map[ref.id] = {
                "type": "bibr", "number": i, "anchor": ref.id, "label": f"[{i}]",
            }

    # ─── 辅助方法 ───────────────────────────────────────

    def _get_section_level(self, el) -> int:
        """推断章节层级"""
        depth = 0
        parent = el.getparent()
        while parent is not None:
            if _local(parent.tag) == "sec":
                depth += 1
            parent = parent.getparent()
        return min(depth + 1, 6)  # 最多6级

    def _parse_figure(self, fig_el) -> Figure:
        fig = Figure()
        fig.id = fig_el.get("id", "")
        fig.label = _text(fig_el, ".//*[local-name()='label']")
        fig.caption = _text(fig_el, ".//*[local-name()='caption']//*[local-name()='p']")
        if not fig.caption:
            fig.caption = _text(fig_el, ".//*[local-name()='caption']//*[local-name()='title']")
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
        # 题注回退：caption/p → caption/title → 整个 caption
        tbl.caption = _text(tbl_el, ".//*[local-name()='caption']//*[local-name()='p']")
        if not tbl.caption:
            tbl.caption = _text(tbl_el, ".//*[local-name()='caption']//*[local-name()='title']")
        if not tbl.caption:
            tbl.caption = _text(tbl_el, ".//*[local-name()='caption']")
        # 表头
        for th in tbl_el.iter():
            if _local(th.tag) == "th" and th.text:
                tbl.headers.append(th.text.strip())
        # 数据行
        for tr in tbl_el.iter():
            if _local(tr.tag) != "tr":
                continue
            row = []
            for td in tr:
                if _local(td.tag) == "td":
                    row.append("".join(td.itertext()).strip())
            if row:
                tbl.rows.append(row)
        return tbl

    def _parse_formula(self, fm_el, inline: bool = False) -> Formula:
        fm = Formula()
        fm.id = fm_el.get("id", "")
        fm.label = _text(fm_el, ".//*[local-name()='label']")
        fm.is_inline = inline
        # 提取 MathML（优先 mml 命名空间，再回退任意命名空间的 math）
        mml = fm_el.find(".//{http://www.w3.org/1998/Math/MathML}math")
        if mml is not None:
            fm.mathml = etree.tostring(mml, encoding="unicode", pretty_print=True)
        else:
            for child in fm_el.iter():
                if _local(child.tag) == "math":
                    fm.mathml = etree.tostring(child, encoding="unicode", pretty_print=True)
                    break
        # 也尝试提取 TeX 替代文本
        tex = fm_el.find(".//{*}tex-math")
        if tex is not None and tex.text:
            fm.latex = tex.text.strip()
        return fm


def _text_or_text(el) -> str:
    """取元素文本（优先 .text，否则 itertext）"""
    if el.text and el.text.strip():
        return el.text
    return "".join(el.itertext())
