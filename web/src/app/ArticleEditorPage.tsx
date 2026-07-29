import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, ImageOff, Plus, Trash2 } from "lucide-react";
import { useI18n, type ContentLang } from "./i18n";
import type {
  Author,
  BiText,
  FigureItem,
  PaperData,
  Section,
  Subsection,
  TableItem,
} from "./types";
import {
  ChoiceRow,
  ExportPanel,
  FieldInput,
  FieldTextarea,
  getJournalPageLayout,
  JournalEditorShell,
  type JournalInfo,
  type JournalPageSize,
  MONO,
  RightSection,
  SANS,
  SERIF,
  SliderField,
  TEXT,
  MUTED,
  BORDER,
} from "./shell/JournalEditorShell";

type Toast = { message: string; ok: boolean };

const EMPTY_BI: BiText = { en: "", zh: "" };

const EMPTY_PAPER: PaperData = {
  journal: "",
  journalZh: "",
  issn: "",
  doi: "",
  volume: "",
  year: "",
  pages: "",
  received: "",
  revised: "",
  accepted: "",
  title: EMPTY_BI,
  authors: [],
  affiliations: [],
  highlights: [],
  highlightsZh: [],
  abstract: EMPTY_BI,
  keywords: { en: [], zh: [] },
  sections: [],
  figures: [],
  tables: [],
  references: [],
};

const JOURNALS: Record<string, JournalInfo & { refStyle: string; twoColumn: boolean; pageSize: JournalPageSize }> = {
  elsevier: {
    name: "Expert Systems with Applications",
    abbrev: "ESWA",
    publisher: "Elsevier",
    accentColor: "#c0392b",
    type: "elsevier",
    refStyle: "elsevier",
    twoColumn: false,
    pageSize: "a4",
  },
  ieee: {
    name: "IEEE Transactions on Neural Networks and Learning Systems",
    abbrev: "IEEE TNNLS",
    publisher: "IEEE",
    accentColor: "#00629b",
    type: "ieee",
    refStyle: "ieee",
    twoColumn: true,
    pageSize: "letter",
  },
  springer: {
    name: "Machine Learning",
    abbrev: "Mach Learn",
    publisher: "Springer",
    accentColor: "#1565c0",
    type: "springer",
    refStyle: "apa",
    twoColumn: false,
    pageSize: "a4",
  },
  nature: {
    name: "Nature",
    abbrev: "Nature",
    publisher: "Springer Nature",
    accentColor: "#c0000a",
    type: "nature",
    refStyle: "nature",
    twoColumn: false,
    pageSize: "a4",
  },
};

