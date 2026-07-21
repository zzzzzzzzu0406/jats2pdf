import React, { useState, useRef } from "react";
import {
  FileText, Edit3, Eye, Upload, Printer, FileDown,
  BookOpen, Image, BookMarked, Sliders, FolderDown,
  CheckCircle, ChevronLeft, ChevronRight as ChevronRightIcon,
  Settings2, PanelLeft, PanelRight,
} from "lucide-react";

/* ─── design tokens ────────────────────────────────────────────────── */
export const SANS  = "'Inter', system-ui, sans-serif";
export const SERIF = "'Source Serif 4', 'Times New Roman', Georgia, serif";
export const MONO  = "'JetBrains Mono', monospace";

export const NAV_BG    = "#0f2744";
export const BORDER    = "#e5e7eb";
export const PANEL_BG  = "#f8fafc";
export const MUTED     = "#6b7280";
export const TEXT      = "#111827";
export const CANVAS_BG = "#dde1e7";

/* ─── types ────────────────────────────────────────────────────────── */
export type LeftTab =
  | "metadata"
  | "content"
  | "figures"
  | "references"
  | "layout"
  | "export";

export interface JournalInfo {
  name: string;
  abbrev?: string;
  publisher: string;
  accentColor: string;  // e.g. "#c0392b" or "#00629b"
  type: string;         // "elsevier" | "ieee" | etc.
}

export interface ShellActions {
  onExportPDF: () => void;
  onExportWord: () => void;
  onXML?: () => void;
  onUpload?: (file: File) => void;
}

export interface LanguageToggleProps {
  lang: "en" | "zh" | "both";
  onChange: (l: "en" | "zh" | "both") => void;
}

export type UiLang = "zh" | "en";

export interface JournalEditorShellProps {
  journal: JournalInfo;
  actions: ShellActions;
  langToggle?: LanguageToggleProps;
  /** UI interface language for sidebar labels, header text, etc. Defaults to "en". */
  uiLang?: UiLang;

  /* left panel — one ReactNode per tab */
  tabContent: {
    metadata: React.ReactNode;
    content: React.ReactNode;
    figures: React.ReactNode;
    references: React.ReactNode;
    layout: React.ReactNode;
    export: React.ReactNode;
  };

  /* center */
  preview: React.ReactNode;

  /* right panel — fixed 6-section structure, all optional */
  rightPanelSections: {
    layout?: React.ReactNode;
    typography?: React.ReactNode;
    contentStyle?: React.ReactNode;
    figuresTables?: React.ReactNode;
    export?: React.ReactNode;
    documentInfo?: React.ReactNode;
  };
}

/* ─── bilingual label helpers ──────────────────────────────────────── */
type BilingualLabel = { en: React.ReactNode; zh: React.ReactNode };

function labelFor(lang: UiLang, label: BilingualLabel): string {
  return lang === "zh" ? label.zh : label.en;
}

/* ─── left tab config ──────────────────────────────────────────────── */
const LEFT_TAB_LABELS: Record<LeftTab, BilingualLabel> = {
  metadata:   { en: "Metadata",          zh: "元数据"   },
  content:    { en: "Content",           zh: "内容"     },
  figures:    { en: "Figures & Tables",  zh: "图表"     },
  references: { en: "References",        zh: "参考文献" },
  layout:     { en: "Layout",            zh: "排版"     },
  export:     { en: "Export",            zh: "导出"     },
};

const LEFT_TAB_ICONS: Record<LeftTab, React.ReactNode> = {
  metadata:   <FileText size={14} />,
  content:    <Edit3 size={14} />,
  figures:    <Image size={14} />,
  references: <BookMarked size={14} />,
  layout:     <Sliders size={14} />,
  export:     <FolderDown size={14} />,
};

const LEFT_TAB_ORDER: LeftTab[] = [
  "metadata", "content", "figures", "references", "layout", "export",
];

/* ═══════════════════════════════════════════════════════════════════════
   SHELL
   ═══════════════════════════════════════════════════════════════════════ */
