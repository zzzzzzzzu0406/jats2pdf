import { Fragment, useState, useRef, useCallback, useEffect } from "react";
import {
  Upload, Printer, Globe, Eye, Edit3,
  Plus, Trash2, ChevronDown, ChevronRight, BookOpen,
  FileDown, AlignLeft, Columns, AlertCircle, CheckCircle2,
  Share2, Bookmark, ExternalLink, SlidersHorizontal, RotateCcw,
  Type as TypeIcon, Rows3,
} from "lucide-react";
import type { FigureItem, PaperData, Section, TableCell, TableItem } from "./types";
import { DEMO } from "./demo";

/* ─── constants ──────────────────────────────────────────────────────── */
const SERIF = "'Source Serif 4', 'Times New Roman', Georgia, serif";
const SANS  = "'Inter', system-ui, sans-serif";
const MONO  = "'JetBrains Mono', monospace";
type Lang = "en" | "zh" | "both";
type EditorTab = "basic" | "abstract" | "sections" | "figures" | "refs";

// 排版设置使用受限枚举，避免把任意字符串直接写入打印样式。
type FontStyle = "academic" | "modern" | "international";
type FontFamily = "auto" | "song" | "times" | "sans" | "kai";
type FontSize = "small" | "medium" | "large";
type LineHeight = "compact" | "standard" | "relaxed";

interface TypographySettings {
  fontStyle: FontStyle;
  fontFamily: FontFamily;
  fontSize: FontSize;
  lineHeight: LineHeight;
}

const DEFAULT_TYPOGRAPHY: TypographySettings = {
  fontStyle: "academic",
  fontFamily: "auto",
  fontSize: "medium",
  lineHeight: "standard",
};

const TYPOGRAPHY_STORAGE_KEY = "scholartype-studio-typography";
const COLUMNS_STORAGE_KEY = "scholartype-studio-columns";

// 每种排版风格分别定义正文、标题和图表题注字体，并提供跨平台回退链。
const STYLE_FONTS: Record<FontStyle, { body: string; heading: string; caption: string }> = {
  academic: {
    body: "'Source Serif 4', 'Songti SC', STSong, SimSun, 'Noto Serif CJK SC', 'Times New Roman', serif",
    heading: "Inter, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', Arial, sans-serif",
    caption: "Inter, 'PingFang SC', 'Noto Sans CJK SC', Arial, sans-serif",
  },
  modern: {
    body: "Inter, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', Arial, sans-serif",
    heading: "Inter, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', Arial, sans-serif",
    caption: "Inter, 'PingFang SC', 'Noto Sans CJK SC', Arial, sans-serif",
  },
  international: {
    body: "'Times New Roman', 'Source Serif 4', 'Songti SC', STSong, 'Noto Serif CJK SC', serif",
    heading: "Arial, Helvetica, 'PingFang SC', 'Noto Sans CJK SC', sans-serif",
    caption: "Arial, Helvetica, 'PingFang SC', 'Noto Sans CJK SC', sans-serif",
  },
};

const FAMILY_FONTS: Record<Exclude<FontFamily, "auto">, string> = {
  song: "'Source Han Serif SC', 'Noto Serif CJK SC', 'Songti SC', STSong, SimSun, serif",
  times: "'Times New Roman', 'Source Serif 4', 'Noto Serif CJK SC', serif",
  sans: "Inter, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', Arial, sans-serif",
  kai: "'Kaiti SC', STKaiti, KaiTi, 'Noto Serif CJK SC', serif",
};

// URL 参数优先于本地缓存，便于分享或刷新后恢复同一套排版设置。
function initialTypography(): TypographySettings {
  let saved: Partial<TypographySettings> = {};
  try {
    saved = JSON.parse(window.localStorage.getItem(TYPOGRAPHY_STORAGE_KEY) || "{}");
  } catch {
    saved = {};
  }
  const params = new URLSearchParams(window.location.search);
  const fontStyle = params.get("font_style") || saved.fontStyle;
  const fontFamily = params.get("font_family") || saved.fontFamily;
  const fontSize = params.get("font_size") || saved.fontSize;
  const lineHeight = params.get("line_height") || saved.lineHeight;
  return {
    fontStyle: fontStyle === "modern" || fontStyle === "international" ? fontStyle : "academic",
    fontFamily: fontFamily === "song" || fontFamily === "times" || fontFamily === "sans" || fontFamily === "kai" ? fontFamily : "auto",
    fontSize: fontSize === "small" || fontSize === "large" ? fontSize : "medium",
    lineHeight: lineHeight === "compact" || lineHeight === "relaxed" ? lineHeight : "standard",
  };
}

// 分栏设置与字体设置采用相同的恢复策略。
function initialColumns(): 1 | 2 {
  const queryValue = new URLSearchParams(window.location.search).get("two_column");
  if (queryValue === "false") return 1;
  if (queryValue === "true") return 2;
  try {
    return window.localStorage.getItem(COLUMNS_STORAGE_KEY) === "1" ? 1 : 2;
  } catch {
    return 2;
  }
}

// 将界面选项转换为论文根节点的 CSS 变量，子元素和 Paged.js 可统一继承。
function paperTypographyStyle(settings: TypographySettings): React.CSSProperties {
  const preset = STYLE_FONTS[settings.fontStyle];
  const bodyFont = settings.fontFamily === "auto" ? preset.body : FAMILY_FONTS[settings.fontFamily];
  const bodySize = { small: "9.5pt", medium: "10.5pt", large: "11.5pt" }[settings.fontSize];
  const lineHeight = { compact: "1.48", standard: "1.62", relaxed: "1.76" }[settings.lineHeight];
  const styleMetrics = {
    academic: { indent: "2em", gap: "0.34em", headingColor: "#111", headingRule: "transparent" },
    modern: { indent: "0", gap: "0.62em", headingColor: "#17324d", headingRule: "#cfd8e3" },
    international: { indent: "1.2em", gap: "0.42em", headingColor: "#111", headingRule: "transparent" },
  }[settings.fontStyle];
  return {
    "--paper-body-font": bodyFont,
    "--paper-heading-font": preset.heading,
    "--paper-caption-font": preset.caption,
    "--paper-body-size": bodySize,
    "--paper-line-height": lineHeight,
    "--paper-paragraph-indent": styleMetrics.indent,
    "--paper-paragraph-gap": styleMetrics.gap,
    "--paper-heading-color": styleMetrics.headingColor,
    "--paper-heading-rule": styleMetrics.headingRule,
  } as React.CSSProperties;
}

interface EditorResponse {
  article_id: string;
  paper: PaperData;
}

interface UiCopy {
  zh: string;
  en: string;
}

/* ─── util ───────────────────────────────────────────────────────────── */
function bi(obj: { en: string; zh: string }, lang: Lang) {
  return lang === "en" ? obj.en : obj.zh;
}

function BilingualText({
  zh,
  en,
  zhSize = "0.8rem",
  enSize = "0.62rem",
  weight = 600,
  gap = 5,
  stacked = false,
}: UiCopy & {
  zhSize?: string;
  enSize?: string;
  weight?: number;
  gap?: number;
  stacked?: boolean;
}) {
  return (
    <span style={{ display: "inline-flex", flexDirection: stacked ? "column" : "row", alignItems: stacked ? "center" : "baseline", gap: stacked ? 2 : gap, whiteSpace: "nowrap", lineHeight: 1.15 }}>
      <span style={{ fontSize: zhSize, fontWeight: weight }}>{zh}</span>
      <span style={{ fontSize: enSize, fontWeight: Math.min(weight, 500), opacity: 0.62, letterSpacing: "0.01em" }}>{en}</span>
    </span>
  );
}

function tableRows(table: TableItem) {
  if (table.headerRows?.length || table.bodyRows?.length) {
    return {
      headerRows: table.headerRows || [],
      bodyRows: table.bodyRows || [],
    };
  }

  const maxColumns = Math.max(1, table.headers.length, ...table.rows.map((row) => row.cells.length));
  const legacyHeader = table.headers.map((text) => ({ text, isHeader: true, align: "center" } as TableCell));
  const missingHeaderCells = maxColumns - legacyHeader.length;
  const namedHeaderCells = legacyHeader.filter((cell) => cell.text.trim());
  if (missingHeaderCells > 0 && namedHeaderCells.length === 1) {
    namedHeaderCells[0].colspan = 1 + missingHeaderCells;
  } else {
    for (let index = 0; index < missingHeaderCells; index += 1) {
      legacyHeader.push({ text: "", isHeader: true, align: "center" });
    }
  }

  const numeric = /^[-+−]?\s*[\d.,]+(?:\s*[–-]\s*[\d.,]+)?(?:\s*[%)]|\s*\([^)]*\))?\s*$/;
  const bodyRows = table.rows.map((row, rowIndex) => {
    const cells: TableCell[] = row.cells.map((text, index) => ({
      text,
      isHeader: index === 0,
      align: numeric.test(text) ? "right" : "left",
    }));
    const missing = maxColumns - cells.length;
    const previous = rowIndex > 0 ? table.rows[rowIndex - 1].cells : [];
    if (missing > 0 && previous.length === maxColumns && previous[0]?.trim()) {
      cells.unshift(...Array.from({ length: missing }, () => ({ text: "", align: "left" })));
    } else {
      cells.push(...Array.from({ length: missing }, () => ({ text: "", align: "left" })));
    }
    return cells;
  });

  const headerRows = legacyHeader.length ? [legacyHeader] : [];
  return { headerRows, bodyRows };
}

function effectiveColumnCount(rows: TableCell[][]) {
  return Math.max(1, ...rows.map((row) => row.reduce((total, cell) => total + Math.max(1, cell.colspan || 1), 0)));
}