function textValue(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function biValue(value: unknown): BiText {
  if (!value || typeof value !== "object") {
    const text = textValue(value);
    return { en: text, zh: text };
  }
  const source = value as Record<string, unknown>;
  return { en: textValue(source.en), zh: textValue(source.zh || source.en) };
}

function normalizePaper(raw: Partial<PaperData>): PaperData {
  const source = raw as Record<string, unknown>;
  const sections = Array.isArray(source.sections) ? source.sections : [];
  const normalizeSubsection = (value: unknown, index: number) => {
    const item = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
    return {
      id: textValue(item.id) || `subsection-${index + 1}`,
      number: textValue(item.number) || String(index + 1),
      title: biValue(item.title),
      content: biValue(item.content),
    };
  };
  const normalizeSection = (value: unknown, index: number): Section => {
    const item = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
    const children = Array.isArray(item.subsections) ? item.subsections : [];
    return {
      id: textValue(item.id) || `section-${index + 1}`,
      number: textValue(item.number) || String(index + 1),
      title: biValue(item.title),
      content: biValue(item.content),
      subsections: children.map(normalizeSubsection),
    };
  };
  const normalizeAuthor = (value: unknown): Author => {
    const item = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
    return {
      name: textValue(item.name),
      nameZh: textValue(item.nameZh || item.name),
      affKeys: textValue(item.affKeys || item.affiliation),
      email: textValue(item.email) || undefined,
    };
  };
  const normalizeFigure = (value: unknown, index: number): FigureItem => {
    const item = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
    return {
      id: textValue(item.id) || `figure-${index + 1}`,
      number: Number(item.number) || index + 1,
      caption: biValue(item.caption),
      placeholder: textValue(item.placeholder) || "#eef2f7",
      src: textValue(item.src) || undefined,
      sectionId: textValue(item.sectionId) || undefined,
      order: Number(item.order) || undefined,
    };
  };
  const normalizeTable = (value: unknown, index: number): TableItem => {
    const item = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
    const rawRows = Array.isArray(item.rows) ? item.rows : [];
    return {
      id: textValue(item.id) || `table-${index + 1}`,
      number: Number(item.number) || index + 1,
      caption: biValue(item.caption),
      headers: Array.isArray(item.headers) ? item.headers.map(textValue) : [],
      rows: rawRows.map((row) => ({
        cells: Array.isArray(row) ? row.map(textValue) : Array.isArray((row as { cells?: unknown[] })?.cells) ? (row as { cells: unknown[] }).cells.map(textValue) : [],
      })),
      headerRows: Array.isArray(item.headerRows) ? item.headerRows as TableItem["headerRows"] : undefined,
      bodyRows: Array.isArray(item.bodyRows) ? item.bodyRows as TableItem["bodyRows"] : undefined,
      footnotes: Array.isArray(item.footnotes) ? item.footnotes.map(textValue) : [],
      sectionId: textValue(item.sectionId) || undefined,
      order: Number(item.order) || undefined,
    };
  };

  return {
    ...EMPTY_PAPER,
    ...raw,
    journal: textValue(source.journal),
    journalZh: textValue(source.journalZh || source.journal),
    issn: textValue(source.issn),
    doi: textValue(source.doi),
    volume: textValue(source.volume),
    year: textValue(source.year),
    pages: textValue(source.pages),
    received: textValue(source.received),
    revised: textValue(source.revised),
    accepted: textValue(source.accepted),
    title: biValue(source.title),
    abstract: biValue(source.abstract),
    authors: Array.isArray(source.authors) ? source.authors.map(normalizeAuthor) : [],
    affiliations: Array.isArray(source.affiliations) ? source.affiliations.map((value) => {
      const item = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
      return { key: textValue(item.key), text: textValue(item.text), textZh: textValue(item.textZh || item.text) };
    }) : [],
    highlights: Array.isArray(source.highlights) ? source.highlights.map(textValue) : [],
    highlightsZh: Array.isArray(source.highlightsZh) ? source.highlightsZh.map(textValue) : [],
    keywords: {
      en: Array.isArray((source.keywords as { en?: unknown[] })?.en) ? (source.keywords as { en: unknown[] }).en.map(textValue) : [],
      zh: Array.isArray((source.keywords as { zh?: unknown[] })?.zh) ? (source.keywords as { zh: unknown[] }).zh.map(textValue) : [],
    },
    sections: sections.map(normalizeSection),
    figures: Array.isArray(source.figures) ? source.figures.map(normalizeFigure) : [],
    tables: Array.isArray(source.tables) ? source.tables.map(normalizeTable) : [],
    references: Array.isArray(source.references) ? source.references.map(textValue) : [],
  };
}

async function readResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = (payload as { detail?: string; message?: string }).detail
      || (payload as { message?: string }).message
      || `Request failed (${response.status})`;
    throw new Error(detail);
  }
  return payload as T;
}

function localized(value: BiText, lang: ContentLang): string {
  if (lang === "zh") return value.zh || value.en;
  if (lang === "both") return [value.zh, value.en].filter(Boolean).join(" / ");
  return value.en || value.zh;
}