const RIGHT_SECTION_LABELS: Record<keyof JournalEditorShellProps["rightPanelSections"], BilingualLabel> = {
  layout:        { en: "Layout",          zh: "版面"       },
  typography:    { en: "Typography",      zh: "字体排印"   },
  contentStyle:  { en: "Content Style",   zh: "内容样式"   },
  figuresTables: { en: "Figures & Tables",zh: "图表"       },
  export:        { en: "Export",          zh: "导出"       },
  documentInfo:  { en: "Document Info",   zh: "文档信息"   },
};

export function JournalEditorShell({
  journal,
  actions,
  langToggle,
  uiLang = "en",
  tabContent,
  preview,
  rightPanelSections,
}: JournalEditorShellProps) {
  const [activeTab, setActiveTab]   = useState<LeftTab>("metadata");
  const [leftOpen, setLeftOpen]     = useState(true);
  const [rightOpen, setRightOpen]   = useState(true);
  const [previewMode, setPreviewMode] = useState<"edit" | "preview">("edit");
  const fileRef = useRef<HTMLInputElement>(null);

  const ac = journal.accentColor;
  const l = (bl: BilingualLabel) => labelFor(uiLang, bl);

  const handleFile = (file: File) => {
    if (actions.onUpload) actions.onUpload(file);
  };

  /* derived widths */
  const LEFT_W  = leftOpen  ? 272 : 0;
  const RIGHT_W = rightOpen ? 252 : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", backgroundColor: "#fff" }}>

      {/* ══════════════════════════════════════════════════════════════
          PLATFORM HEADER  —  three zones: Brand | Current Journal | Actions
          ══════════════════════════════════════════════════════════════ */}
      <header
        className="no-print"
        style={{
          backgroundColor: NAV_BG,
          borderBottom: `1px solid rgba(255,255,255,0.07)`,
          flexShrink: 0,
          display: "flex",
          alignItems: "stretch",
          height: 60,
        }}
      >
        {/* ── ZONE A: ScholarFormat brand ── */}
        <div style={{
          display: "flex", flexDirection: "column", justifyContent: "center",
          padding: "0 20px",
          borderRight: "1px solid rgba(255,255,255,0.08)",
          flexShrink: 0, minWidth: 148,
        }}>
          <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: "0.68rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "#fff" }}>
            ScholarFormat
          </div>
          <div style={{ fontFamily: MONO, fontSize: "0.55rem", color: "rgba(255,255,255,0.3)", letterSpacing: "0.05em", marginTop: 2 }}>
            Academic Publishing Platform
          </div>
        </div>

        {/* ── ZONE B: Current Journal (Purchased) — center, non-clickable ── */}
        <div style={{
          flex: 1, display: "flex", alignItems: "center", gap: 14,
          padding: "0 24px",
          borderRight: "1px solid rgba(255,255,255,0.08)",
          minWidth: 0,
        }}>
          {/* accent stripe */}
          <div style={{ width: 3, height: 36, borderRadius: 2, backgroundColor: ac, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: SANS, fontSize: "0.6rem", fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 3 }}>
              {l({ en: "Current Journal", zh: "当前期刊" })}
            </div>
            <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: "0.82rem", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.2 }}>
              {journal.name}
            </div>
            {journal.abbrev && (
              <div style={{ fontFamily: MONO, fontSize: "0.58rem", color: "rgba(255,255,255,0.28)", marginTop: 2 }}>
                {journal.publisher} · {journal.abbrev}
              </div>
            )}
          </div>
          {/* purchased badge */}
          <div style={{
            flexShrink: 0, display: "flex", alignItems: "center", gap: 4,
            padding: "3px 9px",
            backgroundColor: "rgba(34,197,94,0.12)",
            border: "1px solid rgba(34,197,94,0.25)",
            borderRadius: 20,
          }}>
            <CheckCircle size={10} style={{ color: "#4ade80" }} />
            <span style={{ fontFamily: SANS, fontSize: "0.58rem", color: "#4ade80", fontWeight: 700, letterSpacing: "0.06em" }}>
              {l({ en: "Purchased", zh: "已购买" })}
            </span>
          </div>
        </div>

        {/* ── ZONE C: Actions ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, flexShrink: 0 }}>

          {/* view mode */}
          <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "0 12px", borderRight: "1px solid rgba(255,255,255,0.08)" }}>
            {([
              { v: "edit"    as const, Icon: Edit3, label: { en: "Edit",    zh: "编辑" } },
              { v: "preview" as const, Icon: Eye,   label: { en: "Preview", zh: "预览" } },
            ]).map(({ v, Icon, label }) => (
              <button key={v} onClick={() => setPreviewMode(v)}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "5px 10px", fontSize: "0.7rem",
                  fontFamily: SANS, fontWeight: previewMode === v ? 700 : 400,
                  border: "none", borderRadius: 3, cursor: "pointer",
                  backgroundColor: previewMode === v ? "rgba(255,255,255,0.13)" : "transparent",
                  color: previewMode === v ? "#fff" : "rgba(255,255,255,0.38)",
                }}>
                <Icon size={12} />{l(label)}
              </button>
            ))}
          </div>

          {/* panel toggles */}
          {previewMode === "edit" && (
            <div style={{ display: "flex", alignItems: "center", gap: 1, padding: "0 10px", borderRight: "1px solid rgba(255,255,255,0.08)" }}>
              <button onClick={() => setLeftOpen((o) => !o)} title="Toggle editor panel"
                style={{ padding: "5px 6px", background: "none", border: "none", cursor: "pointer", borderRadius: 3, color: leftOpen ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)", transition: "color 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.07)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                <PanelLeft size={14} />
              </button>
              <button onClick={() => setRightOpen((o) => !o)} title="Toggle settings panel"
                style={{ padding: "5px 6px", background: "none", border: "none", cursor: "pointer", borderRadius: 3, color: rightOpen ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)", transition: "color 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.07)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                <PanelRight size={14} />
              </button>
            </div>
          )}

          {/* lang toggle — only when provided */}
          {langToggle && previewMode === "edit" && (
            <div style={{ display: "flex", alignItems: "center", gap: 1, padding: "0 10px", borderRight: "1px solid rgba(255,255,255,0.08)" }}>
              <span style={{ fontFamily: MONO, fontSize: "0.58rem", color: "rgba(255,255,255,0.25)", marginRight: 5 }}>{l({ en: "Lang", zh: "语言" })}</span>
              {(["en", "zh", "both"] as const).map((l) => {
                const lbl = { en: "EN", zh: "中", both: "双" };
                return (
                  <button key={l} onClick={() => langToggle.onChange(l)}
                    style={{
                      padding: "4px 7px", fontSize: "0.66rem", fontFamily: SANS,
                      fontWeight: langToggle.lang === l ? 700 : 400,
                      border: "none", borderRadius: 3, cursor: "pointer",
                      backgroundColor: langToggle.lang === l ? "rgba(255,255,255,0.15)" : "transparent",
                      color: langToggle.lang === l ? "#fff" : "rgba(255,255,255,0.32)",
                    }}>
                    {lbl[l]}
                  </button>
                );
              })}
            </div>
          )}

          {/* upload */}
          <div style={{ display: "flex", alignItems: "center", padding: "0 12px", borderRight: "1px solid rgba(255,255,255,0.08)" }}>
            <input ref={fileRef} type="file" accept=".txt,.json,.xml" style={{ display: "none" }}
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
            <button onClick={() => fileRef.current?.click()}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 11px", fontSize: "0.7rem", fontFamily: SANS, fontWeight: 500,
                border: "1px solid rgba(255,255,255,0.15)", borderRadius: 3,
                backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.12)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)"; }}>
              <Upload size={12} /> {l({ en: "Upload", zh: "上传" })}
            </button>
          </div>

          {/* primary export buttons — identical style, journal-neutral navy bg */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 14px" }}>
            <button onClick={actions.onExportPDF}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "6px 15px", fontSize: "0.72rem", fontFamily: SANS, fontWeight: 700,
                backgroundColor: "#c0392b", color: "#fff",
                border: "none", borderRadius: 3, cursor: "pointer",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1.1)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}>
              <Printer size={12} /> PDF
            </button>
            <button onClick={actions.onExportWord}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "6px 15px", fontSize: "0.72rem", fontFamily: SANS, fontWeight: 700,
                backgroundColor: "rgba(255,255,255,0.1)", color: "#fff",
                border: "1px solid rgba(255,255,255,0.2)", borderRadius: 3, cursor: "pointer",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.17)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)"; }}>
              <FileDown size={12} /> Word
            </button>
          </div>

        </div>
      </header>

      {/* ── sub-bar: journal spec tag + import hint ── */}
      <div className="no-print" style={{
        backgroundColor: "#f8fafc", borderBottom: `1px solid ${BORDER}`,
        padding: "4px 20px", flexShrink: 0,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: ac }} />
          <span style={{ fontFamily: SANS, fontSize: "0.68rem", fontWeight: 600, color: TEXT }}>
            {journal.publisher}
          </span>
          {journal.abbrev && (
            <span style={{ fontFamily: MONO, fontSize: "0.62rem", color: MUTED, paddingLeft: 6, borderLeft: `1px solid ${BORDER}` }}>
              {journal.abbrev}
            </span>
          )}
        </div>
        <span style={{ color: "#d1d5db", fontSize: "0.7rem" }}>·</span>
        <span style={{ fontFamily: SANS, fontSize: "0.7rem", color: MUTED }}>
          {l({ en: "Academic Paper Formatter — JATS XML → Standard Journal Layout", zh: "学术论文排版 — JATS XML → 标准期刊版面" })}
        </span>
        <div style={{ marginLeft: "auto", fontFamily: SANS, fontSize: "0.68rem", color: "#9ca3af" }}>
          {l({ en: <>Upload <strong>.txt</strong> · <strong>.json</strong> · <strong>.xml</strong> to import manuscript</>, zh: <>上传 <strong>.txt</strong> · <strong>.json</strong> · <strong>.xml</strong> 以导入稿件</> })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          MAIN WORKSPACE (3 columns)
          ══════════════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* ── LEFT EDITOR PANEL ── */}
        {previewMode === "edit" && (
          <div
            className="no-print"
            style={{
              width: LEFT_W,
              flexShrink: 0,
              borderRight: `1px solid ${BORDER}`,
              display: "flex",
              flexDirection: "column",
              backgroundColor: "#fff",
              overflow: "hidden",
              transition: "width 0.2s ease",
            }}
          >
            {leftOpen && (
              <>
                {/* tab rail */}
                <div style={{ display: "flex", flexDirection: "column", borderRight: `1px solid ${BORDER}`, width: "100%" }}>
                  <div style={{ display: "flex", borderBottom: `1px solid ${BORDER}`, overflowX: "auto" }}>
                    {LEFT_TAB_ORDER.map((id) => (
                      <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        style={{
                          display: "flex", flexDirection: "column", alignItems: "center",
                          gap: 3, padding: "9px 10px", fontSize: "0.62rem",
                          fontFamily: SANS, fontWeight: 500, whiteSpace: "nowrap",
                          border: "none", background: "none", cursor: "pointer",
                          flex: 1,
                          borderBottom: `2px solid ${activeTab === id ? ac : "transparent"}`,
                          color: activeTab === id ? ac : MUTED,
                        }}
                      >
                        {LEFT_TAB_ICONS[id]}
                        {l(LEFT_TAB_LABELS[id])}
                      </button>
                    ))}
                  </div>
                </div>

                {/* tab body */}
                <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 20px", scrollbarWidth: "thin" }}>
                  {activeTab === "metadata"   && tabContent.metadata}
                  {activeTab === "content"    && tabContent.content}
                  {activeTab === "figures"    && tabContent.figures}
                  {activeTab === "references" && tabContent.references}
                  {activeTab === "layout"     && tabContent.layout}
                  {activeTab === "export"     && tabContent.export}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── CENTER PREVIEW ── */}
        <div
          className="preview-shell"
          style={{ flex: 1, overflowY: "auto", backgroundColor: CANVAS_BG, minWidth: 0 }}
        >
          <div
            className="preview-page"
            style={{
              maxWidth: 800, margin: "22px auto",
              backgroundColor: "#fff",
              boxShadow: "0 1px 4px rgba(0,0,0,0.08), 0 4px 20px rgba(0,0,0,0.10)",
              minHeight: 1120,
            }}
          >
            {preview}
          </div>
          <div style={{ height: 24 }} />
        </div>

        {/* ── RIGHT SETTINGS PANEL ── */}
        {previewMode === "edit" && rightOpen && (
          <div
            className="no-print"
            style={{
              width: RIGHT_W,
              flexShrink: 0,
              borderLeft: `1px solid ${BORDER}`,
              display: "flex",
              flexDirection: "column",
              backgroundColor: "#fff",
              overflow: "hidden",
            }}
          >
            {/* right panel header */}
            <div style={{
              padding: "10px 14px",
              borderBottom: `1px solid ${BORDER}`,
              display: "flex", alignItems: "center", gap: 7,
              flexShrink: 0,
            }}>
              <Settings2 size={14} style={{ color: MUTED }} />
              <span style={{ fontFamily: SANS, fontSize: "0.72rem", fontWeight: 700, color: TEXT, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                {l({ en: "Formatting", zh: "格式设置" })}
              </span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "thin" }}>
              {(Object.keys(RIGHT_SECTION_LABELS) as (keyof typeof RIGHT_SECTION_LABELS)[]).map((key) => {
                const content = rightPanelSections[key];
                if (!content) return null;
                const label = l(RIGHT_SECTION_LABELS[key]);
                return (
                  <div key={key} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <div style={{
                      padding: "9px 14px 6px",
                      fontFamily: SANS, fontSize: "0.63rem", fontWeight: 700,
                      color: MUTED, letterSpacing: "0.08em", textTransform: "uppercase",
                    }}>
                      {label}
                    </div>
                    <div style={{ padding: "0 14px 12px" }}>
                      {content}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* print css */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .preview-shell { padding: 0 !important; overflow: visible !important; background: #fff !important; }
          .preview-page { box-shadow: none !important; margin: 0 !important; max-width: 100% !important; }
          @page { margin: 0; size: A4; }
        }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SHARED EDITOR FIELD COMPONENTS  (exported for use in both pages)
   ═══════════════════════════════════════════════════════════════════════ */
export function FieldInput({
  label, value, onChange, mono, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  mono?: boolean; placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontFamily: SANS, fontSize: "0.65rem", fontWeight: 700, color: MUTED, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>
        {label}
      </div>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%", padding: "6px 9px",
          fontSize: "0.8rem",
          fontFamily: mono ? MONO : SANS,
          border: `1px solid ${focused ? "#6b7280" : BORDER}`,
          borderRadius: 3, outline: "none",
          backgroundColor: "#fff", color: TEXT,
          transition: "border-color 0.15s",
        }}
      />
    </div>
  );
}

export function FieldTextarea({
  label, value, onChange, rows = 4, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  rows?: number; placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontFamily: SANS, fontSize: "0.65rem", fontWeight: 700, color: MUTED, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>
        {label}
      </div>
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%", padding: "6px 9px",
          fontSize: "0.8rem", fontFamily: SERIF,
          border: `1px solid ${focused ? "#6b7280" : BORDER}`,
          borderRadius: 3, outline: "none",
          backgroundColor: "#fff", color: TEXT,
          resize: "vertical", lineHeight: 1.6,
          transition: "border-color 0.15s",
        }}
      />
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: SANS, fontSize: "0.65rem", fontWeight: 700,
      color: MUTED, letterSpacing: "0.08em", textTransform: "uppercase",
      margin: "16px 0 8px", paddingBottom: 5,
      borderBottom: `1px solid ${BORDER}`,
    }}>
      {children}
    </div>
  );
}

export function RightSection({
  title, children,
}: {
  title: string; children: React.ReactNode;
}) {
  return (
    <div style={{ borderBottom: `1px solid ${BORDER}`, padding: "12px 14px" }}>
      <div style={{ fontFamily: SANS, fontSize: "0.65rem", fontWeight: 700, color: MUTED, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export function SliderField({
  label, value, min, max, step, unit, onChange,
}: {
  label: string; value: number; min: number; max: number;
  step: number; unit?: string; onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontFamily: SANS, fontSize: "0.72rem", color: TEXT }}>{label}</span>
        <span style={{ fontFamily: MONO, fontSize: "0.68rem", color: MUTED }}>{value}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#4b5563" }}
      />
    </div>
  );
}

export function ChoiceRow({
  label, options, value, onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontFamily: SANS, fontSize: "0.72rem", color: TEXT, marginBottom: 5 }}>{label}</div>
      <div style={{ display: "flex", gap: 4 }}>
        {options.map((o) => (
          <button key={o.value} onClick={() => onChange(o.value)}
            style={{
              flex: 1, padding: "4px 6px", fontSize: "0.68rem",
              fontFamily: SANS, fontWeight: value === o.value ? 700 : 400,
              border: `1px solid ${value === o.value ? "#374151" : BORDER}`,
              borderRadius: 3,
              backgroundColor: value === o.value ? "#374151" : "#f9fafb",
              color: value === o.value ? "#fff" : TEXT,
              cursor: "pointer",
            }}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ExportPanel({
  accentColor,
  onPDF, onWord, onXML, onDocx,
  summary,
}: {
  accentColor: string;
  onPDF: () => void;
  onWord: () => void;
  onXML?: () => void;
  onDocx?: () => void;
  summary?: { label: string; value: string | number }[];
}) {
  const Btn = ({
    label, sub, onClick, primary, color,
  }: {
    label: string; sub: string; onClick: () => void;
    primary?: boolean; color?: string;
  }) => (
    <button onClick={onClick}
      style={{
        width: "100%", padding: "10px 12px", marginBottom: 8,
        display: "flex", alignItems: "center", gap: 10, textAlign: "left",
        border: primary ? `2px solid ${color || accentColor}` : `1px solid ${BORDER}`,
        borderRadius: 3,
        backgroundColor: primary ? (color || accentColor) : "#fff",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(0.95)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}>
      <div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: "0.78rem", color: primary ? "#fff" : TEXT }}>
          {label}
        </div>
        <div style={{ fontFamily: SANS, fontSize: "0.68rem", color: primary ? "rgba(255,255,255,0.75)" : MUTED }}>
          {sub}
        </div>
      </div>
    </button>
  );

  return (
    <div>
      <Btn label="Generate PDF" sub="Browser print engine · A4 output" onClick={onPDF} primary color={accentColor} />
      <Btn label="Download PDF" sub="Save formatted paper to device" onClick={onPDF} />
      {onXML  && <Btn label="Export XML" sub="JATS XML for journal submission" onClick={onXML} />}
      {onDocx && <Btn label="Export DOCX" sub="Microsoft Word .doc format" onClick={onDocx} />}

      {summary && summary.length > 0 && (
        <div style={{ marginTop: 16, padding: "10px 12px", backgroundColor: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 3 }}>
          <div style={{ fontFamily: SANS, fontSize: "0.65rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
            Document Summary
          </div>
          {summary.map(({ label, value }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${BORDER}`, fontFamily: SANS, fontSize: "0.72rem" }}>
              <span style={{ color: MUTED }}>{label}</span>
              <span style={{ fontFamily: MONO, color: TEXT, fontWeight: 600 }}>{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