function ArticleTable({ table, lang, columns }: { table: TableItem; lang: Lang; columns: 1 | 2 }) {
  const bil = lang === "both";
  const showZh = lang !== "en";
  const { headerRows, bodyRows } = tableRows(table);
  const columnCount = effectiveColumnCount([...headerRows, ...bodyRows]);
  const spansColumns = columns === 2 && columnCount > 4;
  const cellStyle = (cell: TableCell, header: boolean): React.CSSProperties => ({
    padding: columnCount > 6 ? "2.5px 3px" : "3px 5px",
    border: "none",
    borderBottom: header ? "1.4px solid #111" : "0.6px solid #bbb",
    textAlign: cell.align === "center" ? "center" : cell.align === "right" || cell.align === "char" ? "right" : "left",
    verticalAlign: "middle",
    fontWeight: header || cell.isHeader ? 700 : 400,
    overflowWrap: "anywhere",
    lineHeight: 1.35,
  });

  return (
    <figure style={{ breakInside: bodyRows.length > 12 ? "auto" : "avoid", breakBefore: spansColumns && bodyRows.length > 8 ? "page" : "auto", columnSpan: spansColumns ? "all" : undefined, margin: "10px 0 12px", width: "100%" }}>
      <figcaption style={{ fontFamily: "var(--paper-caption-font)", fontSize: "calc(var(--paper-body-size) - 2.5pt)", fontWeight: 600, color: "#333", marginBottom: 5, lineHeight: 1.4 }}>
        {bil ? <>表 {table.number}. <span style={{ fontSize: "0.78em", fontWeight: 500 }}>Table {table.number}.</span></> : showZh ? `表 ${table.number}.` : `Table ${table.number}.`}{" "}
        <span style={{ fontWeight: 400 }}>
          {bil ? <><span>{table.caption.zh}</span><span style={{ marginLeft: 5, fontSize: "0.82em", color: "#666" }}>{table.caption.en}</span></> : bi(table.caption, lang)}
        </span>
      </figcaption>
      <div style={{ width: "100%", overflow: "visible" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: columnCount > 5 ? "fixed" : "auto", borderTop: "1.5px solid #111", borderBottom: "1.5px solid #111", fontFamily: "var(--paper-caption-font)", fontSize: columnCount > 7 ? "calc(var(--paper-body-size) - 4pt)" : columnCount > 5 ? "calc(var(--paper-body-size) - 3.5pt)" : "calc(var(--paper-body-size) - 2.5pt)" }}>
          {headerRows.length > 0 && (
            <thead style={{ display: "table-header-group" }}>
              {headerRows.map((row, rowIndex) => (
                <tr key={`head-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <th key={`head-${rowIndex}-${cellIndex}`} colSpan={Math.max(1, cell.colspan || 1)} rowSpan={Math.max(1, cell.rowspan || 1)} scope="col" style={cellStyle(cell, true)}>{cell.text}</th>
                  ))}
                </tr>
              ))}
            </thead>
          )}
          <tbody>
            {bodyRows.length > 0 ? bodyRows.map((row, rowIndex) => (
              <tr key={`body-${rowIndex}`}>
                {row.map((cell, cellIndex) => {
                  const Tag = cell.isHeader ? "th" : "td";
                  return <Tag key={`body-${rowIndex}-${cellIndex}`} colSpan={Math.max(1, cell.colspan || 1)} rowSpan={Math.max(1, cell.rowspan || 1)} scope={cell.isHeader ? "row" : undefined} style={cellStyle(cell, false)}>{cell.text}</Tag>;
                })}
              </tr>
            )) : (
              <tr><td colSpan={columnCount} style={{ padding: 8, textAlign: "center", color: "#777", fontStyle: "italic" }}>暂无表格数据 / No table data</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {(table.footnotes || []).map((note, index) => (
        <div key={index} style={{ marginTop: 3, fontFamily: "var(--paper-caption-font)", fontSize: "calc(var(--paper-body-size) - 3.7pt)", lineHeight: 1.35, color: "#555" }}>{note}</div>
      ))}
    </figure>
  );
}

function ArticleFigure({ figure, lang, columns }: { figure: FigureItem; lang: Lang; columns: 1 | 2 }) {
  const [isWide, setIsWide] = useState(false);
  const bil = lang === "both";
  const showZh = lang !== "en";
  const spansColumns = columns === 2 && isWide;

  return (
    <figure style={{ breakInside: "avoid", columnSpan: spansColumns ? "all" : undefined, margin: "10px 0 12px", textAlign: "center", width: "100%" }}>
      {figure.src ? (
        <img
          src={figure.src}
          alt={figure.caption.zh || figure.caption.en}
          onLoad={(event) => {
            const image = event.currentTarget;
            setIsWide(image.naturalWidth / Math.max(1, image.naturalHeight) >= 1.35);
          }}
          style={{ display: "block", width: "auto", maxWidth: "100%", maxHeight: spansColumns ? "165mm" : "92mm", objectFit: "contain", margin: "0 auto", backgroundColor: "#fff" }}
        />
      ) : (
        <div style={{ backgroundColor: figure.placeholder, border: "1px solid #ddd", padding: "22px 12px", fontSize: "calc(var(--paper-body-size) - 2.5pt)", fontFamily: "var(--paper-caption-font)", color: "#666", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 90 }}>
          {bil ? `图 ${figure.number} / Fig. ${figure.number}` : showZh ? `图 ${figure.number}` : `Fig. ${figure.number}`}
        </div>
      )}
      <figcaption style={{ fontFamily: "var(--paper-caption-font)", fontSize: "calc(var(--paper-body-size) - 2.5pt)", color: "#222", marginTop: 5, lineHeight: 1.4, textAlign: "center" }}>
        <strong>{bil ? <>图 {figure.number}. <span style={{ fontSize: "0.78em", fontWeight: 500, color: "#555" }}>Fig. {figure.number}.</span></> : showZh ? `图 ${figure.number}.` : `Fig. ${figure.number}.`}</strong>{" "}
        {bil ? <><span>{figure.caption.zh}</span><span style={{ marginLeft: 5, fontSize: "0.82em", color: "#555" }}>{figure.caption.en}</span></> : bi(figure.caption, lang)}
      </figcaption>
    </figure>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PREVIEW  —  Chinese Journal of Computers inspired two-column style
   ═══════════════════════════════════════════════════════════════════════ */
function Preview({ paper, lang, columns, typography }: {
  paper: PaperData;
  lang: Lang;
  columns: 1 | 2;
  typography: TypographySettings;
}) {
  const showEn = lang === "en" || lang === "both";
  const showZh = lang === "zh" || lang === "both";
  const bil    = lang === "both";
  const hasPlacements = [...paper.figures, ...paper.tables].some((item) => item.sectionId);
  const placedItems = [...paper.figures.map((item) => ({ kind: "figure" as const, item })), ...paper.tables.map((item) => ({ kind: "table" as const, item }))]
    .sort((left, right) => (left.item.order ?? Number.MAX_SAFE_INTEGER) - (right.item.order ?? Number.MAX_SAFE_INTEGER));
  const renderPlacedItem = ({ kind, item }: (typeof placedItems)[number]) => kind === "figure"
    ? <ArticleFigure key={`figure-${item.id}`} figure={item} lang={lang} columns={columns} />
    : <ArticleTable key={`table-${item.id}`} table={item} lang={lang} columns={columns} />;

  return (
    <div
      id="preview-root"
      lang={showZh && !showEn ? "zh-CN" : "en"}
      data-paper-style={typography.fontStyle}
      style={{
        ...paperTypographyStyle(typography),
        fontFamily: "var(--paper-body-font)",
        backgroundColor: "#fff",
        color: "#111",
        fontSize: "var(--paper-body-size)",
        lineHeight: "var(--paper-line-height)",
      }}
    >
      <div className="print-running-header">
        <span>{paper.journal || paper.journalZh}</span>
        <span>{paper.year}</span>
      </div>
      {/* journal header */}
      <div className="issue-header-screen" style={{ borderBottom: "1.2px solid #111", boxShadow: "0 2px 0 -1px #111", padding: "0 0 5px", marginBottom: "14mm" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "end", gap: 10 }}>
          <span style={{ fontFamily: "var(--paper-body-font)", fontSize: "calc(var(--paper-body-size) - 2pt)" }}>{paper.year || "Online"}</span>
          <span className="paged-running-journal" style={{ fontFamily: "var(--paper-heading-font)", fontWeight: 700, fontSize: "calc(var(--paper-body-size) - 1.5pt)", letterSpacing: "0.18em", textAlign: "center" }}>
            {bil ? <><span>{paper.journalZh}</span><span style={{ marginLeft: 6, fontSize: "0.75em", fontWeight: 500, letterSpacing: "0.06em", color: "#555" }}>{paper.journal}</span></> : showZh ? paper.journalZh : paper.journal}
          </span>
          <span style={{ fontFamily: MONO, fontSize: "7.5pt", textAlign: "right" }}>
            {paper.volume || "Online"}
          </span>
        </div>
      </div>

      {/* title */}
      {showZh && (
        <h1 style={{ fontFamily: "var(--paper-heading-font)", fontWeight: 700, fontSize: bil ? "calc(var(--paper-body-size) + 6.5pt)" : "calc(var(--paper-body-size) + 8.5pt)", lineHeight: 1.3, margin: "0 auto 5mm", color: "var(--paper-heading-color)", textAlign: "center", maxWidth: "84%", textWrap: "balance" }}>
          {paper.title.zh}
        </h1>
      )}
      {showEn && (
        <h1 style={{ fontFamily: "var(--paper-body-font)", fontWeight: 700, fontStyle: "normal", fontSize: bil ? "calc(var(--paper-body-size) + 3.5pt)" : "calc(var(--paper-body-size) + 7.5pt)", lineHeight: 1.3, margin: "0 auto 5mm", color: bil ? "#333" : "#111", textAlign: "center", maxWidth: "94%" }}>
          {paper.title.en}
        </h1>
      )}

      {/* authors */}
      <div className="paged-running-authors" style={{ marginBottom: "2.5mm", fontFamily: "var(--paper-caption-font)", fontSize: "calc(var(--paper-body-size) - 0.5pt)", lineHeight: 1.7, textAlign: "center", letterSpacing: "0.03em" }}>
        {paper.authors.map((a, i) => (
          <span key={i}>
            <span style={{ color: "#111", fontWeight: 500 }}>
              {bil ? <><span>{a.nameZh}</span><span style={{ marginLeft: 4, fontSize: "0.78em", fontWeight: 400, color: "#555" }}>{a.name}</span></> : showZh ? a.nameZh : a.name}
            </span>
            <sup style={{ fontSize: "7pt", color: "#666" }}>{a.affKeys}</sup>
            {i < paper.authors.length - 1 && <span style={{ color: "#888", margin: "0 4px" }}>,</span>}
          </span>
        ))}
      </div>

      {/* affiliations */}
      <div style={{ marginBottom: "3mm", fontFamily: "var(--paper-caption-font)", fontSize: "calc(var(--paper-body-size) - 2.5pt)", color: "#333", lineHeight: 1.55, textAlign: "center" }}>
        {paper.affiliations.map((aff) => (
          <div key={aff.key}>
            <sup style={{ fontSize: "6pt" }}>{aff.key}</sup>
            {" "}{bil ? <><span>{aff.textZh}</span><span style={{ marginLeft: 5, fontSize: "0.8em", color: "#666" }}>{aff.text}</span></> : showZh ? aff.textZh : aff.text}
          </div>
        ))}
      </div>

      {/* article history box */}
      <div style={{ display: "flex", justifyContent: "center", gap: 18, marginBottom: "4mm", padding: 0, fontFamily: "var(--paper-caption-font)", fontSize: "calc(var(--paper-body-size) - 3pt)", color: "#555" }}>
        <div>
          <div style={{ fontWeight: 600, color: "#333", marginBottom: 2 }}>
            {bil ? <BilingualText zh="投稿历程" en="Article History" zhSize="8pt" enSize="6.4pt" /> : showZh ? "投稿历程" : "Article History"}
          </div>
          {paper.received && <div>{bil ? <BilingualText zh={`收稿 ${paper.received}`} en={`Received ${paper.received}`} zhSize="7.5pt" enSize="6.2pt" weight={500} /> : showZh ? `收稿 ${paper.received}` : `Received ${paper.received}`}</div>}
          {paper.revised  && <div>{bil ? <BilingualText zh={`修订 ${paper.revised}`} en={`Revised ${paper.revised}`} zhSize="7.5pt" enSize="6.2pt" weight={500} /> : showZh ? `修订 ${paper.revised}` : `Revised ${paper.revised}`}</div>}
          {paper.accepted && <div>{bil ? <BilingualText zh={`录用 ${paper.accepted}`} en={`Accepted ${paper.accepted}`} zhSize="7.5pt" enSize="6.2pt" weight={500} /> : showZh ? `录用 ${paper.accepted}` : `Accepted ${paper.accepted}`}</div>}
        </div>
        <div style={{ borderLeft: "1px solid #aaa", paddingLeft: 16 }}>
          <div style={{ fontWeight: 600, color: "#333", marginBottom: 2 }}>{bil ? <BilingualText zh="数字对象标识符" en="DOI" zhSize="8pt" enSize="6.4pt" /> : "DOI"}</div>
          <div style={{ fontFamily: MONO, fontSize: "7pt" }}>{paper.doi}</div>
        </div>
      </div>

      {/* highlights */}
      {(paper.highlights.length > 0 || paper.highlightsZh.length > 0) && (
        <div style={{ marginBottom: 12, padding: "8px 12px", border: "1px solid #e0e0e0", borderLeft: "3px solid #c0392b" }}>
          <div style={{ fontFamily: "var(--paper-heading-font)", fontWeight: 700, fontSize: "calc(var(--paper-body-size) - 2.5pt)", color: "#c0392b", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {bil ? <BilingualText zh="研究亮点" en="Highlights" zhSize="8.5pt" enSize="6.5pt" weight={700} /> : showZh ? "研究亮点" : "Highlights"}
          </div>
          <ul style={{ margin: 0, paddingLeft: 14, fontFamily: "var(--paper-caption-font)", fontSize: "calc(var(--paper-body-size) - 2.5pt)", lineHeight: 1.65, color: "#333" }}>
            {showZh && paper.highlightsZh.map((h, i) => <li key={i}>{h}</li>)}
            {bil && <li style={{ listStyle: "none", height: 4 }} />}
            {showEn && paper.highlights.map((h, i) => (
              <li key={i} style={{ fontStyle: bil ? "italic" : "normal", color: bil ? "#666" : "#333" }}>{h}</li>
            ))}
          </ul>
        </div>
      )}

      {/* abstract + keywords */}
      <div style={{ marginBottom: "3mm", padding: 0 }}>
        <div style={{ float: "left", fontFamily: "var(--paper-heading-font)", fontWeight: 700, fontSize: "calc(var(--paper-body-size) - 1.5pt)", color: "var(--paper-heading-color)", marginRight: "0.8em", letterSpacing: "0.08em" }}>
          {bil ? <BilingualText zh="摘要" en="Abstract" zhSize="9.5pt" enSize="7pt" weight={700} /> : showZh ? "摘要" : "Abstract"}
        </div>
        {showZh && (
          <p style={{ margin: "0 0 5px", fontFamily: "var(--paper-body-font)", fontSize: "calc(var(--paper-body-size) - 1pt)", textAlign: "justify", textJustify: "inter-word", lineHeight: "var(--paper-line-height)", overflowWrap: "break-word" }}>
            {paper.abstract.zh}
          </p>
        )}
        {bil && <hr style={{ border: "none", borderTop: "1px dashed #ddd", margin: "6px 0" }} />}
        {showEn && (
          <p style={{ margin: "0 0 6px", fontFamily: "var(--paper-body-font)", fontSize: "calc(var(--paper-body-size) - 1pt)", textAlign: "justify", textJustify: "inter-word", lineHeight: "var(--paper-line-height)", fontStyle: bil ? "italic" : "normal", color: bil ? "#444" : "#111", overflowWrap: "break-word" }}>
            {paper.abstract.en}
          </p>
        )}
        <div style={{ fontFamily: "var(--paper-caption-font)", fontSize: "calc(var(--paper-body-size) - 2.5pt)", lineHeight: 1.7 }}>
          <span style={{ fontWeight: 600 }}>{bil ? <BilingualText zh="关键词" en="Keywords" zhSize="8.2pt" enSize="6.4pt" /> : showZh ? "关键词" : "Keywords"}:</span>{" "}
          {(showZh ? paper.keywords.zh : paper.keywords.en).join("; ")}
          {bil && (
            <>
              <br />
              <span style={{ color: "#888", fontStyle: "italic" }}>{paper.keywords.en.join("; ")}</span>
            </>
          )}
        </div>
      </div>

      {/* body in columns */}
      <div className="article-columns" style={{
        columns: columns === 2 ? 2 : 1,
        columnGap: "7.5mm",
        columnRule: undefined,
        marginTop: "7mm",
      }}>
        {paper.sections.map((sec, si) => (
          <Fragment key={sec.id}>
          <div style={{ breakInside: "auto", marginBottom: "0.35em" }}>
            {/* section heading */}
            <h2 style={{ fontFamily: "var(--paper-heading-font)", fontWeight: 700, fontSize: "calc(var(--paper-body-size) + 1pt)", lineHeight: 1.35, color: "var(--paper-heading-color)", margin: "1.2em 0 0.4em", paddingBottom: typography.fontStyle === "modern" ? "0.18em" : 0, borderBottom: "1px solid var(--paper-heading-rule)", breakAfter: "avoid" }}>
              {bil ? (
                <>
                  <span>{sec.number}. {sec.title.zh}</span>
                  <span style={{ marginLeft: 6, fontSize: "0.76em", fontWeight: 500, color: "#555" }}>{sec.title.en}</span>
                </>
              ) : `${sec.number}. ${bi(sec.title, lang)}`}
            </h2>

            {/* body paragraphs */}
            {(showZh ? sec.content.zh : sec.content.en)
              .split("\n\n")
              .filter(Boolean)
              .map((para, pi) => (
                <p key={pi} style={{ margin: "0 0 var(--paper-paragraph-gap)", textAlign: "justify", textJustify: "inter-word", fontFamily: "var(--paper-body-font)", fontSize: "var(--paper-body-size)", lineHeight: "var(--paper-line-height)", textIndent: "var(--paper-paragraph-indent)", overflowWrap: "break-word", orphans: 3, widows: 3 }}>
                  {para.trim()}
                </p>
              ))}

            {/* bilingual: show EN below ZH in italic */}
            {bil && sec.content.en !== sec.content.zh && (
              <div style={{ borderLeft: "2px solid #e8e8e8", paddingLeft: 8, marginBottom: 4 }}>
                {sec.content.en.split("\n\n").filter(Boolean).map((para, pi) => (
                  <p key={pi} style={{ margin: "0 0 5px", textAlign: "justify", fontFamily: "var(--paper-body-font)", fontSize: "calc(var(--paper-body-size) - 1.7pt)", lineHeight: "var(--paper-line-height)", color: "#555", fontStyle: "italic", textIndent: "var(--paper-paragraph-indent)" }}>
                    {para.trim()}
                  </p>
                ))}
              </div>
            )}

          </div>
          {hasPlacements
            ? placedItems.filter(({ item }) => item.sectionId === sec.id).map(renderPlacedItem)
            : <>
                {paper.figures[si] && <ArticleFigure figure={paper.figures[si]} lang={lang} columns={columns} />}
                {paper.tables[si] && <ArticleTable table={paper.tables[si]} lang={lang} columns={columns} />}
              </>}
          </Fragment>
        ))}

        {hasPlacements
          ? placedItems.filter(({ item }) => !item.sectionId || !paper.sections.some((section) => section.id === item.sectionId)).map(renderPlacedItem)
          : <>
              {paper.figures.slice(paper.sections.length).map((fig) => <ArticleFigure key={fig.id} figure={fig} lang={lang} columns={columns} />)}
              {paper.tables.slice(paper.sections.length).map((tbl) => <ArticleTable key={tbl.id} table={tbl} lang={lang} columns={columns} />)}
            </>}
      {/* references */}
      <div style={{ marginTop: "1.4em", paddingTop: 0 }}>
        <div style={{ fontFamily: "var(--paper-heading-font)", fontWeight: 700, fontSize: "calc(var(--paper-body-size) + 0.5pt)", marginBottom: "0.7em" }}>
          {bil ? <BilingualText zh="参考文献" en="References" zhSize="11pt" enSize="8pt" weight={700} /> : showZh ? "参考文献" : "References"}
        </div>
        <ol style={{ margin: 0, padding: 0, listStyle: "none", fontFamily: "var(--paper-body-font)", fontSize: "calc(var(--paper-body-size) - 2.5pt)", lineHeight: 1.48, color: "#222" }}>
          {paper.references.map((ref, i) => (
            <li key={i} style={{ marginBottom: 3, display: "flex", alignItems: "flex-start", gap: 4 }}>
              <span style={{ flexShrink: 0 }}>[{i + 1}]</span>
              <span style={{ textAlign: "justify", textJustify: "inter-word", overflowWrap: "anywhere" }}>{ref}</span>
            </li>
          ))}
        </ol>
      </div>
      </div>

      {/* page footer */}
      <div className="article-source-footer" style={{ marginTop: 16, paddingTop: 5, borderTop: "1px solid #111", display: "flex", justifyContent: "space-between", fontFamily: "var(--paper-caption-font)", fontSize: "7pt", color: "#555" }}>
        <span>{paper.journal} · {paper.volume} ({paper.year}) {paper.pages}</span>
        <span>© {paper.year} {paper.journal || paper.journalZh}</span>
      </div>
    </div>
  );
}

// 分页页眉、页脚和页码必须使用同一套字体配置，保证预览与打印一致。
function pagedPreviewCss(settings: TypographySettings) {
  const preset = STYLE_FONTS[settings.fontStyle];
  const bodyFont = settings.fontFamily === "auto" ? preset.body : FAMILY_FONTS[settings.fontFamily];
  return `
@page {
  size: A4;
  margin: 18mm 19mm 18mm;
  @top-left {
    content: string(articleAuthors);
    font-family: ${bodyFont};
    font-size: 7.5pt;
    font-style: italic;
    border-bottom: 0.45pt solid #777;
    padding-bottom: 1.5mm;
  }
  @top-right {
    content: string(articleJournal);
    font-family: ${preset.heading};
    font-size: 7.5pt;
    font-style: italic;
    border-bottom: 0.45pt solid #777;
    padding-bottom: 1.5mm;
  }
  @bottom-center {
    content: counter(page);
    font-family: ${bodyFont};
    font-size: 7.5pt;
  }
}
@page:first {
  @top-left { content: none; border: 0; }
  @top-right { content: none; border: 0; }
}
.paged-running-journal { string-set: articleJournal content(text); }
.paged-running-authors { string-set: articleAuthors content(text); }
#preview-root {
  width: auto !important;
  max-width: none !important;
  min-height: 0 !important;
  background: #fff !important;
}
.article-columns { column-fill: auto !important; }
.article-source-footer { display: none !important; }
img, figcaption, h1, h2 { break-inside: avoid; }
thead { display: table-header-group; }
tr { break-inside: avoid; break-after: auto; }
`;
}

function PaginatedPreview({ paper, lang, columns, typography }: { paper: PaperData; lang: Lang; columns: 1 | 2; typography: TypographySettings }) {
  const sourceRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const renderIdRef = useRef(0);
  const [pageCount, setPageCount] = useState(0);
  const [rendering, setRendering] = useState(true);
  const [scale, setScale] = useState(1);
  const [assetVersion, setAssetVersion] = useState(0);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const updateScale = () => {
      const available = Math.max(320, viewport.clientWidth - 36);
      setScale(Math.min(1, available / 794));
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const renderId = ++renderIdRef.current;
    let observer: MutationObserver | undefined;
    let settleTimer: number | undefined;
    let renderTimeout: number | undefined;
    let stylesheet = "";
    const timer = window.setTimeout(async () => {
      const source = sourceRef.current;
      const output = outputRef.current;
      if (!source || !output) return;

      setRendering(true);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      if (renderId !== renderIdRef.current) return;

      const host = document.createElement("div");
      output.replaceChildren(host);
      stylesheet = URL.createObjectURL(new Blob([pagedPreviewCss(typography)], { type: "text/css" }));

      const finishFromDom = () => {
        const total = host.querySelectorAll(".pagedjs_page").length;
        if (total > 0 && renderId === renderIdRef.current) {
          if (renderTimeout) window.clearTimeout(renderTimeout);
          setPageCount(total);
          setRendering(false);
        }
      };

      observer = new MutationObserver(() => {
        if (settleTimer) window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(finishFromDom, 800);
      });
      observer.observe(host, { childList: true, subtree: true });
      renderTimeout = window.setTimeout(() => {
        if (renderId !== renderIdRef.current) return;
        const total = host.querySelectorAll(".pagedjs_page").length;
        if (total > 0) {
          setPageCount(total);
        } else {
          host.innerHTML = source.innerHTML;
          setPageCount(1);
          console.error("Paged preview timed out; showing the source document instead");
        }
        setRendering(false);
      }, 12000);

      try {
        const { Previewer } = await import("pagedjs");
        const previewer = new Previewer();
        void previewer.preview(source.innerHTML, [stylesheet], host).then((flow) => {
          if (renderId === renderIdRef.current) {
            if (renderTimeout) window.clearTimeout(renderTimeout);
            setPageCount(host.querySelectorAll(".pagedjs_page").length || flow.total);
            setRendering(false);
          }
        }).catch((error) => {
          if (renderId === renderIdRef.current) {
            if (renderTimeout) window.clearTimeout(renderTimeout);
            host.innerHTML = source.innerHTML;
            setPageCount(1);
            setRendering(false);
            console.error("Paged preview failed", error);
          }
        }).finally(() => {
          if (stylesheet) {
            URL.revokeObjectURL(stylesheet);
            stylesheet = "";
          }
        });
      } catch (error) {
        if (renderId === renderIdRef.current) {
          if (renderTimeout) window.clearTimeout(renderTimeout);
          host.innerHTML = source.innerHTML;
          setPageCount(1);
          setRendering(false);
          console.error("Paged preview failed", error);
        }
      }
    }, 320);

    return () => {
      window.clearTimeout(timer);
      if (settleTimer) window.clearTimeout(settleTimer);
      if (renderTimeout) window.clearTimeout(renderTimeout);
      observer?.disconnect();
      if (stylesheet) URL.revokeObjectURL(stylesheet);
    };
  }, [paper, lang, columns, typography, assetVersion]);

  return (
    <div ref={viewportRef} className="paged-preview-viewport" style={{ position: "relative", width: "100%", minHeight: "100%", padding: "18px 0 36px" }}>
      <div
        ref={sourceRef}
        className="pagination-source"
        style={{ display: "none" }}
        onLoadCapture={() => setAssetVersion((value) => value + 1)}
        onErrorCapture={() => setAssetVersion((value) => value + 1)}
      >
        <Preview paper={paper} lang={lang} columns={columns} typography={typography} />
      </div>
      <div className="paged-preview-status no-print" style={{ position: "sticky", top: 10, zIndex: 5, width: "fit-content", margin: "0 14px 8px auto", padding: "5px 9px", borderRadius: 3, background: "rgba(15,39,68,0.88)", color: "#fff", fontFamily: SANS, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
        <BilingualText zh={rendering ? "正在分页…" : `共 ${pageCount} 页`} en={rendering ? "Paginating…" : `${pageCount} pages`} zhSize="0.72rem" enSize="0.54rem" weight={600} />
      </div>
      <div className="paged-preview-scale" style={{ zoom: scale, width: `${100 / scale}%` }}>
        <div ref={outputRef} className="paged-preview-output" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   EDITOR HELPERS
   ═══════════════════════════════════════════════════════════════════════ */
function FieldInput({ label, value, onChange, mono }: { label: UiCopy; value: string; onChange: (v: string) => void; mono?: boolean }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontFamily: SANS, color: "#6b7280", marginBottom: 5 }}>
        <BilingualText {...label} zhSize="0.74rem" enSize="0.58rem" />
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%", padding: "6px 10px", fontSize: "0.82rem",
          fontFamily: mono ? MONO : SANS,
          border: "1px solid #e5e7eb", borderRadius: 2, outline: "none",
          backgroundColor: "#fff", color: "#111",
        }}
        onFocus={(e) => { e.target.style.borderColor = "#c0392b"; }}
        onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; }}
      />
    </div>
  );
}

function FieldTextarea({ label, value, onChange, rows = 4 }: { label: UiCopy; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontFamily: SANS, color: "#6b7280", marginBottom: 5 }}>
        <BilingualText {...label} zhSize="0.74rem" enSize="0.58rem" />
      </div>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%", padding: "6px 10px", fontSize: "0.82rem",
          fontFamily: SERIF,
          border: "1px solid #e5e7eb", borderRadius: 2, outline: "none",
          backgroundColor: "#fff", color: "#111", resize: "vertical",
          lineHeight: 1.6,
        }}
        onFocus={(e) => { e.target.style.borderColor = "#c0392b"; }}
        onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; }}
      />
    </div>
  );
}

function SectionCard({ sec, onChange, onDelete }: { sec: Section; onChange: (s: Section) => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 8, border: "1px solid #e5e7eb", borderRadius: 2, overflow: "hidden" }}>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", backgroundColor: "#f3f4f6", cursor: "pointer", userSelect: "none" }}
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <span style={{ flex: 1, fontFamily: SANS, fontSize: "0.78rem", fontWeight: 600 }}>
          §{sec.number} {sec.title.zh || sec.title.en || "（未命名） / Untitled"}
        </span>
        <button
          aria-label="删除章节 / Delete section"
          title="删除章节 / Delete section"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 0 }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#9ca3af"; }}
        >
          <Trash2 size={12} />
        </button>
      </div>
      {open && (
        <div style={{ padding: "10px 10px 4px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 8 }}>
            <FieldInput label={{ zh: "章节编号", en: "Section No." }} value={sec.number} onChange={(v) => onChange({ ...sec, number: v })} />
            <div />
          </div>
          <FieldInput label={{ zh: "中文标题", en: "Chinese Heading" }} value={sec.title.zh} onChange={(v) => onChange({ ...sec, title: { ...sec.title, zh: v } })} />
          <FieldInput label={{ zh: "英文标题", en: "English Heading" }} value={sec.title.en} onChange={(v) => onChange({ ...sec, title: { ...sec.title, en: v } })} />
          <FieldTextarea label={{ zh: "中文正文（段落间空行）", en: "Chinese Body (blank line between paragraphs)" }} value={sec.content.zh} onChange={(v) => onChange({ ...sec, content: { ...sec.content, zh: v } })} rows={6} />
          <FieldTextarea label={{ zh: "英文正文（段落间空行）", en: "English Body (blank line between paragraphs)" }} value={sec.content.en} onChange={(v) => onChange({ ...sec, content: { ...sec.content, en: v } })} rows={6} />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   EDITOR PANEL
   ═══════════════════════════════════════════════════════════════════════ */
function EditorPanel({ paper, setPaper, tab, setTab }: {
  paper: PaperData;
  setPaper: (p: PaperData) => void;
  tab: EditorTab;
  setTab: (t: EditorTab) => void;
}) {
  const set = useCallback((patch: Partial<PaperData>) => setPaper({ ...paper, ...patch }), [paper, setPaper]);

  const TABS: { id: EditorTab; label: UiCopy }[] = [
    { id: "basic",    label: { zh: "基本信息", en: "Basic Info" } },
    { id: "abstract", label: { zh: "摘要关键词", en: "Abstract" } },
    { id: "sections", label: { zh: "章节正文", en: "Sections" } },
    { id: "figures",  label: { zh: "图表", en: "Figures / Tables" } },
    { id: "refs",     label: { zh: "参考文献", en: "References" } },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* tabs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", borderBottom: "1px solid #e5e7eb", flexShrink: 0 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              minWidth: 0, padding: "8px 3px", fontFamily: SANS,
              border: "none", background: "none", cursor: "pointer",
              borderBottom: `2px solid ${tab === t.id ? "#c0392b" : "transparent"}`,
              color: tab === t.id ? "#c0392b" : "#6b7280",
            }}
          >
            <BilingualText {...t.label} zhSize="0.76rem" enSize="0.53rem" weight={tab === t.id ? 700 : 600} stacked />
          </button>
        ))}
      </div>

      {/* content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 14, scrollbarWidth: "thin" }}>

        {/* ── BASIC INFO ── */}
        {tab === "basic" && (
          <div>
            <FieldInput label={{ zh: "中文期刊名", en: "Chinese Journal Name" }} value={paper.journalZh} onChange={(v) => set({ journalZh: v })} />
            <FieldInput label={{ zh: "英文期刊名", en: "English Journal Name" }} value={paper.journal} onChange={(v) => set({ journal: v })} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <FieldInput label={{ zh: "国际刊号", en: "ISSN" }} value={paper.issn} onChange={(v) => set({ issn: v })} mono />
              <FieldInput label={{ zh: "卷号", en: "Volume" }} value={paper.volume} onChange={(v) => set({ volume: v })} />
              <FieldInput label={{ zh: "年份", en: "Year" }} value={paper.year} onChange={(v) => set({ year: v })} />
            </div>
            <FieldInput label={{ zh: "数字对象标识符", en: "DOI" }} value={paper.doi} onChange={(v) => set({ doi: v })} mono />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <FieldInput label={{ zh: "收稿日期", en: "Received" }} value={paper.received} onChange={(v) => set({ received: v })} />
              <FieldInput label={{ zh: "修订日期", en: "Revised" }} value={paper.revised} onChange={(v) => set({ revised: v })} />
              <FieldInput label={{ zh: "录用日期", en: "Accepted" }} value={paper.accepted} onChange={(v) => set({ accepted: v })} />
            </div>
            <FieldInput label={{ zh: "中文标题", en: "Chinese Title" }} value={paper.title.zh} onChange={(v) => set({ title: { ...paper.title, zh: v } })} />
            <FieldInput label={{ zh: "英文标题", en: "English Title" }} value={paper.title.en} onChange={(v) => set({ title: { ...paper.title, en: v } })} />

            <div style={{ fontFamily: SANS, color: "#6b7280", margin: "14px 0 8px" }}><BilingualText zh="作者" en="Authors" zhSize="0.82rem" enSize="0.61rem" weight={700} /></div>
            {paper.authors.map((a, i) => (
              <div key={i} style={{ marginBottom: 8, padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 2, backgroundColor: "#f9fafb" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <FieldInput label={{ zh: "中文姓名", en: "Chinese Name" }} value={a.nameZh} onChange={(v) => { const authors = [...paper.authors]; authors[i] = { ...a, nameZh: v }; set({ authors }); }} />
                  <FieldInput label={{ zh: "英文姓名", en: "English Name" }} value={a.name} onChange={(v) => { const authors = [...paper.authors]; authors[i] = { ...a, name: v }; set({ authors }); }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <FieldInput label={{ zh: "单位编号（如 a,b）", en: "Affiliation Keys" }} value={a.affKeys} onChange={(v) => { const authors = [...paper.authors]; authors[i] = { ...a, affKeys: v }; set({ authors }); }} />
                  <FieldInput label={{ zh: "电子邮箱", en: "Email" }} value={a.email || ""} onChange={(v) => { const authors = [...paper.authors]; authors[i] = { ...a, email: v }; set({ authors }); }} />
                </div>
                <button onClick={() => set({ authors: paper.authors.filter((_, j) => j !== i) })}
                  style={{ fontFamily: SANS, fontSize: "0.72rem", color: "#ef4444", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  <Trash2 size={11} /> <BilingualText zh="删除" en="Remove" zhSize="0.74rem" enSize="0.56rem" />
                </button>
              </div>
            ))}
            <button onClick={() => set({ authors: [...paper.authors, { name: "", nameZh: "", affKeys: "a" }] })}
              style={{ fontFamily: SANS, fontSize: "0.75rem", color: "#c0392b", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, marginBottom: 16 }}>
              <Plus size={13} /> <BilingualText zh="添加作者" en="Add Author" zhSize="0.76rem" enSize="0.57rem" />
            </button>

            <div style={{ fontFamily: SANS, color: "#6b7280", margin: "4px 0 8px" }}><BilingualText zh="作者单位" en="Affiliations" zhSize="0.82rem" enSize="0.61rem" weight={700} /></div>
            {paper.affiliations.map((aff, i) => (
              <div key={i} style={{ marginBottom: 8, padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 2, backgroundColor: "#f9fafb" }}>
                <div style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: 8 }}>
                  <FieldInput label={{ zh: "编号", en: "Key" }} value={aff.key} onChange={(v) => { const affiliations = [...paper.affiliations]; affiliations[i] = { ...aff, key: v }; set({ affiliations }); }} />
                  <FieldInput label={{ zh: "中文单位", en: "Chinese Affiliation" }} value={aff.textZh} onChange={(v) => { const affiliations = [...paper.affiliations]; affiliations[i] = { ...aff, textZh: v }; set({ affiliations }); }} />
                </div>
                <FieldInput label={{ zh: "英文单位", en: "English Affiliation" }} value={aff.text} onChange={(v) => { const affiliations = [...paper.affiliations]; affiliations[i] = { ...aff, text: v }; set({ affiliations }); }} />
                <button onClick={() => set({ affiliations: paper.affiliations.filter((_, j) => j !== i) })}
                  style={{ fontFamily: SANS, fontSize: "0.72rem", color: "#ef4444", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  <Trash2 size={11} /> <BilingualText zh="删除" en="Remove" zhSize="0.74rem" enSize="0.56rem" />
                </button>
              </div>
            ))}
            <button onClick={() => set({ affiliations: [...paper.affiliations, { key: String.fromCharCode(97 + paper.affiliations.length), text: "", textZh: "" }] })}
              style={{ fontFamily: SANS, fontSize: "0.75rem", color: "#c0392b", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <Plus size={13} /> <BilingualText zh="添加单位" en="Add Affiliation" zhSize="0.76rem" enSize="0.57rem" />
            </button>
          </div>
        )}

        {/* ── ABSTRACT ── */}
        {tab === "abstract" && (
          <div>
            <FieldTextarea label={{ zh: "中文摘要", en: "Chinese Abstract" }} value={paper.abstract.zh} onChange={(v) => set({ abstract: { ...paper.abstract, zh: v } })} rows={7} />
            <FieldTextarea label={{ zh: "英文摘要", en: "English Abstract" }} value={paper.abstract.en} onChange={(v) => set({ abstract: { ...paper.abstract, en: v } })} rows={7} />
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: SANS, color: "#6b7280", marginBottom: 5 }}><BilingualText zh="中文关键词（逗号分隔）" en="Chinese Keywords (comma-separated)" zhSize="0.74rem" enSize="0.58rem" /></div>
              <input value={paper.keywords.zh.join(", ")} onChange={(e) => set({ keywords: { ...paper.keywords, zh: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } })}
                style={{ width: "100%", padding: "6px 10px", fontSize: "0.82rem", fontFamily: SANS, border: "1px solid #e5e7eb", borderRadius: 2, outline: "none" }} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: SANS, color: "#6b7280", marginBottom: 5 }}><BilingualText zh="英文关键词（逗号分隔）" en="English Keywords (comma-separated)" zhSize="0.74rem" enSize="0.58rem" /></div>
              <input value={paper.keywords.en.join(", ")} onChange={(e) => set({ keywords: { ...paper.keywords, en: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } })}
                style={{ width: "100%", padding: "6px 10px", fontSize: "0.82rem", fontFamily: SANS, border: "1px solid #e5e7eb", borderRadius: 2, outline: "none" }} />
            </div>
            <FieldTextarea label={{ zh: "中文研究亮点（每行一条）", en: "Chinese Highlights (one per line)" }} value={paper.highlightsZh.join("\n")} onChange={(v) => set({ highlightsZh: v.split("\n").map((s) => s.trim()).filter(Boolean) })} rows={5} />
            <FieldTextarea label={{ zh: "英文研究亮点（每行一条）", en: "English Highlights (one per line)" }} value={paper.highlights.join("\n")} onChange={(v) => set({ highlights: v.split("\n").map((s) => s.trim()).filter(Boolean) })} rows={5} />
          </div>
        )}

        {/* ── SECTIONS ── */}
        {tab === "sections" && (
          <div>
            <p style={{ fontFamily: SANS, color: "#6b7280", marginBottom: 10 }}>
              <BilingualText zh="段落之间请保留一个空行。" en="Separate paragraphs with a blank line." zhSize="0.76rem" enSize="0.58rem" weight={500} />
            </p>
            {paper.sections.map((sec, i) => (
              <SectionCard
                key={sec.id}
                sec={sec}
                onChange={(s) => { const sections = [...paper.sections]; sections[i] = s; set({ sections }); }}
                onDelete={() => set({ sections: paper.sections.filter((_, j) => j !== i) })}
              />
            ))}
            <button
              onClick={() => set({ sections: [...paper.sections, { id: `s${Date.now()}`, number: String(paper.sections.length + 1), title: { en: "", zh: "" }, content: { en: "", zh: "" }, subsections: [] }] })}
              style={{ fontFamily: SANS, fontSize: "0.75rem", display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", border: "1px solid #e5e7eb", borderRadius: 2, backgroundColor: "#f3f4f6", color: "#374151", cursor: "pointer", marginTop: 4 }}>
              <Plus size={13} /> <BilingualText zh="添加章节" en="Add Section" zhSize="0.76rem" enSize="0.57rem" />
            </button>
          </div>
        )}

        {/* ── FIGURES & TABLES ── */}
        {tab === "figures" && (
          <div>
            <div style={{ fontFamily: SANS, color: "#6b7280", marginBottom: 8 }}><BilingualText zh="图片" en="Figures" zhSize="0.82rem" enSize="0.61rem" weight={700} /></div>
            {paper.figures.map((fig, i) => (
              <div key={fig.id} style={{ marginBottom: 8, padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 2, backgroundColor: "#f9fafb" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontFamily: SANS, fontSize: "0.78rem", fontWeight: 600 }}>图 {fig.number} <span style={{ fontSize: "0.6rem", opacity: 0.55 }}>Fig. {fig.number}</span></span>
                  <button aria-label="删除图片 / Delete figure" title="删除图片 / Delete figure" onClick={() => set({ figures: paper.figures.filter((_, j) => j !== i) })} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}><Trash2 size={12} /></button>
                </div>
                <FieldInput label={{ zh: "中文图题", en: "Chinese Caption" }} value={fig.caption.zh} onChange={(v) => { const figures = [...paper.figures]; figures[i] = { ...fig, caption: { ...fig.caption, zh: v } }; set({ figures }); }} />
                <FieldInput label={{ zh: "英文图题", en: "English Caption" }} value={fig.caption.en} onChange={(v) => { const figures = [...paper.figures]; figures[i] = { ...fig, caption: { ...fig.caption, en: v } }; set({ figures }); }} />
                <FieldInput label={{ zh: "图片地址", en: "Image URL" }} value={fig.src || ""} onChange={(v) => { const figures = [...paper.figures]; figures[i] = { ...fig, src: v }; set({ figures }); }} mono />
                <FieldInput label={{ zh: "占位颜色", en: "Placeholder Colour" }} value={fig.placeholder} onChange={(v) => { const figures = [...paper.figures]; figures[i] = { ...fig, placeholder: v }; set({ figures }); }} mono />
              </div>
            ))}
            <button onClick={() => set({ figures: [...paper.figures, { id: `f${Date.now()}`, number: paper.figures.length + 1, caption: { en: "", zh: "" }, placeholder: "#dbeafe", src: "" }] })}
              style={{ fontFamily: SANS, fontSize: "0.75rem", display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", border: "1px solid #e5e7eb", borderRadius: 2, backgroundColor: "#f3f4f6", color: "#374151", cursor: "pointer", marginBottom: 18 }}>
              <Plus size={13} /> <BilingualText zh="添加图片" en="Add Figure" zhSize="0.76rem" enSize="0.57rem" />
            </button>

            <div style={{ fontFamily: SANS, color: "#6b7280", marginBottom: 8 }}><BilingualText zh="表格" en="Tables" zhSize="0.82rem" enSize="0.61rem" weight={700} /></div>
            {paper.tables.map((tbl, i) => (
              <div key={tbl.id} style={{ marginBottom: 8, padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 2, backgroundColor: "#f9fafb" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontFamily: SANS, fontSize: "0.78rem", fontWeight: 600 }}>表 {tbl.number} <span style={{ fontSize: "0.6rem", opacity: 0.55 }}>Table {tbl.number}</span></span>
                  <button aria-label="删除表格 / Delete table" title="删除表格 / Delete table" onClick={() => set({ tables: paper.tables.filter((_, j) => j !== i) })} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}><Trash2 size={12} /></button>
                </div>
                <FieldInput label={{ zh: "中文表题", en: "Chinese Caption" }} value={tbl.caption.zh} onChange={(v) => { const tables = [...paper.tables]; tables[i] = { ...tbl, caption: { ...tbl.caption, zh: v } }; set({ tables }); }} />
                <FieldInput label={{ zh: "英文表题", en: "English Caption" }} value={tbl.caption.en} onChange={(v) => { const tables = [...paper.tables]; tables[i] = { ...tbl, caption: { ...tbl.caption, en: v } }; set({ tables }); }} />
                <FieldInput
                  label={{ zh: "列标题（逗号分隔）", en: "Column Headers (comma-separated)" }}
                  value={(tbl.headerRows?.[tbl.headerRows.length - 1] || []).map((cell) => cell.text).join(", ") || tbl.headers.join(", ")}
                  onChange={(v) => {
                    const tables = [...paper.tables];
                    tables[i] = { ...tbl, headers: v.split(",").map((s) => s.trim()), headerRows: undefined };
                    set({ tables });
                  }}
                />
                <FieldTextarea
                  label={{ zh: "表格数据（每行一行，制表符或逗号分隔）", en: "Table Data (one row per line, tab or comma-separated)" }}
                  value={(tbl.bodyRows?.length ? tbl.bodyRows.map((row) => row.map((cell) => cell.text)) : tbl.rows.map((row) => row.cells)).map((row) => row.join("\t")).join("\n")}
                  onChange={(value) => {
                    const rows = value.split("\n").filter((line) => line.trim()).map((line) => ({ cells: (line.includes("\t") ? line.split("\t") : line.split(",")).map((cell) => cell.trim()) }));
                    const tables = [...paper.tables];
                    tables[i] = { ...tbl, rows, bodyRows: undefined };
                    set({ tables });
                  }}
                  rows={6}
                />
                <FieldTextarea
                  label={{ zh: "表注（每行一条）", en: "Table Notes (one per line)" }}
                  value={(tbl.footnotes || []).join("\n")}
                  onChange={(value) => {
                    const tables = [...paper.tables];
                    tables[i] = { ...tbl, footnotes: value.split("\n").map((note) => note.trim()).filter(Boolean) };
                    set({ tables });
                  }}
                  rows={3}
                />
              </div>
            ))}
            <button onClick={() => set({ tables: [...paper.tables, { id: `t${Date.now()}`, number: paper.tables.length + 1, caption: { en: "", zh: "" }, headers: ["列 1", "列 2"], rows: [{ cells: ["", ""] }], footnotes: [] }] })}
              style={{ fontFamily: SANS, fontSize: "0.75rem", display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", border: "1px solid #e5e7eb", borderRadius: 2, backgroundColor: "#f3f4f6", color: "#374151", cursor: "pointer" }}>
              <Plus size={13} /> <BilingualText zh="添加表格" en="Add Table" zhSize="0.76rem" enSize="0.57rem" />
            </button>
          </div>
        )}

        {/* ── REFERENCES ── */}
        {tab === "refs" && (
          <div>
            <p style={{ fontFamily: SANS, color: "#6b7280", marginBottom: 8 }}><BilingualText zh="每行一条参考文献，系统自动编号。" en="One reference per line. Auto-numbered." zhSize="0.76rem" enSize="0.58rem" weight={500} /></p>
            <FieldTextarea label={{ zh: "参考文献", en: "References" }} value={paper.references.join("\n")} onChange={(v) => set({ references: v.split("\n").map((s) => s.trim()).filter(Boolean) })} rows={20} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   FILE UPLOAD PARSER
   ═══════════════════════════════════════════════════════════════════════ */
function parseUpload(text: string): Partial<PaperData> | null {
  try {
    return JSON.parse(text) as Partial<PaperData>;
  } catch {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const title = lines[0] || "";
    const aiIdx = lines.findIndex((l) => /^abstract/i.test(l));
    const abstractText = aiIdx >= 0
      ? lines.slice(aiIdx + 1, aiIdx + 5).join(" ")
      : lines.slice(1, 4).join(" ");
    return { title: { en: title, zh: title }, abstract: { en: abstractText, zh: abstractText } };
  }
}

// 排版工具栏集中管理风格、字体、字号、行距和分栏，修改后会触发重新分页。
function TypographyToolbar({
  settings,
  columns,
  onSettings,
  onColumns,
  onReset,
}: {
  settings: TypographySettings;
  columns: 1 | 2;
  onSettings: (next: TypographySettings) => void;
  onColumns: (next: 1 | 2) => void;
  onReset: () => void;
}) {
  const controlStyle: React.CSSProperties = {
    height: 30,
    minWidth: 120,
    padding: "0 26px 0 8px",
    border: "1px solid #cfd6df",
    borderRadius: 2,
    backgroundColor: "#fff",
    color: "#243447",
    fontFamily: SANS,
    fontSize: "0.72rem",
    outline: "none",
  };
  const groupStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 7, minWidth: 0 };
  const labelStyle: React.CSSProperties = { color: "#64748b", fontFamily: SANS, flexShrink: 0 };

  return (
    <div className="typesetting-toolbar no-print" style={{ minHeight: 48, flexShrink: 0, display: "flex", alignItems: "center", gap: 14, padding: "7px 16px", backgroundColor: "#f7f9fb", borderBottom: "1px solid #d8dee6", flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#0f2744", fontFamily: SANS, paddingRight: 4 }}>
        <SlidersHorizontal size={14} />
        <BilingualText zh="排版设置" en="Typography" zhSize="0.78rem" enSize="0.56rem" weight={700} />
      </div>

      <label style={groupStyle}>
        <span style={labelStyle}><BilingualText zh="风格" en="Style" zhSize="0.7rem" enSize="0.5rem" weight={600} /></span>
        <select
          aria-label="排版风格 / Typography style"
          value={settings.fontStyle}
          onChange={(event) => onSettings({ ...settings, fontStyle: event.target.value as FontStyle })}
          style={controlStyle}
        >
          <option value="academic">学术经典 / Academic</option>
          <option value="modern">现代清晰 / Modern</option>
          <option value="international">国际期刊 / International</option>
        </select>
      </label>

      <label style={groupStyle}>
        <TypeIcon size={13} style={{ color: "#64748b" }} />
        <span style={labelStyle}><BilingualText zh="字体" en="Font" zhSize="0.7rem" enSize="0.5rem" weight={600} /></span>
        <select
          aria-label="正文字体 / Body font"
          value={settings.fontFamily}
          onChange={(event) => onSettings({ ...settings, fontFamily: event.target.value as FontFamily })}
          style={{ ...controlStyle, minWidth: 146 }}
        >
          <option value="auto">跟随风格 / Auto</option>
          <option value="song">宋体 / Song</option>
          <option value="times">Times New Roman</option>
          <option value="sans">无衬线 / Sans</option>
          <option value="kai">楷体 / Kai</option>
        </select>
      </label>

      <div style={groupStyle}>
        <span style={labelStyle}><BilingualText zh="字号" en="Size" zhSize="0.7rem" enSize="0.5rem" weight={600} /></span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 32px)", height: 30, border: "1px solid #cfd6df", borderRadius: 2, overflow: "hidden", backgroundColor: "#fff" }}>
          {([[
            "small", "A-", "小号 / Small",
          ], [
            "medium", "A", "中号 / Medium",
          ], [
            "large", "A+", "大号 / Large",
          ]] as const).map(([value, label, title]) => (
            <button
              key={value}
              type="button"
              title={title}
              aria-label={title}
              onClick={() => onSettings({ ...settings, fontSize: value })}
              style={{ border: "none", borderRight: value !== "large" ? "1px solid #d8dee6" : "none", backgroundColor: settings.fontSize === value ? "#0f2744" : "#fff", color: settings.fontSize === value ? "#fff" : "#334155", fontFamily: SERIF, fontSize: value === "small" ? "0.68rem" : value === "large" ? "0.86rem" : "0.76rem", cursor: "pointer" }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <label style={groupStyle}>
        <Rows3 size={13} style={{ color: "#64748b" }} />
        <span style={labelStyle}><BilingualText zh="行距" en="Leading" zhSize="0.7rem" enSize="0.5rem" weight={600} /></span>
        <select
          aria-label="正文行距 / Body leading"
          value={settings.lineHeight}
          onChange={(event) => onSettings({ ...settings, lineHeight: event.target.value as LineHeight })}
          style={{ ...controlStyle, minWidth: 112 }}
        >
          <option value="compact">紧凑 / Compact</option>
          <option value="standard">标准 / Standard</option>
          <option value="relaxed">宽松 / Relaxed</option>
        </select>
      </label>

      <div style={{ ...groupStyle, marginLeft: "auto" }}>
        <span style={labelStyle}><BilingualText zh="分栏" en="Columns" zhSize="0.7rem" enSize="0.5rem" weight={600} /></span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 34px)", height: 30, border: "1px solid #cfd6df", borderRadius: 2, overflow: "hidden", backgroundColor: "#fff" }}>
          {([{ value: 1 as const, icon: AlignLeft, title: "单栏 / One column" }, { value: 2 as const, icon: Columns, title: "双栏 / Two columns" }] as const).map(({ value, icon: Icon, title }) => (
            <button key={value} type="button" title={title} aria-label={title} onClick={() => onColumns(value)} style={{ border: "none", borderRight: value === 1 ? "1px solid #d8dee6" : "none", backgroundColor: columns === value ? "#0f2744" : "#fff", color: columns === value ? "#fff" : "#475569", cursor: "pointer", display: "grid", placeItems: "center" }}>
              <Icon size={14} />
            </button>
          ))}
        </div>
        <button type="button" title="恢复默认排版 / Reset typography" aria-label="恢复默认排版 / Reset typography" onClick={onReset} style={{ width: 30, height: 30, border: "1px solid #cfd6df", borderRadius: 2, backgroundColor: "#fff", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
          <RotateCcw size={13} />
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   ROOT APP
   ═══════════════════════════════════════════════════════════════════════ */
export default function App() {
  const [paper, setPaper]     = useState<PaperData>(DEMO);
  const [lang, setLang]       = useState<Lang>("en");
  const [columns, setColumns] = useState<1 | 2>(initialColumns);
  const [typography, setTypography] = useState<TypographySettings>(initialTypography);
  const [tab, setTab]         = useState<EditorTab>("basic");
  const [mode, setMode]       = useState<"split" | "preview">("split");
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const loadBackendArticle = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/articles/${encodeURIComponent(id)}/editor`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || `${response.status} ${response.statusText}`);
      }
      const payload = await response.json() as EditorResponse;
      setPaper(payload.paper);
      showToast(`已载入 “${payload.paper.title.zh || payload.paper.title.en}” / Loaded`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("article");
    if (id) void loadBackendArticle(id);
  }, [loadBackendArticle]);

  useEffect(() => {
    try {
      // 本地缓存用于普通刷新；URL 参数用于复制链接后恢复设置。
      window.localStorage.setItem(TYPOGRAPHY_STORAGE_KEY, JSON.stringify(typography));
      window.localStorage.setItem(COLUMNS_STORAGE_KEY, String(columns));
    } catch {
      // 浏览器禁用本地存储时仍保留 URL 参数，不影响当前排版。
    }
    const url = new URL(window.location.href);
    url.searchParams.set("font_style", typography.fontStyle);
    url.searchParams.set("font_family", typography.fontFamily);
    url.searchParams.set("font_size", typography.fontSize);
    url.searchParams.set("line_height", typography.lineHeight);
    url.searchParams.set("two_column", String(columns === 2));
    window.history.replaceState({}, "", url);
  }, [typography, columns]);

  const handleFile = async (file: File) => {
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith(".xml") || lowerName.endsWith(".zip")) {
      setLoading(true);
      try {
        const body = new FormData();
        body.append("file", file);
        const response = await fetch("/api/upload", { method: "POST", body });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.detail || `${response.status} ${response.statusText}`);
        }
        const payload = await response.json();
        window.history.replaceState({}, "", `/studio/?article=${encodeURIComponent(payload.article_id)}`);
        await loadBackendArticle(payload.article_id);
      } catch (error) {
        showToast(error instanceof Error ? error.message : String(error), false);
      } finally {
        setLoading(false);
      }
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseUpload(e.target?.result as string);
      if (parsed) {
        setPaper((p) => ({ ...p, ...parsed }));
        showToast(`已导入 “${file.name}” / Imported`);
      } else {
        showToast("无法解析文件 / Could not parse file", false);
      }
    };
    reader.readAsText(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // PDF 必须导出当前 React 预览 DOM，才能完整保留用户刚编辑的内容、
  // 当前语言、单双栏、图片和原版文章页的全部视觉效果。
  const exportPDF = () => window.print();

  const exportWord = () => {
    const node = document.getElementById("preview-root");
    if (!node) return;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
body{font-family:"Times New Roman",serif;font-size:10pt;line-height:1.55;margin:2.5cm;color:#111}
h1{font-size:14pt;font-weight:bold;margin-bottom:6pt}
h2{font-size:10pt;font-weight:bold;margin-top:12pt;margin-bottom:4pt;border-bottom:1px solid #ccc;padding-bottom:2pt}
p{margin-bottom:6pt;text-align:justify;text-indent:1.2em}
table{border-collapse:collapse;width:100%;font-size:9pt;margin:10pt 0}
th{border-bottom:2px solid #111;border-top:1px solid #ccc;padding:3pt 6pt;font-weight:bold}
td{border-bottom:1px solid #ddd;padding:3pt 6pt}
figcaption{font-size:8pt;color:#444;margin-top:4pt}
ol{font-size:8.5pt;line-height:1.6;padding-left:14pt}
</style></head><body>${node.outerHTML}</body></html>`;
    const blob = new Blob(["﻿", html], { type: "application/msword" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: "article.doc" });
    a.click();
    URL.revokeObjectURL(url);
  };

  /* button style helpers */
  const btnPrimary = (bg: string): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 6,
    padding: "6px 14px", fontSize: "0.75rem", fontFamily: SANS, fontWeight: 700,
    backgroundColor: bg, color: "#fff", border: "none", borderRadius: 2, cursor: "pointer",
  });
  const btnGhost: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 4,
    padding: "5px 10px", fontSize: "0.72rem", fontFamily: SANS,
    backgroundColor: "rgba(255,255,255,0.12)", color: "#fff",
    border: "1px solid rgba(255,255,255,0.2)", borderRadius: 2, cursor: "pointer",
  };

  return (
    <div className="studio-app" style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          html, body { background: #fff !important; }
          body { margin: 0 !important; }
          .studio-app { height: auto !important; display: block !important; overflow: visible !important; }
          .preview-shell { padding: 0 !important; overflow: visible !important; background: #fff !important; }
          .studio-main { height: auto !important; display: block !important; }
          .pagination-source, .paged-preview-status { display: none !important; }
          .paged-preview-viewport { padding: 0 !important; }
          .paged-preview-scale { zoom: 1 !important; width: auto !important; }
          .paged-preview-output .pagedjs_pages { display: block !important; }
          .paged-preview-output .pagedjs_page { margin: 0 !important; box-shadow: none !important; break-after: page !important; }
          #preview-root img { max-width: 100% !important; height: auto !important; object-fit: contain !important; break-inside: avoid !important; }
          #preview-root img, #preview-root h1, #preview-root h2 { break-inside: avoid; }
          .print-running-header { display: flex !important; position: fixed; top: 5mm; left: 19mm; right: 19mm; z-index: 20; justify-content: space-between; padding-bottom: 2mm; border-bottom: 0.5pt solid #111; font-family: var(--paper-caption-font); font-size: 8pt; }
          .issue-header-screen { display: none !important; }
          @page { margin: 0; size: A4; }
        }
        .print-running-header { display: none; }
        .paged-preview-output .pagedjs_pages { display: flex; flex-direction: column; align-items: center; gap: 22px; width: 100%; }
        .paged-preview-output .pagedjs_page { margin: 0 !important; background: #fff; box-shadow: 0 3px 18px rgba(15, 23, 42, 0.18); }
        .paged-preview-output .pagedjs_sheet, .paged-preview-output .pagedjs_pagebox { background: #fff; }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
        @media (max-width: 1399px) {
          .studio-header-row { height: auto !important; min-height: 52px; flex-wrap: wrap; row-gap: 6px; padding-top: 6px !important; padding-bottom: 6px !important; }
          .studio-tagline { display: none !important; }
          .studio-actions { width: 100%; margin-left: 0 !important; justify-content: flex-end; padding-top: 5px; border-top: 1px solid rgba(255,255,255,0.12); }
          .studio-main { min-height: 0 !important; }
          .typesetting-toolbar { gap: 9px !important; padding-left: 10px !important; padding-right: 10px !important; }
        }
      `}</style>

      {/* toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 9999, display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 4, backgroundColor: toast.ok ? "#166534" : "#991b1b", color: "#fff", fontFamily: SANS, fontSize: "0.82rem", boxShadow: "0 4px 12px rgba(0,0,0,0.25)" }}>
          {toast.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* ═══ HEADER ═══ */}
      <header className="no-print" style={{ backgroundColor: "#0f2744", borderBottom: "2px solid #c0392b", position: "sticky", top: 0, zIndex: 40 }}>
        <div className="studio-header-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 16px", height: 52 }}>
          <BookOpen size={17} style={{ color: "#7faacc", flexShrink: 0 }} />
          <span style={{ fontFamily: SANS, color: "#fff" }}>
            <BilingualText zh="学术论文排版" en="Academic Paper Formatter" zhSize="0.9rem" enSize="0.6rem" weight={700} />
          </span>
          <span style={{ fontFamily: SANS, color: "rgba(255,255,255,0.48)", marginLeft: 2 }} className="studio-tagline hidden md:block">
            <BilingualText zh="标准期刊版式" en="JATS XML Layout" zhSize="0.7rem" enSize="0.53rem" weight={500} />
          </span>

          <div style={{ display: "flex", gap: 2, marginLeft: 8 }}>
            <button onClick={() => window.location.assign("/?view=upload")} style={btnGhost}>
              <Upload size={12} /> <BilingualText zh="上传" en="Upload" zhSize="0.74rem" enSize="0.53rem" />
            </button>
            <button onClick={() => window.location.assign("/?view=library")} style={btnGhost}>
              <BookOpen size={12} /> <BilingualText zh="文章库" en="Library" zhSize="0.74rem" enSize="0.53rem" />
            </button>
          </div>

          {/* upload */}
          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            style={{ marginLeft: 8 }}
          >
            <input ref={fileRef} type="file" accept=".txt,.json,.xml,.zip" style={{ display: "none" }}
              onChange={(e) => { if (e.target.files?.[0]) void handleFile(e.target.files[0]); }} />
            <button onClick={() => fileRef.current?.click()} style={btnGhost}>
              <Upload size={13} /> <BilingualText zh="导入论文" en="Import" zhSize="0.74rem" enSize="0.53rem" />
            </button>
          </div>

          {/* view toggle */}
          <div style={{ display: "flex", gap: 1, padding: 2, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 2, marginLeft: 4 }}>
            {([{ v: "split" as const, icon: Edit3, label: { zh: "编辑预览", en: "Edit + Preview" } }, { v: "preview" as const, icon: Eye, label: { zh: "仅预览", en: "Preview" } }] as const).map(({ v, icon: Icon, label }) => (
              <button key={v} onClick={() => setMode(v)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", fontSize: "0.72rem", fontFamily: SANS, fontWeight: mode === v ? 600 : 400, border: "none", borderRadius: 2, cursor: "pointer", backgroundColor: mode === v ? "rgba(255,255,255,0.22)" : "transparent", color: mode === v ? "#fff" : "rgba(255,255,255,0.5)" }}>
                <Icon size={11} /><BilingualText {...label} zhSize="0.72rem" enSize="0.51rem" weight={mode === v ? 700 : 500} />
              </button>
            ))}
          </div>

          <div className="studio-actions" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            {/* language */}
            <div style={{ display: "flex", gap: 1, padding: 2, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 2 }}>
              <Globe size={12} style={{ color: "rgba(255,255,255,0.4)", margin: "auto 4px" }} />
              {(["en", "zh", "both"] as Lang[]).map((l) => {
                const lbl: Record<Lang, UiCopy> = {
                  en: { zh: "英文", en: "EN" },
                  zh: { zh: "中文", en: "ZH" },
                  both: { zh: "双语", en: "BI" },
                };
                return (
                  <button key={l} onClick={() => setLang(l)}
                    style={{ padding: "4px 8px", fontSize: "0.7rem", fontFamily: SANS, fontWeight: lang === l ? 600 : 400, border: "none", borderRadius: 2, cursor: "pointer", backgroundColor: lang === l ? "rgba(255,255,255,0.25)" : "transparent", color: lang === l ? "#fff" : "rgba(255,255,255,0.5)" }}>
                    <BilingualText {...lbl[l]} zhSize="0.7rem" enSize="0.5rem" weight={lang === l ? 700 : 500} gap={3} />
                  </button>
                );
              })}
            </div>

            {/* export */}
            <button onClick={exportPDF} style={btnPrimary("#c0392b")}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}>
              <Printer size={13} /> <BilingualText zh="导出" en="PDF" zhSize="0.74rem" enSize="0.55rem" weight={700} />
            </button>
            <button onClick={exportWord} style={btnPrimary("#1d4ed8")}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}>
              <FileDown size={13} /> <BilingualText zh="导出" en="Word" zhSize="0.74rem" enSize="0.55rem" weight={700} />
            </button>
          </div>
        </div>
      </header>

      <TypographyToolbar
        settings={typography}
        columns={columns}
        onSettings={setTypography}
        onColumns={setColumns}
        onReset={() => {
          setTypography(DEFAULT_TYPOGRAPHY);
          setColumns(2);
        }}
      />

      {/* ═══ MAIN SPLIT ═══ */}
      <div className="studio-main" style={{ display: "flex", flex: "1 1 auto", minHeight: 0 }}>

        {/* editor */}
        {mode === "split" && (
          <div className="no-print" style={{ width: "37%", flexShrink: 0, borderRight: "1px solid #e5e7eb", backgroundColor: "#fff", display: "flex", flexDirection: "column", minWidth: 0 }}>
            <EditorPanel paper={paper} setPaper={setPaper} tab={tab} setTab={setTab} />
          </div>
        )}

        {/* preview shell */}
        <div className="preview-shell" style={{ flex: 1, overflowY: "auto", backgroundColor: "#e8eaed", minWidth: 0 }}>
          <PaginatedPreview paper={paper} lang={lang} columns={columns} typography={typography} />
        </div>

      </div>

      {loading && (
        <div className="no-print" style={{ position: "fixed", inset: 0, zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(15,39,68,0.28)", backdropFilter: "blur(2px)" }}>
          <div style={{ padding: "14px 20px", borderRadius: 4, backgroundColor: "#fff", color: "#0f2744", fontFamily: SANS, fontSize: "0.82rem", boxShadow: "0 8px 30px rgba(0,0,0,0.2)" }}>
            <BilingualText zh="正在加载并解析论文…" en="Loading and parsing the article…" zhSize="0.84rem" enSize="0.62rem" />
          </div>
        </div>
      )}
    </div>
  );
}