function Preview({ paper, lang, twoColumn, journal }: { paper: PaperData; lang: ContentLang; twoColumn: boolean; journal: JournalInfo }) {
  return (
    <article id="article-preview-root" style={{ fontFamily: SERIF, color: "#111827", padding: "38px 46px", fontSize: "10pt", lineHeight: 1.62 }}>
      <div style={{ borderTop: `3px solid ${journal.accentColor}`, borderBottom: "1px solid #d1d5db", padding: "7px 0", marginBottom: 20, display: "flex", justifyContent: "space-between", gap: 12 }}>
        <strong style={{ fontFamily: SANS, color: journal.accentColor, fontSize: "8.5pt" }}>{paper.journal || journal.name}</strong>
        <span style={{ fontFamily: MONO, color: "#6b7280", fontSize: "7.5pt" }}>{paper.volume} {paper.year} {paper.pages}</span>
      </div>
      <h1 style={{ fontSize: "17pt", lineHeight: 1.25, margin: "0 0 10px", fontWeight: 700 }}>{localized(paper.title, lang)}</h1>
      <div style={{ fontFamily: SANS, fontSize: "8.5pt", marginBottom: 5 }}>
        {paper.authors.map((author, index) => <span key={`${author.name}-${index}`}>{localized({ en: author.name, zh: author.nameZh }, lang)}{index < paper.authors.length - 1 ? ", " : ""}</span>)}
      </div>
      {paper.affiliations.length > 0 && <div style={{ fontFamily: SANS, color: "#4b5563", fontSize: "7.8pt", marginBottom: 14 }}>{paper.affiliations.map((affiliation) => <div key={affiliation.key}>{affiliation.key} {localized({ en: affiliation.text, zh: affiliation.textZh }, lang)}</div>)}</div>}
      <section style={{ background: "#f8fafc", border: "1px solid #e5e7eb", padding: "10px 13px", marginBottom: 18 }}>
        <strong style={{ fontFamily: SANS, fontSize: "8pt", textTransform: "uppercase" }}>Abstract</strong>
        <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap", textAlign: "justify" }}>{localized(paper.abstract, lang)}</p>
        {paper.keywords.en.length + paper.keywords.zh.length > 0 && <div style={{ fontFamily: SANS, fontSize: "8pt", marginTop: 8 }}><strong>Keywords:</strong> {localized({ en: paper.keywords.en.join(", "), zh: paper.keywords.zh.join(", ") }, lang)}</div>}
      </section>
      <div style={{ columnCount: twoColumn ? 2 : 1, columnGap: "22px" }}>
        {paper.sections.map((section) => <SectionPreview key={section.id} section={section} lang={lang} />)}
        {paper.figures.map((figure) => (
          <FigurePreview key={figure.id} figure={figure} lang={lang} />
        ))}
        {paper.tables.map((table) => <TablePreview key={table.id} table={table} lang={lang} />)}
      </div>
      {paper.references.length > 0 && <section style={{ marginTop: 20, breakBefore: "auto" }}><h2 style={{ fontFamily: SANS, fontSize: "10pt", borderBottom: "1px solid #d1d5db", paddingBottom: 4 }}>References</h2><ol style={{ paddingLeft: 20, fontFamily: SANS, fontSize: "8pt" }}>{paper.references.map((reference, index) => <li key={`${reference}-${index}`} style={{ marginBottom: 4 }}>{reference}</li>)}</ol></section>}
    </article>
  );
}

function FigurePreview({ figure, lang }: { figure: FigureItem; lang: ContentLang }) {
  const [status, setStatus] = useState<"loading" | "error">(figure.src ? "loading" : "error");

  useEffect(() => {
    setStatus(figure.src ? "loading" : "error");
  }, [figure.src]);

  const unavailableLabel = lang === "zh" ? "图片无法加载" : "Image unavailable";

  return (
    <figure style={{ breakInside: "avoid", margin: "16px 0" }}>
      <div
        style={{
          minHeight: 120,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: status === "error" ? figure.placeholder : "#f8fafc",
          border: "1px solid #e5e7eb",
          overflow: "hidden",
        }}
        role={status === "error" ? "img" : undefined}
        aria-label={status === "error" ? unavailableLabel : undefined}
      >
        {status === "error" ? (
          <ImageOff size={22} strokeWidth={1.6} color="#6b7280" aria-hidden="true" />
        ) : (
          <img
            src={figure.src}
            alt={localized(figure.caption, lang)}
            loading="eager"
            decoding="async"
            onError={() => setStatus("error")}
            style={{
              display: "block",
              width: "auto",
              maxWidth: "100%",
              height: "auto",
              maxHeight: 720,
              margin: "0 auto",
              objectFit: "contain",
            }}
          />
        )}
      </div>
      <figcaption style={{ fontFamily: SANS, color: "#4b5563", fontSize: "8pt", marginTop: 5 }}>Figure {figure.number}. {localized(figure.caption, lang)}</figcaption>
    </figure>
  );
}

