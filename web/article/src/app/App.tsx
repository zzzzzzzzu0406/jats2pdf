import { useState, useRef, useCallback } from "react";
import {
  Upload, FileText, Printer, Globe, Eye, Edit3,
  Plus, Trash2, ChevronDown, ChevronRight, BookOpen,
  FileDown, AlignLeft, Columns, AlertCircle, CheckCircle2,
  Share2, Bookmark, ExternalLink,
} from "lucide-react";
import type { PaperData, Section } from "./types";
import { DEMO } from "./demo";

/* ─── constants ──────────────────────────────────────────────────────── */
const SERIF = "'Source Serif 4', 'Times New Roman', Georgia, serif";
const SANS  = "'Inter', system-ui, sans-serif";
const MONO  = "'JetBrains Mono', monospace";
type Lang = "en" | "zh" | "both";
type EditorTab = "basic" | "abstract" | "sections" | "figures" | "refs";

/* ─── util ───────────────────────────────────────────────────────────── */
function bi(obj: { en: string; zh: string }, lang: Lang) {
  return lang === "en" ? obj.en : obj.zh;
}

/* ═══════════════════════════════════════════════════════════════════════
   PREVIEW  —  Elsevier ESWA style
   ═══════════════════════════════════════════════════════════════════════ */
function Preview({ paper, lang, columns }: {
  paper: PaperData;
  lang: Lang;
  columns: 1 | 2;
}) {
  const showEn = lang === "en" || lang === "both";
  const showZh = lang === "zh" || lang === "both";
  const bil    = lang === "both";

  return (
    <div
      id="preview-root"
      style={{
        fontFamily: SERIF,
        backgroundColor: "#fff",
        color: "#111",
        fontSize: "9.5pt",
        lineHeight: 1.55,
      }}
    >
      {/* journal header */}
      <div style={{ borderTop: "3px solid #c0392b", borderBottom: "1px solid #ddd", padding: "6px 0 5px", marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: "9pt", color: "#c0392b" }}>
            {bil ? `${paper.journal}  ·  ${paper.journalZh}` : showZh ? paper.journalZh : paper.journal}
          </span>
          <span style={{ fontFamily: MONO, fontSize: "7.5pt", color: "#888" }}>
            ISSN {paper.issn} | {paper.volume} ({paper.year}) {paper.pages}
          </span>
        </div>
      </div>

      {/* title */}
      {showZh && (
        <h1 style={{ fontFamily: SERIF, fontWeight: 700, fontSize: bil ? "13pt" : "15pt", lineHeight: 1.25, marginBottom: 4, color: "#111" }}>
          {paper.title.zh}
        </h1>
      )}
      {showEn && (
        <h1 style={{ fontFamily: SERIF, fontWeight: bil ? 600 : 700, fontStyle: bil ? "italic" : "normal", fontSize: bil ? "11pt" : "15pt", lineHeight: 1.3, marginBottom: 10, color: bil ? "#444" : "#111" }}>
          {paper.title.en}
        </h1>
      )}

      {/* authors */}
      <div style={{ marginBottom: 5, fontFamily: SANS, fontSize: "9pt", lineHeight: 1.7 }}>
        {paper.authors.map((a, i) => (
          <span key={i}>
            <span style={{ color: "#c0392b", fontWeight: 500 }}>
              {bil ? `${a.nameZh} (${a.name})` : showZh ? a.nameZh : a.name}
            </span>
            <sup style={{ fontSize: "7pt", color: "#666" }}>{a.affKeys}</sup>
            {i < paper.authors.length - 1 && <span style={{ color: "#888", margin: "0 4px" }}>,</span>}
          </span>
        ))}
      </div>

      {/* affiliations */}
      <div style={{ marginBottom: 8, fontFamily: SANS, fontSize: "7.8pt", color: "#444", lineHeight: 1.6 }}>
        {paper.affiliations.map((aff) => (
          <div key={aff.key}>
            <sup style={{ fontSize: "6pt" }}>{aff.key}</sup>
            {" "}{bil ? `${aff.textZh} / ${aff.text}` : showZh ? aff.textZh : aff.text}
          </div>
        ))}
      </div>

      {/* article history box */}
      <div style={{ display: "flex", gap: 16, marginBottom: 12, padding: "7px 10px", backgroundColor: "#f8f9fa", border: "1px solid #e0e0e0", fontFamily: SANS, fontSize: "7.5pt", color: "#555" }}>
        <div>
          <div style={{ fontWeight: 600, color: "#333", marginBottom: 2 }}>Article history</div>
          {paper.received && <div>Received {paper.received}</div>}
          {paper.revised  && <div>Revised {paper.revised}</div>}
          {paper.accepted && <div>Accepted {paper.accepted}</div>}
        </div>
        <div style={{ borderLeft: "1px solid #ddd", paddingLeft: 16 }}>
          <div style={{ fontWeight: 600, color: "#333", marginBottom: 2 }}>DOI</div>
          <div style={{ fontFamily: MONO, fontSize: "7pt" }}>{paper.doi}</div>
        </div>
      </div>

      {/* highlights */}
      {(paper.highlights.length > 0 || paper.highlightsZh.length > 0) && (
        <div style={{ marginBottom: 12, padding: "8px 12px", border: "1px solid #e0e0e0", borderLeft: "3px solid #c0392b" }}>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: "8pt", color: "#c0392b", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {showZh ? (bil ? "Highlights · 研究亮点" : "研究亮点") : "Highlights"}
          </div>
          <ul style={{ margin: 0, paddingLeft: 14, fontFamily: SANS, fontSize: "8pt", lineHeight: 1.65, color: "#333" }}>
            {showZh && paper.highlightsZh.map((h, i) => <li key={i}>{h}</li>)}
            {bil && <li style={{ listStyle: "none", height: 4 }} />}
            {showEn && paper.highlights.map((h, i) => (
              <li key={i} style={{ fontStyle: bil ? "italic" : "normal", color: bil ? "#666" : "#333" }}>{h}</li>
            ))}
          </ul>
        </div>
      )}

      {/* abstract + keywords */}
      <div style={{ marginBottom: 14, padding: "9px 12px", backgroundColor: "#f8f9fa", border: "1px solid #e0e0e0" }}>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: "8pt", color: "#333", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {showZh ? (bil ? "Abstract · 摘要" : "摘要") : "Abstract"}
        </div>
        {showZh && (
          <p style={{ margin: "0 0 6px", fontFamily: SERIF, fontSize: "9pt", textAlign: "justify", lineHeight: 1.6 }}>
            {paper.abstract.zh}
          </p>
        )}
        {bil && <hr style={{ border: "none", borderTop: "1px dashed #ddd", margin: "6px 0" }} />}
        {showEn && (
          <p style={{ margin: "0 0 8px", fontFamily: SERIF, fontSize: "9pt", textAlign: "justify", lineHeight: 1.6, fontStyle: bil ? "italic" : "normal", color: bil ? "#555" : "#111" }}>
            {paper.abstract.en}
          </p>
        )}
        <div style={{ fontFamily: SANS, fontSize: "8pt", lineHeight: 1.7 }}>
          <span style={{ fontWeight: 600 }}>Keywords{showZh ? " / 关键词" : ""}:</span>{" "}
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
      <div style={{
        columns: columns === 2 ? 2 : 1,
        columnGap: "1.8em",
        columnRule: columns === 2 ? "1px solid #e0e0e0" : undefined,
      }}>
        {paper.sections.map((sec, si) => (
          <div key={sec.id} style={{ breakInside: "avoid-column", marginBottom: "0.5em" }}>
            {/* section heading */}
            <h2 style={{ fontFamily: SANS, fontWeight: 700, fontSize: "9.5pt", color: "#111", margin: "12px 0 5px", paddingBottom: 3, borderBottom: "1px solid #ddd" }}>
              {bil
                ? `${sec.number}. ${sec.title.zh} / ${sec.title.en}`
                : `${sec.number}. ${bi(sec.title, lang)}`}
            </h2>

            {/* body paragraphs */}
            {(showZh ? sec.content.zh : sec.content.en)
              .split("\n\n")
              .filter(Boolean)
              .map((para, pi) => (
                <p key={pi} style={{ margin: "0 0 6px", textAlign: "justify", fontFamily: SERIF, fontSize: "9.5pt", lineHeight: 1.6, textIndent: "1.2em" }}>
                  {para.trim()}
                </p>
              ))}

            {/* bilingual: show EN below ZH in italic */}
            {bil && sec.content.en !== sec.content.zh && (
              <div style={{ borderLeft: "2px solid #e8e8e8", paddingLeft: 8, marginBottom: 4 }}>
                {sec.content.en.split("\n\n").filter(Boolean).map((para, pi) => (
                  <p key={pi} style={{ margin: "0 0 5px", textAlign: "justify", fontFamily: SERIF, fontSize: "8.8pt", lineHeight: 1.55, color: "#555", fontStyle: "italic", textIndent: "1.2em" }}>
                    {para.trim()}
                  </p>
                ))}
              </div>
            )}

            {/* figure placed after matching section */}
            {paper.figures[si] && (
              <figure style={{ breakInside: "avoid", margin: "10px 0", textAlign: "center" }}>
                <div style={{ backgroundColor: paper.figures[si].placeholder, border: "1px solid #ddd", padding: "22px 12px", fontSize: "8pt", fontFamily: SANS, color: "#666", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 90 }}>
                  [Fig. {paper.figures[si].number}]
                </div>
                <figcaption style={{ fontFamily: SANS, fontSize: "8pt", color: "#444", marginTop: 5, lineHeight: 1.5, textAlign: "left" }}>
                  <strong>Fig. {paper.figures[si].number}.</strong>{" "}
                  {bil
                    ? `${paper.figures[si].caption.zh} / ${paper.figures[si].caption.en}`
                    : bi(paper.figures[si].caption, lang)}
                </figcaption>
              </figure>
            )}

            {/* table placed after matching section */}
            {paper.tables[si] && (
              <figure style={{ breakInside: "avoid", margin: "10px 0" }}>
                <figcaption style={{ fontFamily: SANS, fontSize: "8pt", fontWeight: 600, color: "#444", marginBottom: 4 }}>
                  Table {paper.tables[si].number}.{" "}
                  <span style={{ fontWeight: 400 }}>
                    {bil
                      ? `${paper.tables[si].caption.zh} / ${paper.tables[si].caption.en}`
                      : bi(paper.tables[si].caption, lang)}
                  </span>
                </figcaption>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: SANS, fontSize: "8pt" }}>
                  <thead>
                    <tr>
                      {paper.tables[si].headers.map((h, hi) => (
                        <th key={hi} style={{ borderTop: "1px solid #bbb", borderBottom: "2px solid #111", padding: "3px 6px", textAlign: hi === 0 ? "left" : "center", fontWeight: 700 }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paper.tables[si].rows.map((row, ri) => {
                      const isLast  = ri === paper.tables[si].rows.length - 1;
                      const isOurs  = row.cells[0].includes("(ours)") || row.cells[0].includes("本文");
                      return (
                        <tr key={ri} style={{ borderBottom: isLast ? "1.5px solid #666" : "1px solid #ddd", backgroundColor: isOurs ? "rgba(192,57,43,0.04)" : "transparent" }}>
                          {row.cells.map((c, ci) => (
                            <td key={ci} style={{ padding: "3px 6px", textAlign: ci === 0 ? "left" : "center", fontWeight: isOurs ? 700 : 400, color: isOurs && ci === 0 ? "#c0392b" : "#222" }}>
                              {c}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </figure>
            )}
          </div>
        ))}

        {/* extra figures beyond section count */}
        {paper.figures.slice(paper.sections.length).map((fig) => (
          <figure key={fig.id} style={{ breakInside: "avoid", margin: "10px 0", textAlign: "center" }}>
            <div style={{ backgroundColor: fig.placeholder, border: "1px solid #ddd", padding: "22px 12px", fontSize: "8pt", fontFamily: SANS, color: "#666", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 90 }}>
              [Fig. {fig.number}]
            </div>
            <figcaption style={{ fontFamily: SANS, fontSize: "8pt", color: "#444", marginTop: 5, lineHeight: 1.5, textAlign: "left" }}>
              <strong>Fig. {fig.number}.</strong>{" "}
              {bil ? `${fig.caption.zh} / ${fig.caption.en}` : bi(fig.caption, lang)}
            </figcaption>
          </figure>
        ))}

        {/* extra tables */}
        {paper.tables.slice(paper.sections.length).map((tbl) => (
          <figure key={tbl.id} style={{ breakInside: "avoid", margin: "10px 0" }}>
            <figcaption style={{ fontFamily: SANS, fontSize: "8pt", fontWeight: 600, color: "#444", marginBottom: 4 }}>
              Table {tbl.number}.{" "}
              <span style={{ fontWeight: 400 }}>
                {bil ? `${tbl.caption.zh} / ${tbl.caption.en}` : bi(tbl.caption, lang)}
              </span>
            </figcaption>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: SANS, fontSize: "8pt" }}>
              <thead>
                <tr>
                  {tbl.headers.map((h, hi) => (
                    <th key={hi} style={{ borderTop: "1px solid #bbb", borderBottom: "2px solid #111", padding: "3px 6px", textAlign: hi === 0 ? "left" : "center", fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tbl.rows.map((row, ri) => {
                  const isLast = ri === tbl.rows.length - 1;
                  const isOurs = row.cells[0].includes("(ours)") || row.cells[0].includes("本文");
                  return (
                    <tr key={ri} style={{ borderBottom: isLast ? "1.5px solid #666" : "1px solid #ddd", backgroundColor: isOurs ? "rgba(192,57,43,0.04)" : "transparent" }}>
                      {row.cells.map((c, ci) => (
                        <td key={ci} style={{ padding: "3px 6px", textAlign: ci === 0 ? "left" : "center", fontWeight: isOurs ? 700 : 400, color: isOurs && ci === 0 ? "#c0392b" : "#222" }}>{c}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </figure>
        ))}
      </div>

      {/* references */}
      <div style={{ marginTop: 14, paddingTop: 8, borderTop: "2px solid #111" }}>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: "9pt", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          References{showZh ? " / 参考文献" : ""}
        </div>
        <ol style={{ margin: 0, paddingLeft: 18, fontFamily: SANS, fontSize: "8pt", lineHeight: 1.65, color: "#333" }}>
          {paper.references.map((ref, i) => (
            <li key={i} style={{ marginBottom: 3 }}>{ref}</li>
          ))}
        </ol>
      </div>

      {/* page footer */}
      <div style={{ marginTop: 16, paddingTop: 5, borderTop: "1px solid #ddd", display: "flex", justifyContent: "space-between", fontFamily: SANS, fontSize: "7pt", color: "#aaa" }}>
        <span>{paper.journal} · {paper.volume} ({paper.year}) {paper.pages}</span>
        <span>© {paper.year} Elsevier Ltd. All rights reserved.</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   EDITOR HELPERS
   ═══════════════════════════════════════════════════════════════════════ */
function FieldInput({ label, value, onChange, mono }: { label: string; value: string; onChange: (v: string) => void; mono?: boolean }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontFamily: SANS, fontSize: "0.7rem", fontWeight: 600, color: "#6b7280", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>
        {label}
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

function FieldTextarea({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontFamily: SANS, fontSize: "0.7rem", fontWeight: 600, color: "#6b7280", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>
        {label}
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
          §{sec.number} {sec.title.en || sec.title.zh || "(untitled)"}
        </span>
        <button
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
            <FieldInput label="§ No." value={sec.number} onChange={(v) => onChange({ ...sec, number: v })} />
            <div />
          </div>
          <FieldInput label="Heading (EN)" value={sec.title.en} onChange={(v) => onChange({ ...sec, title: { ...sec.title, en: v } })} />
          <FieldInput label="Heading (中文)" value={sec.title.zh} onChange={(v) => onChange({ ...sec, title: { ...sec.title, zh: v } })} />
          <FieldTextarea label="Body (EN) — blank line between paragraphs" value={sec.content.en} onChange={(v) => onChange({ ...sec, content: { ...sec.content, en: v } })} rows={6} />
          <FieldTextarea label="Body (中文) — 段落间空行" value={sec.content.zh} onChange={(v) => onChange({ ...sec, content: { ...sec.content, zh: v } })} rows={6} />
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

  const TABS: { id: EditorTab; label: string }[] = [
    { id: "basic",    label: "Basic Info" },
    { id: "abstract", label: "Abstract" },
    { id: "sections", label: "Sections" },
    { id: "figures",  label: "Figs / Tables" },
    { id: "refs",     label: "References" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #e5e7eb", flexShrink: 0, padding: "0 12px", overflowX: "auto" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "10px 12px", fontSize: "0.75rem", fontFamily: SANS, fontWeight: 500,
              border: "none", background: "none", cursor: "pointer", whiteSpace: "nowrap",
              borderBottom: `2px solid ${tab === t.id ? "#c0392b" : "transparent"}`,
              color: tab === t.id ? "#c0392b" : "#6b7280",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 14, scrollbarWidth: "thin" }}>

        {/* ── BASIC INFO ── */}
        {tab === "basic" && (
          <div>
            <FieldInput label="Journal (EN)" value={paper.journal} onChange={(v) => set({ journal: v })} />
            <FieldInput label="Journal (中文)" value={paper.journalZh} onChange={(v) => set({ journalZh: v })} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <FieldInput label="ISSN" value={paper.issn} onChange={(v) => set({ issn: v })} mono />
              <FieldInput label="Volume" value={paper.volume} onChange={(v) => set({ volume: v })} />
              <FieldInput label="Year" value={paper.year} onChange={(v) => set({ year: v })} />
            </div>
            <FieldInput label="DOI" value={paper.doi} onChange={(v) => set({ doi: v })} mono />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <FieldInput label="Received" value={paper.received} onChange={(v) => set({ received: v })} />
              <FieldInput label="Revised" value={paper.revised} onChange={(v) => set({ revised: v })} />
              <FieldInput label="Accepted" value={paper.accepted} onChange={(v) => set({ accepted: v })} />
            </div>
            <FieldInput label="Title (EN)" value={paper.title.en} onChange={(v) => set({ title: { ...paper.title, en: v } })} />
            <FieldInput label="Title (中文)" value={paper.title.zh} onChange={(v) => set({ title: { ...paper.title, zh: v } })} />

            <div style={{ fontFamily: SANS, fontSize: "0.7rem", fontWeight: 700, color: "#6b7280", letterSpacing: "0.1em", textTransform: "uppercase", margin: "14px 0 8px" }}>Authors</div>
            {paper.authors.map((a, i) => (
              <div key={i} style={{ marginBottom: 8, padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 2, backgroundColor: "#f9fafb" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <FieldInput label="Name (EN)" value={a.name} onChange={(v) => { const authors = [...paper.authors]; authors[i] = { ...a, name: v }; set({ authors }); }} />
                  <FieldInput label="Name (中文)" value={a.nameZh} onChange={(v) => { const authors = [...paper.authors]; authors[i] = { ...a, nameZh: v }; set({ authors }); }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <FieldInput label="Aff. keys (e.g. a,b)" value={a.affKeys} onChange={(v) => { const authors = [...paper.authors]; authors[i] = { ...a, affKeys: v }; set({ authors }); }} />
                  <FieldInput label="Email" value={a.email || ""} onChange={(v) => { const authors = [...paper.authors]; authors[i] = { ...a, email: v }; set({ authors }); }} />
                </div>
                <button onClick={() => set({ authors: paper.authors.filter((_, j) => j !== i) })}
                  style={{ fontFamily: SANS, fontSize: "0.72rem", color: "#ef4444", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  <Trash2 size={11} /> Remove
                </button>
              </div>
            ))}
            <button onClick={() => set({ authors: [...paper.authors, { name: "", nameZh: "", affKeys: "a" }] })}
              style={{ fontFamily: SANS, fontSize: "0.75rem", color: "#c0392b", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, marginBottom: 16 }}>
              <Plus size={13} /> Add Author
            </button>

            <div style={{ fontFamily: SANS, fontSize: "0.7rem", fontWeight: 700, color: "#6b7280", letterSpacing: "0.1em", textTransform: "uppercase", margin: "4px 0 8px" }}>Affiliations</div>
            {paper.affiliations.map((aff, i) => (
              <div key={i} style={{ marginBottom: 8, padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 2, backgroundColor: "#f9fafb" }}>
                <div style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: 8 }}>
                  <FieldInput label="Key" value={aff.key} onChange={(v) => { const affiliations = [...paper.affiliations]; affiliations[i] = { ...aff, key: v }; set({ affiliations }); }} />
                  <FieldInput label="Text (EN)" value={aff.text} onChange={(v) => { const affiliations = [...paper.affiliations]; affiliations[i] = { ...aff, text: v }; set({ affiliations }); }} />
                </div>
                <FieldInput label="Text (中文)" value={aff.textZh} onChange={(v) => { const affiliations = [...paper.affiliations]; affiliations[i] = { ...aff, textZh: v }; set({ affiliations }); }} />
                <button onClick={() => set({ affiliations: paper.affiliations.filter((_, j) => j !== i) })}
                  style={{ fontFamily: SANS, fontSize: "0.72rem", color: "#ef4444", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  <Trash2 size={11} /> Remove
                </button>
              </div>
            ))}
            <button onClick={() => set({ affiliations: [...paper.affiliations, { key: String.fromCharCode(97 + paper.affiliations.length), text: "", textZh: "" }] })}
              style={{ fontFamily: SANS, fontSize: "0.75rem", color: "#c0392b", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <Plus size={13} /> Add Affiliation
            </button>
          </div>
        )}

        {/* ── ABSTRACT ── */}
        {tab === "abstract" && (
          <div>
            <FieldTextarea label="Abstract (EN)" value={paper.abstract.en} onChange={(v) => set({ abstract: { ...paper.abstract, en: v } })} rows={7} />
            <FieldTextarea label="Abstract (中文)" value={paper.abstract.zh} onChange={(v) => set({ abstract: { ...paper.abstract, zh: v } })} rows={7} />
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: SANS, fontSize: "0.7rem", fontWeight: 600, color: "#6b7280", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>Keywords (EN) — comma separated</div>
              <input value={paper.keywords.en.join(", ")} onChange={(e) => set({ keywords: { ...paper.keywords, en: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } })}
                style={{ width: "100%", padding: "6px 10px", fontSize: "0.82rem", fontFamily: SANS, border: "1px solid #e5e7eb", borderRadius: 2, outline: "none" }} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: SANS, fontSize: "0.7rem", fontWeight: 600, color: "#6b7280", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>Keywords (中文) — 逗号分隔</div>
              <input value={paper.keywords.zh.join(", ")} onChange={(e) => set({ keywords: { ...paper.keywords, zh: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } })}
                style={{ width: "100%", padding: "6px 10px", fontSize: "0.82rem", fontFamily: SANS, border: "1px solid #e5e7eb", borderRadius: 2, outline: "none" }} />
            </div>
            <FieldTextarea label="Highlights (EN) — one per line" value={paper.highlights.join("\n")} onChange={(v) => set({ highlights: v.split("\n").map((s) => s.trim()).filter(Boolean) })} rows={5} />
            <FieldTextarea label="Highlights (中文) — 每行一条" value={paper.highlightsZh.join("\n")} onChange={(v) => set({ highlightsZh: v.split("\n").map((s) => s.trim()).filter(Boolean) })} rows={5} />
          </div>
        )}

        {/* ── SECTIONS ── */}
        {tab === "sections" && (
          <div>
            <p style={{ fontFamily: SANS, fontSize: "0.75rem", color: "#6b7280", marginBottom: 10 }}>
              Separate paragraphs with a blank line.
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
              <Plus size={13} /> Add Section
            </button>
          </div>
        )}

        {/* ── FIGURES & TABLES ── */}
        {tab === "figures" && (
          <div>
            <div style={{ fontFamily: SANS, fontSize: "0.7rem", fontWeight: 700, color: "#6b7280", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Figures</div>
            {paper.figures.map((fig, i) => (
              <div key={fig.id} style={{ marginBottom: 8, padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 2, backgroundColor: "#f9fafb" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontFamily: SANS, fontSize: "0.78rem", fontWeight: 600 }}>Fig. {fig.number}</span>
                  <button onClick={() => set({ figures: paper.figures.filter((_, j) => j !== i) })} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}><Trash2 size={12} /></button>
                </div>
                <FieldInput label="Caption (EN)" value={fig.caption.en} onChange={(v) => { const figures = [...paper.figures]; figures[i] = { ...fig, caption: { ...fig.caption, en: v } }; set({ figures }); }} />
                <FieldInput label="Caption (中文)" value={fig.caption.zh} onChange={(v) => { const figures = [...paper.figures]; figures[i] = { ...fig, caption: { ...fig.caption, zh: v } }; set({ figures }); }} />
                <FieldInput label="Placeholder colour" value={fig.placeholder} onChange={(v) => { const figures = [...paper.figures]; figures[i] = { ...fig, placeholder: v }; set({ figures }); }} mono />
              </div>
            ))}
            <button onClick={() => set({ figures: [...paper.figures, { id: `f${Date.now()}`, number: paper.figures.length + 1, caption: { en: "", zh: "" }, placeholder: "#dbeafe" }] })}
              style={{ fontFamily: SANS, fontSize: "0.75rem", display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", border: "1px solid #e5e7eb", borderRadius: 2, backgroundColor: "#f3f4f6", color: "#374151", cursor: "pointer", marginBottom: 18 }}>
              <Plus size={13} /> Add Figure
            </button>

            <div style={{ fontFamily: SANS, fontSize: "0.7rem", fontWeight: 700, color: "#6b7280", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Tables</div>
            {paper.tables.map((tbl, i) => (
              <div key={tbl.id} style={{ marginBottom: 8, padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 2, backgroundColor: "#f9fafb" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontFamily: SANS, fontSize: "0.78rem", fontWeight: 600 }}>Table {tbl.number}</span>
                  <button onClick={() => set({ tables: paper.tables.filter((_, j) => j !== i) })} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}><Trash2 size={12} /></button>
                </div>
                <FieldInput label="Caption (EN)" value={tbl.caption.en} onChange={(v) => { const tables = [...paper.tables]; tables[i] = { ...tbl, caption: { ...tbl.caption, en: v } }; set({ tables }); }} />
                <FieldInput label="Caption (中文)" value={tbl.caption.zh} onChange={(v) => { const tables = [...paper.tables]; tables[i] = { ...tbl, caption: { ...tbl.caption, zh: v } }; set({ tables }); }} />
                <FieldInput label="Column headers (comma-separated)" value={tbl.headers.join(", ")} onChange={(v) => { const tables = [...paper.tables]; tables[i] = { ...tbl, headers: v.split(",").map((s) => s.trim()) }; set({ tables }); }} />
              </div>
            ))}
            <button onClick={() => set({ tables: [...paper.tables, { id: `t${Date.now()}`, number: paper.tables.length + 1, caption: { en: "", zh: "" }, headers: ["Col 1", "Col 2"], rows: [{ cells: ["", ""] }] }] })}
              style={{ fontFamily: SANS, fontSize: "0.75rem", display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", border: "1px solid #e5e7eb", borderRadius: 2, backgroundColor: "#f3f4f6", color: "#374151", cursor: "pointer" }}>
              <Plus size={13} /> Add Table
            </button>
          </div>
        )}

        {/* ── REFERENCES ── */}
        {tab === "refs" && (
          <div>
            <p style={{ fontFamily: SANS, fontSize: "0.75rem", color: "#6b7280", marginBottom: 8 }}>One reference per line. Auto-numbered.</p>
            <FieldTextarea label="References" value={paper.references.join("\n")} onChange={(v) => set({ references: v.split("\n").map((s) => s.trim()).filter(Boolean) })} rows={20} />
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

/* ═══════════════════════════════════════════════════════════════════════
   ROOT APP
   ═══════════════════════════════════════════════════════════════════════ */
export default function App() {
  const [paper, setPaper]     = useState<PaperData>(DEMO);
  const [lang, setLang]       = useState<Lang>("en");
  const [columns, setColumns] = useState<1 | 2>(2);
  const [tab, setTab]         = useState<EditorTab>("basic");
  const [mode, setMode]       = useState<"split" | "preview">("split");
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseUpload(e.target?.result as string);
      if (parsed) {
        setPaper((p) => ({ ...p, ...parsed }));
        showToast(`Imported "${file.name}"`);
      } else {
        showToast("Could not parse file", false);
      }
    };
    reader.readAsText(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

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
</style></head><body>${node.innerHTML}</body></html>`;
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
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          #preview-root { max-width: 100% !important; }
          .preview-shell { padding: 0 !important; overflow: visible !important; background: #fff !important; }
          .preview-page { box-shadow: none !important; margin: 0 !important; padding: 1.8cm 2.2cm !important; }
          @page { margin: 0; size: A4; }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
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
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 16px", height: 52 }}>
          <BookOpen size={17} style={{ color: "#7faacc", flexShrink: 0 }} />
          <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: "0.85rem", color: "#fff", letterSpacing: "0.03em" }}>
            Academic Paper Formatter
          </span>
          <span style={{ fontFamily: SANS, fontSize: "0.72rem", color: "rgba(255,255,255,0.35)", marginLeft: 2 }} className="hidden md:block">
            JATS XML → Standard Journal Layout
          </span>

          {/* upload */}
          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            style={{ marginLeft: 8 }}
          >
            <input ref={fileRef} type="file" accept=".txt,.json,.xml" style={{ display: "none" }}
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
            <button onClick={() => fileRef.current?.click()} style={btnGhost}>
              <Upload size={13} /> Upload Paper
            </button>
          </div>

          {/* view toggle */}
          <div style={{ display: "flex", gap: 1, padding: 2, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 2, marginLeft: 4 }}>
            {([{ v: "split" as const, icon: Edit3, label: "Edit+Preview" }, { v: "preview" as const, icon: Eye, label: "Preview" }] as const).map(({ v, icon: Icon, label }) => (
              <button key={v} onClick={() => setMode(v)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", fontSize: "0.72rem", fontFamily: SANS, fontWeight: mode === v ? 600 : 400, border: "none", borderRadius: 2, cursor: "pointer", backgroundColor: mode === v ? "rgba(255,255,255,0.22)" : "transparent", color: mode === v ? "#fff" : "rgba(255,255,255,0.5)" }}>
                <Icon size={11} />{label}
              </button>
            ))}
          </div>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            {/* language */}
            <div style={{ display: "flex", gap: 1, padding: 2, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 2 }}>
              <Globe size={12} style={{ color: "rgba(255,255,255,0.4)", margin: "auto 4px" }} />
              {(["en", "zh", "both"] as Lang[]).map((l) => {
                const lbl: Record<Lang, string> = { en: "EN", zh: "中文", both: "双语" };
                return (
                  <button key={l} onClick={() => setLang(l)}
                    style={{ padding: "4px 8px", fontSize: "0.7rem", fontFamily: SANS, fontWeight: lang === l ? 600 : 400, border: "none", borderRadius: 2, cursor: "pointer", backgroundColor: lang === l ? "rgba(255,255,255,0.25)" : "transparent", color: lang === l ? "#fff" : "rgba(255,255,255,0.5)" }}>
                    {lbl[l]}
                  </button>
                );
              })}
            </div>

            {/* column toggle */}
            <div style={{ display: "flex", gap: 1, padding: 2, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 2 }}>
              {([{ v: 1 as const, icon: AlignLeft }, { v: 2 as const, icon: Columns }] as const).map(({ v, icon: Icon }) => (
                <button key={v} onClick={() => setColumns(v)}
                  style={{ padding: "4px 7px", border: "none", borderRadius: 2, cursor: "pointer", backgroundColor: columns === v ? "rgba(255,255,255,0.25)" : "transparent", color: columns === v ? "#fff" : "rgba(255,255,255,0.5)" }}>
                  <Icon size={13} />
                </button>
              ))}
            </div>

            {/* export */}
            <button onClick={exportPDF} style={btnPrimary("#c0392b")}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}>
              <Printer size={13} /> PDF
            </button>
            <button onClick={exportWord} style={btnPrimary("#1d4ed8")}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}>
              <FileDown size={13} /> Word
            </button>
          </div>
        </div>
      </header>

      {/* hint bar */}
      <div className="no-print" style={{ backgroundColor: "#f0f4f8", borderBottom: "1px solid #e5e7eb", padding: "5px 16px", display: "flex", alignItems: "center", gap: 8 }}>
        <FileText size={13} style={{ color: "#9ca3af", flexShrink: 0 }} />
        <span style={{ fontFamily: SANS, fontSize: "0.72rem", color: "#6b7280" }}>
          Upload <strong>.txt</strong> / <strong>.json</strong> to auto-import content, or edit fields in the left panel.
          &nbsp; Export as <strong style={{ color: "#c0392b" }}>PDF</strong> or <strong style={{ color: "#1d4ed8" }}>Word .doc</strong> at any time.
        </span>
      </div>

      {/* ═══ MAIN SPLIT ═══ */}
      <div style={{ display: "flex", height: "calc(100vh - 88px)" }}>

        {/* editor */}
        {mode === "split" && (
          <div className="no-print" style={{ width: "37%", flexShrink: 0, borderRight: "1px solid #e5e7eb", backgroundColor: "#fff", display: "flex", flexDirection: "column", minWidth: 0 }}>
            <EditorPanel paper={paper} setPaper={setPaper} tab={tab} setTab={setTab} />
          </div>
        )}

        {/* preview shell */}
        <div className="preview-shell" style={{ flex: 1, overflowY: "auto", backgroundColor: "#e8eaed", minWidth: 0 }}>
          <div
            className="preview-page"
            style={{ maxWidth: 760, margin: "20px auto", backgroundColor: "#fff", padding: "36px 44px", boxShadow: "0 2px 20px rgba(0,0,0,0.13)", borderRadius: 1, minHeight: 1100 }}
          >
            <Preview paper={paper} lang={lang} columns={columns} />
          </div>
        </div>

      </div>
    </>
  );
}
