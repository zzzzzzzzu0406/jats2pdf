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
from typing import Any, Optional
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
class TableCell:
    """JATS 表格单元格，保留结构化排版信息。"""
    text: str = ""
    colspan: int = 1
    rowspan: int = 1
    is_header: bool = False
    align: str = ""


@dataclass
class Table:
    """表格。

    headers/rows 保留给旧模板、旧测试和已存储 pickle 降级使用；
    新渲染优先使用 header_rows/body_rows，以保留多行表头与跨行跨列。
    """
    id: str = ""
    label: str = ""
    caption: str = ""
    headers: list[str] = field(default_factory=list)
    rows: list[list[str]] = field(default_factory=list)
    header_rows: list[list[TableCell]] = field(default_factory=list)
    body_rows: list[list[TableCell]] = field(default_factory=list)
    footnotes: list[str] = field(default_factory=list)
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
class ContentBlock:
    """正文中的有序内容块。

    kind: paragraph | section | figure | table | formula
    value: 对应的 Paragraph / Section / Figure / Table / Formula 对象
    """

    kind: str = "paragraph"
    value: Any = None


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
    blocks: list[ContentBlock] = field(default_factory=list)

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
    pmcid: str = ""
    journal: str = ""
    publication_year: Optional[int] = None
    lang: str = "zh"        # zh / en，决定图表/标题标签语言
    sections: list[Section] = field(default_factory=list)
    references: list[Reference] = field(default_factory=list)
    figures: list[Figure] = field(default_factory=list)    # 浮动图表
    tables: list[Table] = field(default_factory=list)
    formulas: list[Formula] = field(default_factory=list)
    blocks: list[ContentBlock] = field(default_factory=list)
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
        parser = etree.XMLParser(
            resolve_entities=False,
            no_network=True,
            recover=False,
            huge_tree=False,
        )
        self.tree = etree.parse(xml_path, parser)
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

        # 某些真实 JATS（如 PMC 的 flat XML）把 ref-list 放在 body/sec 中而没有 back。
        # 有 back 时限制在 back 内，避免扫描无关节点；无 back 时回退扫描整篇 article。
        self._parse_back(back if back is not None else article_el, article)

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

        # DOI / PMCID（PMCID 用于缺失图片时解析可信 PMC CDN 资源）
        for el in front.iter():
            if _local(el.tag) != "article-id":
                continue
            id_type = (el.get("pub-id-type") or "").lower()
            value = (el.text or "").strip()
            if id_type == "doi" and not article.doi:
                article.doi = value
            elif id_type in {"pmcid", "pmc", "pmcaid"} and not article.pmcid:
                article.pmcid = value.upper()
                if article.pmcid.isdigit():
                    article.pmcid = f"PMC{article.pmcid}"

        # 文章出版年份（供平台筛选；不能用第一条参考文献年份代替）
        year_text = _text(
            front,
            ".//*[local-name()='article-meta']/*[local-name()='pub-date'][1]/*[local-name()='year']",
        )
        if year_text.isdigit():
            article.publication_year = int(year_text)

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
            contrib_type = (contrib.get("contrib-type") or "").lower()
            parent = contrib.getparent()
            group_type = ""
            if parent is not None and _local(parent.tag) == "contrib-group":
                group_type = (
                    parent.get("content-type")
                    or parent.get("contrib-type")
                    or ""
                ).lower()
            # 真实 PMC 常用 <contrib-group content-type="author"><contrib>，
            # 单个 contrib 不一定带 contrib-type。明确为非作者的贡献者仍跳过。
            if contrib_type and contrib_type != "author":
                continue
            if not contrib_type and group_type and group_type not in {"author", "authors"}:
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
        """按 XML 直接子节点递归解析，保留段落/图/表/公式/子章节的真实顺序。

        旧实现使用 ``body.iter()`` 扁平遍历，无法感知离开子章节的时刻，导致父章节
        尾段和 body 根段被错误归入最后一个子章节；caption 内的 p 也会被重复当正文。
        """
        for child in body:
            self._parse_content_child(child, article)

    def _parse_section(self, sec_el) -> Section:
        """递归解析单个 <sec>，并保留其直接子内容顺序。"""
        section = Section(
            title=_text(sec_el, "./*[local-name()='title']"),
            level=self._get_section_level(sec_el),
        )
        for child in sec_el:
            if _local(child.tag) == "title":
                continue
            self._parse_content_child(child, section)
        return section

    def _parse_content_child(self, el, container):
        """解析 body/sec 的一个直接子元素并追加到有序 blocks。"""
        tag = _local(el.tag)

        if tag == "sec":
            if (el.get("sec-type") or "").lower() == "ref-list":
                return
            self._append_block(container, "section", self._parse_section(el))
        elif tag == "p":
            para = self._parse_paragraph(el)
            if para.runs:
                self._append_block(container, "paragraph", para)
        elif tag == "fig":
            self._append_block(container, "figure", self._parse_figure(el))
        elif tag == "table-wrap":
            self._append_block(container, "table", self._parse_table(el))
        elif tag == "disp-formula":
            self._append_block(
                container,
                "formula",
                self._parse_formula(el, inline=False),
            )
        elif tag in {"fig-group", "boxed-text", "list", "list-item"}:
            # 常见正文容器：只递归其直接内容，仍然避开 caption/table 内部的 p。
            for child in el:
                child_tag = _local(child.tag)
                if child_tag in {"title", "label", "caption"}:
                    continue
                self._parse_content_child(child, container)

    @staticmethod
    def _append_block(container, kind: str, value):
        """同时维护新 blocks 与旧分类列表，兼容既有调用和历史 pickle。"""
        container.blocks.append(ContentBlock(kind=kind, value=value))

        if isinstance(container, Article):
            if kind == "section":
                container.sections.append(value)
            elif kind == "figure":
                container.figures.append(value)
            elif kind == "table":
                container.tables.append(value)
            elif kind == "formula":
                container.formulas.append(value)
            return

        if kind == "paragraph":
            container.paragraphs.append(value)
        elif kind == "section":
            container.subsections.append(value)
        elif kind == "figure":
            container.figures.append(value)
        elif kind == "table":
            container.tables.append(value)
        elif kind == "formula":
            container.formulas.append(value)

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
            if not r.doi:
                doi_links = ref.xpath(
                    ".//*[local-name()='ext-link' and @ext-link-type='doi']"
                )
                if doi_links:
                    doi_el = doi_links[0]
                    r.doi = (
                        doi_el.get("{http://www.w3.org/1999/xlink}href", "")
                        or "".join(doi_el.itertext()).strip()
                    )
            if not r.url:
                url_links = ref.xpath(
                    ".//*[local-name()='ext-link' and (@ext-link-type='uri' or @ext-link-type='url')]"
                )
                if url_links:
                    url_el = url_links[0]
                    r.url = (
                        url_el.get("{http://www.w3.org/1999/xlink}href", "")
                        or "".join(url_el.itertext()).strip()
                    )
            r.publisher = _text(ref, ".//*[local-name()='publisher-name']")
            r.publisher_loc = _text(ref, ".//*[local-name()='publisher-loc']")
            r.edition = _text(ref, ".//*[local-name()='edition']")

            # mixed-citation 常只有整条 citation-string，没有结构化作者/题名字段。
            # 保留原始引用文本，至少保证真实论文不会静默丢失参考文献内容。
            if not (r.authors or r.title or r.journal):
                raw = _text(
                    ref,
                    ".//*[local-name()='named-content' and @content-type='citation-string']",
                )
                if not raw:
                    raw = _text(ref, ".//*[local-name()='mixed-citation']")
                r.title = raw
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

        def register_block(block):
            nonlocal fig_no, tbl_no, eq_no
            if block.kind == "figure":
                fig_no += 1
                reg(block.value, "fig", fig_no, fig_tmpl)
            elif block.kind == "table":
                tbl_no += 1
                reg(block.value, "table", tbl_no, tbl_tmpl)
            elif block.kind == "formula" and not block.value.is_inline:
                eq_no += 1
                reg(block.value, "formula", eq_no, "({n})")
            elif block.kind == "section":
                walk_section(block.value)

        def walk_section(sec):
            nonlocal fig_no, tbl_no, eq_no
            if getattr(sec, "blocks", None):
                for block in sec.blocks:
                    register_block(block)
            else:
                # 兼容旧对象：旧模型没有 blocks，只能按原分类列表顺序编号。
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
                for sub in sec.subsections:
                    walk_section(sub)

        if getattr(article, "blocks", None):
            for block in article.blocks:
                register_block(block)
        else:
            for sec in article.sections:
                walk_section(sec)
            # 兼容旧对象中的根级浮动内容。
            for fig in article.figures:
                fig_no += 1
                reg(fig, "fig", fig_no, fig_tmpl)
            for tbl in article.tables:
                tbl_no += 1
                reg(tbl, "table", tbl_no, tbl_tmpl)
            for fm in getattr(article, "formulas", []):
                eq_no += 1
                reg(fm, "formula", eq_no, "({n})")

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

        # table-wrap 中可能还有表注等元素，只解析实际 <table> 内的行。
        table_el = tbl_el if _local(tbl_el.tag) == "table" else None
        if table_el is None:
            table_el = next(
                (node for node in tbl_el.iter() if _local(node.tag) == "table"),
                None,
            )

        def parse_span(raw: str | None) -> int:
            try:
                value = int(raw or "1")
            except (TypeError, ValueError):
                return 1
            return value if 1 <= value <= 1000 else 1

        def parse_row(tr, force_header: bool = False) -> list[TableCell]:
            cells = []
            for cell_el in tr:
                cell_type = _local(cell_el.tag)
                if cell_type not in {"td", "th"}:
                    continue
                align = (cell_el.get("align", "") or "").strip().lower()
                if align not in {"left", "center", "right", "char"}:
                    align = ""
                cells.append(TableCell(
                    text="".join(cell_el.itertext()).strip(),
                    colspan=parse_span(cell_el.get("colspan")),
                    rowspan=parse_span(cell_el.get("rowspan")),
                    is_header=force_header or cell_type == "th",
                    align=align,
                ))
            return cells

        if table_el is not None:
            for group in table_el:
                group_type = _local(group.tag)
                if group_type == "thead":
                    for tr in group:
                        if _local(tr.tag) == "tr":
                            row = parse_row(tr, force_header=True)
                            if row:
                                tbl.header_rows.append(row)
                elif group_type in {"tbody", "tfoot"}:
                    for tr in group:
                        if _local(tr.tag) == "tr":
                            row = parse_row(tr)
                            if row:
                                tbl.body_rows.append(row)
                elif group_type == "tr":
                    row = parse_row(group)
                    if not row:
                        continue
                    if all(cell.is_header for cell in row):
                        tbl.header_rows.append(row)
                    else:
                        tbl.body_rows.append(row)

        # 兼容字段：新对象仍可被旧模板或外部调用方消费。
        tbl.headers = [cell.text for row in tbl.header_rows for cell in row]
        tbl.rows = [[cell.text for cell in row] for row in tbl.body_rows]

        # 表注位于 table-wrap-foot，不能丢入普通数据行。
        foot = next(
            (node for node in tbl_el.iter() if _local(node.tag) == "table-wrap-foot"),
            None,
        )
        if foot is not None:
            footnotes = []
            fn_nodes = [node for node in foot.iter() if _local(node.tag) == "fn"]
            for fn in fn_nodes:
                label = next(
                    (
                        "".join(child.itertext()).strip()
                        for child in fn
                        if _local(child.tag) == "label"
                    ),
                    "",
                )
                paragraphs = [
                    "".join(node.itertext()).strip()
                    for node in fn.iter()
                    if _local(node.tag) == "p"
                ]
                for index, text in enumerate(paragraphs):
                    if text:
                        footnotes.append(
                            f"{label} {text}".strip() if index == 0 and label else text
                        )
            if not fn_nodes:
                footnotes = [
                    "".join(node.itertext()).strip()
                    for node in foot.iter()
                    if _local(node.tag) == "p" and "".join(node.itertext()).strip()
                ]
            tbl.footnotes = footnotes
            if not tbl.footnotes:
                text = "".join(foot.itertext()).strip()
                if text:
                    tbl.footnotes.append(text)
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