function SectionPreview({ section, lang }: { section: Section | Subsection; lang: ContentLang }) {
  return (
    <section style={{ breakInside: "avoid", marginBottom: 15 }}>
      <h2 style={{ fontFamily: SANS, fontSize: "10.5pt", margin: "0 0 5px", color: "#1f2937" }}>{section.number}. {localized(section.title, lang)}</h2>
      {localized(section.content, lang).split(/\n\n+/).filter(Boolean).map((paragraph, index) => <p key={index} style={{ margin: "0 0 7px", whiteSpace: "pre-wrap", textAlign: "justify" }}>{paragraph}</p>)}
      {"subsections" in section && section.subsections.map((child) => <SectionPreview key={child.id} section={child} lang={lang} />)}
    </section>
  );
}

function TablePreview({ table, lang }: { table: TableItem; lang: ContentLang }) {
  const rows = table.bodyRows?.length ? table.bodyRows.map((row) => row.map((cell) => cell.text)) : table.rows.map((row) => row.cells);
  const headers = table.headers.length ? table.headers : table.headerRows?.[0]?.map((cell) => cell.text) || [];
  return <figure style={{ breakInside: "avoid", margin: "16px 0", overflowX: "auto" }}><figcaption style={{ fontFamily: SANS, fontSize: "8pt", marginBottom: 5 }}>Table {table.number}. {localized(table.caption, lang)}</figcaption><table style={{ width: "100%", borderCollapse: "collapse", fontFamily: SANS, fontSize: "8pt" }}><thead><tr>{headers.map((header, index) => <th key={index} style={{ textAlign: "left", borderTop: "1px solid #111827", borderBottom: "1px solid #111827", padding: "4px 5px" }}>{header}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} style={{ borderBottom: "1px solid #d1d5db", padding: "4px 5px", verticalAlign: "top" }}>{cell}</td>)}</tr>)}</tbody></table></figure>;
}

export default function ArticleEditorPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { ui, contentLang: lang, setContentLang: setLang } = useI18n();
  const articleId = searchParams.get("article") || "";
  const journal = JOURNALS[searchParams.get("journal") || "elsevier"] || JOURNALS.elsevier;
  const [paper, setPaper] = useState<PaperData | null>(null);
  const [twoColumn, setTwoColumn] = useState(journal.twoColumn);
  const [pageSize, setPageSize] = useState<JournalPageSize>(journal.pageSize);
  const [fontSize, setFontSize] = useState("medium");
  const [loading, setLoading] = useState(Boolean(articleId));
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [error, setError] = useState("");

  const notify = useCallback((message: string, ok = true) => {
    setToast({ message, ok });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    if (!articleId) {
      setLoading(false);
      setError("Missing article id. Upload a JATS XML or open an article from the library.");
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/articles/${encodeURIComponent(articleId)}/editor`, { signal: controller.signal })
      .then((response) => readResponse<{ paper: Partial<PaperData> }>(response))
      .then((payload) => setPaper(normalizePaper(payload.paper || {})))
      .catch((reason: unknown) => {
        if ((reason as { name?: string })?.name !== "AbortError") setError(reason instanceof Error ? reason.message : "Unable to load article");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [articleId]);

  const updatePaper = useCallback((patch: Partial<PaperData>) => setPaper((current) => current ? { ...current, ...patch } : current), []);

  const save = useCallback(async (): Promise<boolean> => {
    if (!paper || !articleId) return false;
    setSaving(true);
    try {
      await readResponse(await fetch(`/api/articles/${encodeURIComponent(articleId)}/editor`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paper }),
      }));
      notify("Saved article changes");
      return true;
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : "Save failed", false);
      return false;
    } finally {
      setSaving(false);
    }
  }, [articleId, notify, paper]);

  const handleUpload = useCallback((file: File) => {
    void (async () => {
      const form = new FormData();
      form.append("file", file);
      setSaving(true);
      try {
        const payload = await readResponse<{ article_id: string }>(await fetch("/api/upload", { method: "POST", body: form }));
        navigate(`/studio/editor?article=${encodeURIComponent(payload.article_id)}&journal=${journal.type}`);
      } catch (reason) {
        notify(reason instanceof Error ? reason.message : "Upload failed", false);
      } finally {
        setSaving(false);
      }
    })();
  }, [journal.type, navigate, notify]);

  const exportUrl = useCallback((kind: "pdf" | "html") => {
    const params = new URLSearchParams({ ref_style: journal.refStyle, two_column: String(twoColumn), page_size: pageSize, font_style: "academic", font_size: fontSize });
    return `/api/articles/${encodeURIComponent(articleId)}/${kind}?${params.toString()}`;
  }, [articleId, fontSize, journal.refStyle, twoColumn, pageSize]);

  const downloadServerFile = useCallback(async (kind: "pdf" | "html") => {
    if (!(await save())) return;
    const link = document.createElement("a");
    link.href = exportUrl(kind);
    link.target = "_blank";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, [exportUrl, save]);

  const downloadWord = useCallback(async () => {
    if (!(await save())) return;
    const node = document.getElementById("article-preview-root");
    if (!node) return;
    const blob = new Blob([`<!doctype html><html><head><meta charset="utf-8"></head><body>${node.innerHTML}</body></html>`], { type: "application/msword" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "article.doc";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }, [save]);

  const sectionPanel = useMemo(() => {
    if (!paper) return null;
    const updateSection = (index: number, patch: Partial<Section>) => updatePaper({ sections: paper.sections.map((section, current) => current === index ? { ...section, ...patch } : section) });
    return <div>
      <FieldTextarea label="Abstract (EN)" value={paper.abstract.en} onChange={(value) => updatePaper({ abstract: { ...paper.abstract, en: value } })} rows={5} />
      <FieldTextarea label="Abstract (中文)" value={paper.abstract.zh} onChange={(value) => updatePaper({ abstract: { ...paper.abstract, zh: value } })} rows={5} />
      <FieldInput label="Keywords (EN, comma separated)" value={paper.keywords.en.join(", ")} onChange={(value) => updatePaper({ keywords: { ...paper.keywords, en: value.split(",").map((item) => item.trim()).filter(Boolean) } })} />
      <FieldInput label="Keywords (中文，逗号分隔)" value={paper.keywords.zh.join(", ")} onChange={(value) => updatePaper({ keywords: { ...paper.keywords, zh: value.split(",").map((item) => item.trim()).filter(Boolean) } })} />
      {paper.sections.map((section, index) => <div key={section.id} style={{ border: `1px solid ${BORDER}`, padding: 9, marginBottom: 8, background: "#f8fafc" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}><strong style={{ fontFamily: SANS, fontSize: "0.75rem" }}>Section {section.number}</strong><button type="button" title="Delete section" onClick={() => updatePaper({ sections: paper.sections.filter((_, current) => current !== index) })} style={{ marginLeft: "auto", border: 0, background: "none", color: "#b91c1c", cursor: "pointer" }}><Trash2 size={13} /></button></div>
        <FieldInput label="Title (EN)" value={section.title.en} onChange={(value) => updateSection(index, { title: { ...section.title, en: value } })} />
        <FieldInput label="Title (中文)" value={section.title.zh} onChange={(value) => updateSection(index, { title: { ...section.title, zh: value } })} />
        <FieldTextarea label="Content (EN)" value={section.content.en} onChange={(value) => updateSection(index, { content: { ...section.content, en: value } })} rows={5} />
        <FieldTextarea label="Content (中文)" value={section.content.zh} onChange={(value) => updateSection(index, { content: { ...section.content, zh: value } })} rows={5} />
      </div>)}
      <button type="button" onClick={() => updatePaper({ sections: [...paper.sections, { id: `section-${Date.now()}`, number: String(paper.sections.length + 1), title: { ...EMPTY_BI }, content: { ...EMPTY_BI }, subsections: [] }] })} style={{ display: "flex", gap: 5, alignItems: "center", border: `1px solid ${BORDER}`, background: "#fff", padding: "6px 9px", cursor: "pointer", fontFamily: SANS, fontSize: "0.72rem" }}><Plus size={12} /> Add section</button>
    </div>;
  }, [paper, updatePaper]);

  const metadataPanel = paper && <div>
    <FieldInput label="Title (EN)" value={paper.title.en} onChange={(value) => updatePaper({ title: { ...paper.title, en: value } })} />
    <FieldInput label="Title (中文)" value={paper.title.zh} onChange={(value) => updatePaper({ title: { ...paper.title, zh: value } })} />
    <FieldInput label="Journal" value={paper.journal} onChange={(value) => updatePaper({ journal: value })} />
    <FieldInput label="DOI" value={paper.doi} onChange={(value) => updatePaper({ doi: value })} mono />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}><FieldInput label="Volume" value={paper.volume} onChange={(value) => updatePaper({ volume: value })} /><FieldInput label="Year" value={paper.year} onChange={(value) => updatePaper({ year: value })} /></div>
    <FieldInput label="Pages" value={paper.pages} onChange={(value) => updatePaper({ pages: value })} />
    <RightSection title="Authors">
      {paper.authors.map((author, index) => <div key={`${author.name}-${index}`} style={{ borderBottom: `1px solid ${BORDER}`, paddingBottom: 8, marginBottom: 8 }}><FieldInput label="Name" value={author.name} onChange={(value) => updatePaper({ authors: paper.authors.map((item, current) => current === index ? { ...item, name: value } : item) })} /><FieldInput label="Email" value={author.email || ""} onChange={(value) => updatePaper({ authors: paper.authors.map((item, current) => current === index ? { ...item, email: value } : item) })} /><button type="button" onClick={() => updatePaper({ authors: paper.authors.filter((_, current) => current !== index) })} style={{ border: 0, background: "none", color: "#b91c1c", cursor: "pointer", fontFamily: SANS, fontSize: "0.68rem" }}><Trash2 size={11} /> Remove</button></div>)}
      <button type="button" onClick={() => updatePaper({ authors: [...paper.authors, { name: "", nameZh: "", affKeys: "" }] })} style={{ border: 0, background: "none", color: journal.accentColor, cursor: "pointer", fontFamily: SANS, fontSize: "0.7rem" }}><Plus size={12} /> Add author</button>
    </RightSection>
  </div>;

  const figuresPanel = paper && <div>
    <p style={{ fontFamily: SANS, fontSize: "0.7rem", color: MUTED }}>Figures and tables imported from JATS are preserved when the article is saved.</p>
    {paper.figures.map((figure, index) => <div key={figure.id} style={{ border: `1px solid ${BORDER}`, padding: 9, marginBottom: 8 }}><div style={{ display: "flex", justifyContent: "space-between", fontFamily: SANS, fontSize: "0.74rem", marginBottom: 7 }}><strong>Figure {figure.number}</strong><button type="button" title="Delete figure" onClick={() => updatePaper({ figures: paper.figures.filter((_, current) => current !== index) })} style={{ border: 0, background: "none", color: "#b91c1c", cursor: "pointer" }}><Trash2 size={12} /></button></div><FieldInput label="Caption (EN)" value={figure.caption.en} onChange={(value) => updatePaper({ figures: paper.figures.map((item, current) => current === index ? { ...item, caption: { ...item.caption, en: value } } : item) })} /><FieldInput label="Caption (中文)" value={figure.caption.zh} onChange={(value) => updatePaper({ figures: paper.figures.map((item, current) => current === index ? { ...item, caption: { ...item.caption, zh: value } } : item) })} /></div>)}
    {paper.tables.map((table, index) => <div key={table.id} style={{ border: `1px solid ${BORDER}`, padding: 9, marginBottom: 8 }}><div style={{ display: "flex", justifyContent: "space-between", fontFamily: SANS, fontSize: "0.74rem", marginBottom: 7 }}><strong>Table {table.number}</strong><button type="button" title="Delete table" onClick={() => updatePaper({ tables: paper.tables.filter((_, current) => current !== index) })} style={{ border: 0, background: "none", color: "#b91c1c", cursor: "pointer" }}><Trash2 size={12} /></button></div><FieldInput label="Caption" value={table.caption.en} onChange={(value) => updatePaper({ tables: paper.tables.map((item, current) => current === index ? { ...item, caption: { ...item.caption, en: value, zh: item.caption.zh || value } } : item) })} /></div>)}
  </div>;

  const referencesPanel = paper && <FieldTextarea label="One reference per line" value={paper.references.join("\n")} onChange={(value) => updatePaper({ references: value.split("\n").map((item) => item.trim()).filter(Boolean) })} rows={24} />;
  const exportPanel = paper && <ExportPanel accentColor={journal.accentColor} pdfSub="Server-rendered PDF · journal settings" onPDF={() => void downloadServerFile("pdf")} onWord={() => void downloadWord()} onHTML={() => void downloadServerFile("html")} summary={[{ label: "Sections", value: paper.sections.length }, { label: "Figures", value: paper.figures.length }, { label: "Tables", value: paper.tables.length }, { label: "References", value: paper.references.length }]} />;

  if (loading) return <div style={{ height: "100%", display: "grid", placeItems: "center", fontFamily: SANS, color: MUTED }}>Loading article…</div>;
  if (error || !paper) return <div style={{ height: "100%", display: "grid", placeItems: "center", padding: 24, fontFamily: SANS }}><div style={{ maxWidth: 520, border: `1px solid ${BORDER}`, padding: 24, background: "#fff" }}><AlertCircle size={18} color="#b91c1c" /><h1 style={{ fontSize: "1rem", color: TEXT }}>Article editor unavailable</h1><p style={{ color: MUTED, fontSize: "0.82rem", lineHeight: 1.6 }}>{error || "No article loaded."}</p><button type="button" onClick={() => navigate("/")} style={{ border: 0, background: journal.accentColor, color: "#fff", padding: "7px 11px", cursor: "pointer" }}>Back to portal</button></div></div>;

  const layoutPanel = <div><ChoiceRow label="Columns" options={[{ value: "1", label: "Single" }, { value: "2", label: "Two" }]} value={twoColumn ? "2" : "1"} onChange={(value) => setTwoColumn(value === "2")} /><ChoiceRow label="Page size" options={[{ value: "a4", label: "A4" }, { value: "letter", label: "Letter" }]} value={pageSize} onChange={(value) => setPageSize(value as JournalPageSize)} /><ChoiceRow label="Font size" options={[{ value: "small", label: "Small" }, { value: "medium", label: "Medium" }, { value: "large", label: "Large" }]} value={fontSize} onChange={setFontSize} /></div>;
  const typographyPanel = <ChoiceRow label="Font size" options={[{ value: "small", label: "Small" }, { value: "medium", label: "Medium" }, { value: "large", label: "Large" }]} value={fontSize} onChange={setFontSize} />;
  const documentInfo = <div style={{ fontFamily: SANS, fontSize: "0.7rem", color: MUTED, lineHeight: 1.7 }}><div>ID: <span style={{ fontFamily: MONO, color: TEXT }}>{articleId}</span></div><div>Source: backend Article</div><div>{saving ? "Pending request" : "Ready"}</div></div>;

  return <>
    {toast && <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 20, display: "flex", alignItems: "center", gap: 7, padding: "9px 14px", background: toast.ok ? "#166534" : "#991b1b", color: "#fff", fontFamily: SANS, fontSize: "0.78rem" }}>{toast.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}{toast.message}</div>}
    <JournalEditorShell
      uiLang={ui}
      journal={journal}
      pageLayout={getJournalPageLayout(journal.type, pageSize)}
      actions={{ onExportPDF: () => void downloadServerFile("pdf"), onExportWord: () => void downloadWord(), onUpload: handleUpload, onSave: () => void save(), saving }}
      langToggle={{ lang, onChange: setLang }}
      tabContent={{ metadata: metadataPanel, content: sectionPanel, figures: figuresPanel, references: referencesPanel, layout: layoutPanel, export: exportPanel }}
      preview={<Preview paper={paper} lang={lang} twoColumn={twoColumn} journal={journal} />}
      rightPanelSections={{ layout: layoutPanel, typography: typographyPanel, export: exportPanel, documentInfo }}
    />
  </>;
}
