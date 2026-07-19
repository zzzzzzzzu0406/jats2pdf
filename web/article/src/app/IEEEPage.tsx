import React, { useState, useRef } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, AlertCircle, CheckCircle2, FunctionSquare } from "lucide-react";
import { IEEE_DEMO, type IEEEPaperData, type IEEESection } from "./demoIEEE";
import {
  JournalEditorShell, SERIF, SANS, MONO, MUTED, BORDER, TEXT, PANEL_BG,
  FieldInput, FieldTextarea, SectionLabel, SliderField, ChoiceRow, ExportPanel,
} from "./shell/JournalEditorShell";

/* ═══════════════════════════════════════════════════════════════════════
   IEEE PAPER PREVIEW  (layout unchanged)
   ═══════════════════════════════════════════════════════════════════════ */
function IEEEPreview({ paper }: { paper: IEEEPaperData }) {
  const lineH = paper.lineSpacing;
  const fs    = paper.fontSize;
  const marginPx = paper.marginSize === "narrow" ? 28 : paper.marginSize === "wide" ? 52 : 38;

  return (
    <div id="ieee-preview-root" style={{ fontFamily: SERIF, fontSize: `${fs}pt`, lineHeight: lineH, color: "#000", backgroundColor: "#fff", padding: `${marginPx}px` }}>

      {/* ── IEEE HEADER ── */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <div style={{ height: 1, backgroundColor: "#000" }} />
          <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: "8pt", letterSpacing: "0.22em", textTransform: "uppercase", color: "#000", whiteSpace: "nowrap" }}>
            {paper.journalAbbrev}
          </div>
          <div style={{ height: 1, backgroundColor: "#000" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: SANS, fontSize: "7pt", color: "#444", marginBottom: 12 }}>
          <span>VOL. {paper.volume}, NO. {paper.issue}, {paper.year}</span>
          <span style={{ fontFamily: MONO, fontSize: "6.5pt" }}>Digital Object Identifier {paper.doi}</span>
          <span>{paper.pages}</span>
        </div>
        <div style={{ textAlign: "center", fontFamily: SANS, fontSize: "7pt", color: "#555", marginBottom: 8 }}>
          Date of publication: {paper.published}
          {paper.received && `  ·  Date of receipt: ${paper.received}`}
          {paper.revised  && `  ·  Date of revision: ${paper.revised}`}
        </div>
      </div>

      {/* ── TITLE + AUTHORS ── */}
      <div style={{ textAlign: "center", marginBottom: 10 }}>
        <h1 style={{ fontFamily: SERIF, fontWeight: 700, fontSize: `${fs + 4}pt`, lineHeight: 1.25, margin: "0 auto 10px", maxWidth: "92%" }}>
          {paper.title}
        </h1>
        <div style={{ fontFamily: SANS, fontSize: "9pt", lineHeight: 1.9, color: "#111", marginBottom: 4 }}>
          {paper.authors.map((a, i) => (
            <span key={i}>
              <span style={{ fontStyle: "italic" }}>{a.name}</span>
              {a.member && <span style={{ fontSize: "8pt", color: "#555" }}>, {a.member}</span>}
              {a.corresponding && <sup style={{ fontSize: "6.5pt", color: "#00629b" }}>*</sup>}
              {i < paper.authors.length - 1 && <span style={{ color: "#888", margin: "0 3px" }}>,</span>}
            </span>
          ))}
        </div>
      </div>

      {/* ── AFFILIATIONS ── */}
      <div style={{ textAlign: "center", fontFamily: SANS, fontSize: "7.5pt", color: "#444", lineHeight: 1.65, marginBottom: 10, borderBottom: "0.5px solid #bbb", paddingBottom: 8 }}>
        {paper.authors.map((a, i) => (
          <div key={i}>{a.affiliation}{a.email && ` (e-mail: ${a.email})`}</div>
        ))}
        <div style={{ marginTop: 4, fontSize: "7pt", color: "#555", fontStyle: "italic" }}>*Corresponding author</div>
      </div>

      {/* ── ABSTRACT + INDEX TERMS ── */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: SANS, fontSize: `${fs - 1}pt`, lineHeight: lineH, textAlign: "justify" }}>
          <span style={{ fontWeight: 700 }}>Abstract—</span>{paper.abstract}
        </div>
        <div style={{ fontFamily: SANS, fontSize: `${fs - 1}pt`, lineHeight: lineH, marginTop: 6 }}>
          <span style={{ fontWeight: 700 }}>Index Terms—</span>{paper.indexTerms.join(", ")}.
        </div>
      </div>

      {/* ── TWO-COLUMN BODY ── */}
      <div style={{ borderTop: "0.5px solid #000", marginBottom: 8 }} />
      <div style={{ columns: 2, columnGap: "1.6em", columnRule: "0.5px solid #bbb" }}>
        {paper.sections.map((sec, si) => (
          <div key={sec.id} style={{ breakInside: "avoid-column", marginBottom: "0.3em" }}>
            <h2 style={{ fontFamily: SANS, fontWeight: 700, fontSize: `${fs}pt`, textTransform: "uppercase", letterSpacing: "0.05em", margin: "10px 0 5px", textAlign: "center" }}>
              {sec.number}. {sec.title}
            </h2>
            {sec.content.split("\n\n").filter(Boolean).map((para, pi) => {
              if (para.startsWith("$$") && para.endsWith("$$")) {
                const inner = para.slice(2, -2);
                const eq = paper.equations.find((e) => e.latex === inner.trim());
                return (
                  <div key={pi} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "7px 12px", fontFamily: MONO, fontSize: `${fs - 1}pt`, backgroundColor: "#f8f9fa", padding: "5px 10px", border: "1px solid #e5e7eb", borderRadius: 1 }}>
                    <span style={{ fontFamily: SERIF, fontStyle: "italic", letterSpacing: "0.04em" }}>{eq ? eq.display : inner}</span>
                    {eq && <span style={{ fontSize: "7.5pt", color: "#666" }}>({eq.number})</span>}
                  </div>
                );
              }
              return (
                <p key={pi} style={{ margin: "0 0 5px", textAlign: "justify", fontFamily: SERIF, fontSize: `${fs}pt`, lineHeight: lineH, textIndent: "1em" }}>
                  {para.trim()}
                </p>
              );
            })}
            {paper.figures[si] && (
              <figure style={{ breakInside: "avoid", margin: "9px 0", textAlign: "center" }}>
                <div style={{ backgroundColor: paper.figures[si].placeholder, border: "0.5px solid #bbb", padding: "20px 8px", fontSize: "7.5pt", fontFamily: SANS, color: "#555", minHeight: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  [Fig. {paper.figures[si].number} — {paper.figures[si].caption.substring(0, 55)}…]
                </div>
                <figcaption style={{ fontFamily: SANS, fontSize: "7.5pt", color: "#333", marginTop: 4, lineHeight: 1.45, textAlign: "left" }}>
                  <strong>Fig. {paper.figures[si].number}.</strong> {paper.figures[si].caption}
                </figcaption>
              </figure>
            )}
            {paper.tables[si] && (
              <figure style={{ breakInside: "avoid", margin: "9px 0" }}>
                <figcaption style={{ fontFamily: SANS, fontSize: "7.5pt", fontWeight: 700, textAlign: "center", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>
                  Table {paper.tables[si].number} — {paper.tables[si].caption}
                </figcaption>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: SANS, fontSize: "7.5pt" }}>
                  <thead>
                    <tr>{paper.tables[si].headers.map((h, hi) => (
                      <th key={hi} style={{ borderTop: "1px solid #000", borderBottom: "1px solid #000", padding: "2px 4pt", textAlign: "center", fontWeight: 700, fontSize: "7pt" }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {paper.tables[si].rows.map((row, ri) => {
                      const isLast = ri === paper.tables[si].rows.length - 1;
                      const isOurs = row.cells[0].toLowerCase().includes("ours");
                      return (
                        <tr key={ri} style={{ borderBottom: isLast ? "1px solid #000" : "0.5px solid #ddd", backgroundColor: isOurs ? "rgba(0,98,155,0.06)" : "transparent" }}>
                          {row.cells.map((c, ci) => <td key={ci} style={{ padding: "2px 4px", textAlign: ci === 0 ? "left" : "center", fontWeight: isOurs ? 700 : 400 }}>{c}</td>)}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </figure>
            )}
          </div>
        ))}
        {paper.figures.slice(paper.sections.length).map((fig) => (
          <figure key={fig.id} style={{ breakInside: "avoid", margin: "9px 0", textAlign: "center" }}>
            <div style={{ backgroundColor: fig.placeholder, border: "0.5px solid #bbb", padding: "20px 8px", fontSize: "7.5pt", fontFamily: SANS, color: "#555", minHeight: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
              [Fig. {fig.number}]
            </div>
            <figcaption style={{ fontFamily: SANS, fontSize: "7.5pt", color: "#333", marginTop: 4, lineHeight: 1.45, textAlign: "left" }}>
              <strong>Fig. {fig.number}.</strong> {fig.caption}
            </figcaption>
          </figure>
        ))}
      </div>

      {/* ── REFERENCES ── */}
      <div style={{ marginTop: 14, paddingTop: 6, borderTop: "0.5px solid #000" }}>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: "8pt", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6, textAlign: "center" }}>References</div>
        <div style={{ columns: 2, columnGap: "1.6em" }}>
          {paper.references.map((ref, i) => (
            <div key={i} style={{ fontFamily: SANS, fontSize: "7pt", lineHeight: 1.55, marginBottom: 4, textAlign: "justify" }}>{ref}</div>
          ))}
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div style={{ marginTop: 12, paddingTop: 5, borderTop: "0.5px solid #bbb", display: "flex", justifyContent: "space-between", fontFamily: SANS, fontSize: "6.5pt", color: "#888" }}>
        <span>{paper.pages.split("–")[0]}</span>
        <span style={{ fontFamily: MONO }}>{paper.journalAbbrev}, VOL. {paper.volume}, NO. {paper.issue}, {paper.year}</span>
        <span>1</span>
      </div>
    </div>
  );
}

/* ─── section card ─────────────────────────────────────────────────── */
function IEEESectionCard({ sec, onUpdate, onDelete }: {
  sec: IEEESection;
  onUpdate: (s: IEEESection) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 6, border: `1px solid ${BORDER}`, borderRadius: 3, overflow: "hidden" }}>
      <div onClick={() => setOpen((o) => !o)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", backgroundColor: PANEL_BG, cursor: "pointer" }}>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span style={{ flex: 1, fontFamily: SANS, fontSize: "0.75rem", fontWeight: 600 }}>§{sec.number} {sec.title || "(untitled)"}</span>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}><Trash2 size={11} /></button>
      </div>
      {open && (
        <div style={{ padding: "10px 10px 4px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: 8 }}>
            <FieldInput label="§ No." value={sec.number} onChange={(v) => onUpdate({ ...sec, number: v })} />
            <FieldInput label="Heading" value={sec.title} onChange={(v) => onUpdate({ ...sec, title: v })} />
          </div>
          <FieldTextarea label="Body — blank line between paragraphs" value={sec.content} onChange={(v) => onUpdate({ ...sec, content: v })} rows={7} />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   IEEE PAGE
   ═══════════════════════════════════════════════════════════════════════ */
export function IEEEPage() {
  const [paper, setPaper] = useState<IEEEPaperData>(IEEE_DEMO);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const set = (patch: Partial<IEEEPaperData>) => setPaper((p) => ({ ...p, ...patch }));

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const handleUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as Partial<IEEEPaperData>;
        setPaper((p) => ({ ...p, ...parsed }));
        showToast(`Imported "${file.name}"`);
      } catch {
        showToast("Could not parse file", false);
      }
    };
    reader.readAsText(file);
  };

  const exportWord = () => {
    const node = document.getElementById("ieee-preview-root");
    if (!node) return;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:"Times New Roman",serif;font-size:10pt;line-height:1.15;margin:2.5cm}h1{font-size:13pt;text-align:center}h2{font-size:10pt;font-weight:bold;text-transform:uppercase;text-align:center}p{text-align:justify;text-indent:1em;margin-bottom:4pt}table{border-collapse:collapse;width:100%;font-size:8pt}th{border-top:1pt solid #000;border-bottom:1pt solid #000;padding:2pt 4pt;font-weight:bold}td{border-bottom:0.5pt solid #ccc;padding:2pt 4pt}figcaption{font-size:8pt}</style></head><body>${node.innerHTML}</body></html>`;
    const blob = new Blob(["﻿", html], { type: "application/msword" });
    Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "article.doc" }).click();
  };

  const exportXML = () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<article xmlns:xlink="http://www.w3.org/1999/xlink">\n  <front>\n    <journal-meta>\n      <journal-title-group><journal-title>${paper.journal}</journal-title></journal-title-group>\n    </journal-meta>\n    <article-meta>\n      <title-group><article-title>${paper.title}</article-title></title-group>\n      <pub-date pub-type="epub"><year>${paper.year}</year></pub-date>\n      <abstract><p>${paper.abstract}</p></abstract>\n    </article-meta>\n  </front>\n</article>`;
    const blob = new Blob([xml], { type: "application/xml" });
    Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "article.xml" }).click();
  };

  /* ── METADATA TAB ── */
  const metadataPanel = (
    <div>
      <FieldInput label="Title" value={paper.title} onChange={(v) => set({ title: v })} />

      <SectionLabel>Authors</SectionLabel>
      {paper.authors.map((a, i) => (
        <div key={i} style={{ marginBottom: 8, padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 3, backgroundColor: PANEL_BG }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <FieldInput label="Full Name" value={a.name} onChange={(v) => { const authors = [...paper.authors]; authors[i] = { ...a, name: v }; set({ authors }); }} />
            <FieldInput label="IEEE Status" value={a.member || ""} onChange={(v) => { const authors = [...paper.authors]; authors[i] = { ...a, member: v }; set({ authors }); }} placeholder="e.g. Senior Member, IEEE" />
          </div>
          <FieldInput label="Affiliation" value={a.affiliation} onChange={(v) => { const authors = [...paper.authors]; authors[i] = { ...a, affiliation: v }; set({ authors }); }} />
          <FieldInput label="Email" value={a.email || ""} onChange={(v) => { const authors = [...paper.authors]; authors[i] = { ...a, email: v }; set({ authors }); }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: SANS, fontSize: "0.72rem", color: TEXT, cursor: "pointer" }}>
              <input type="checkbox" checked={a.corresponding || false} onChange={(e) => { const authors = [...paper.authors]; authors[i] = { ...a, corresponding: e.target.checked }; set({ authors }); }} />
              Corresponding author
            </label>
            <button onClick={() => set({ authors: paper.authors.filter((_, j) => j !== i) })}
              style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center", gap: 3, fontFamily: SANS, fontSize: "0.7rem" }}>
              <Trash2 size={11} /> Remove
            </button>
          </div>
        </div>
      ))}
      <button onClick={() => set({ authors: [...paper.authors, { name: "", affiliation: "" }] })}
        style={{ fontFamily: SANS, fontSize: "0.72rem", color: "#00629b", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
        <Plus size={12} /> Add Author
      </button>

      <SectionLabel>Publication Details</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <FieldInput label="Volume" value={paper.volume} onChange={(v) => set({ volume: v })} />
        <FieldInput label="Issue" value={paper.issue} onChange={(v) => set({ issue: v })} />
        <FieldInput label="Year" value={paper.year} onChange={(v) => set({ year: v })} />
      </div>
      <FieldInput label="Pages" value={paper.pages} onChange={(v) => set({ pages: v })} />
      <FieldInput label="DOI" value={paper.doi} onChange={(v) => set({ doi: v })} mono />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <FieldInput label="Received" value={paper.received} onChange={(v) => set({ received: v })} />
        <FieldInput label="Accepted" value={paper.accepted} onChange={(v) => set({ accepted: v })} />
        <FieldInput label="Revised" value={paper.revised || ""} onChange={(v) => set({ revised: v })} />
        <FieldInput label="Published" value={paper.published} onChange={(v) => set({ published: v })} />
      </div>
    </div>
  );

  /* ── CONTENT TAB ── */
  const contentPanel = (
    <div>
      <FieldTextarea label="Abstract" value={paper.abstract} onChange={(v) => set({ abstract: v })} rows={6} />
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontFamily: SANS, fontSize: "0.65rem", fontWeight: 700, color: MUTED, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>Index Terms (comma separated)</div>
        <input value={paper.indexTerms.join(", ")} onChange={(e) => set({ indexTerms: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
          style={{ width: "100%", padding: "6px 9px", fontSize: "0.8rem", fontFamily: SANS, border: `1px solid ${BORDER}`, borderRadius: 3, outline: "none" }} />
      </div>

      <SectionLabel>Sections</SectionLabel>
      {paper.sections.map((sec, i) => (
        <IEEESectionCard key={sec.id} sec={sec}
          onUpdate={(s) => { const sections = [...paper.sections]; sections[i] = s; set({ sections }); }}
          onDelete={() => set({ sections: paper.sections.filter((_, j) => j !== i) })}
        />
      ))}
      <button onClick={() => set({ sections: [...paper.sections, { id: `s${Date.now()}`, number: String(paper.sections.length + 1), title: "", content: "" }] })}
        style={{ fontFamily: SANS, fontSize: "0.72rem", display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", border: `1px solid ${BORDER}`, borderRadius: 3, backgroundColor: PANEL_BG, color: TEXT, cursor: "pointer", marginTop: 4 }}>
        <Plus size={12} /> Add Section
      </button>
    </div>
  );

  /* ── FIGURES TAB ── */
  const figuresPanel = (
    <div>
      <SectionLabel>Figures</SectionLabel>
      {paper.figures.map((fig, i) => (
        <div key={fig.id} style={{ marginBottom: 8, padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 3, backgroundColor: PANEL_BG }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontFamily: SANS, fontSize: "0.75rem", fontWeight: 600 }}>Fig. {fig.number}</span>
            <button onClick={() => set({ figures: paper.figures.filter((_, j) => j !== i) })} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}><Trash2 size={11} /></button>
          </div>
          <FieldInput label="Caption" value={fig.caption} onChange={(v) => { const figures = [...paper.figures]; figures[i] = { ...fig, caption: v }; set({ figures }); }} />
          <FieldInput label="Placeholder color" value={fig.placeholder} onChange={(v) => { const figures = [...paper.figures]; figures[i] = { ...fig, placeholder: v }; set({ figures }); }} mono />
        </div>
      ))}
      <button onClick={() => set({ figures: [...paper.figures, { id: `f${Date.now()}`, number: paper.figures.length + 1, caption: "", placeholder: "#e0e7ff" }] })}
        style={{ fontFamily: SANS, fontSize: "0.72rem", display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", border: `1px solid ${BORDER}`, borderRadius: 3, backgroundColor: PANEL_BG, color: TEXT, cursor: "pointer", marginBottom: 16 }}>
        <Plus size={12} /> Add Figure
      </button>

      <SectionLabel>Tables</SectionLabel>
      {paper.tables.map((tbl, i) => (
        <div key={tbl.id} style={{ marginBottom: 8, padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 3, backgroundColor: PANEL_BG }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontFamily: SANS, fontSize: "0.75rem", fontWeight: 600 }}>Table {tbl.number}</span>
            <button onClick={() => set({ tables: paper.tables.filter((_, j) => j !== i) })} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}><Trash2 size={11} /></button>
          </div>
          <FieldInput label="Caption" value={tbl.caption} onChange={(v) => { const tables = [...paper.tables]; tables[i] = { ...tbl, caption: v }; set({ tables }); }} />
          <FieldInput label="Column headers (comma-separated)" value={tbl.headers.join(", ")} onChange={(v) => { const tables = [...paper.tables]; tables[i] = { ...tbl, headers: v.split(",").map((s) => s.trim()) }; set({ tables }); }} />
        </div>
      ))}
      <button onClick={() => set({ tables: [...paper.tables, { id: `t${Date.now()}`, number: paper.tables.length + 1, caption: "", headers: ["Column 1", "Column 2"], rows: [{ cells: ["", ""] }] }] })}
        style={{ fontFamily: SANS, fontSize: "0.72rem", display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", border: `1px solid ${BORDER}`, borderRadius: 3, backgroundColor: PANEL_BG, color: TEXT, cursor: "pointer" }}>
        <Plus size={12} /> Add Table
      </button>
    </div>
  );

  /* ── REFERENCES TAB ── */
  const referencesPanel = (
    <div>
      <p style={{ fontFamily: SANS, fontSize: "0.72rem", color: MUTED, marginBottom: 8, lineHeight: 1.5 }}>One reference per line. IEEE format recommended.</p>
      <FieldTextarea label="References" value={paper.references.join("\n")} onChange={(v) => set({ references: v.split("\n").map((s) => s.trim()).filter(Boolean) })} rows={22} />
    </div>
  );

  /* ── LAYOUT TAB ── */
  const layoutTabPanel = (
    <div>
      <SectionLabel>Typography</SectionLabel>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: SANS, fontSize: "0.72rem", color: TEXT, marginBottom: 6 }}>Font Size: <span style={{ fontFamily: MONO, fontSize: "0.7rem", color: MUTED }}>{paper.fontSize}pt</span></div>
        <input type="range" min={8} max={13} step={0.5} value={paper.fontSize} onChange={(e) => set({ fontSize: Number(e.target.value) })} style={{ width: "100%", accentColor: "#00629b" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: "0.62rem", color: "#9ca3af", marginTop: 2 }}><span>8pt</span><span>13pt</span></div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: SANS, fontSize: "0.72rem", color: TEXT, marginBottom: 6 }}>Line Spacing: <span style={{ fontFamily: MONO, fontSize: "0.7rem", color: MUTED }}>{paper.lineSpacing.toFixed(2)}</span></div>
        <input type="range" min={1} max={2} step={0.05} value={paper.lineSpacing} onChange={(e) => set({ lineSpacing: Number(e.target.value) })} style={{ width: "100%", accentColor: "#00629b" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: "0.62rem", color: "#9ca3af", marginTop: 2 }}><span>1.0</span><span>2.0</span></div>
      </div>

      <SectionLabel>Margins</SectionLabel>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {(["narrow", "normal", "wide"] as const).map((m) => (
          <button key={m} onClick={() => set({ marginSize: m })}
            style={{ flex: 1, padding: "5px 6px", fontSize: "0.7rem", fontFamily: SANS, fontWeight: paper.marginSize === m ? 700 : 400, border: `1px solid ${paper.marginSize === m ? "#00629b" : BORDER}`, borderRadius: 3, backgroundColor: paper.marginSize === m ? "rgba(0,98,155,0.07)" : PANEL_BG, color: paper.marginSize === m ? "#00629b" : TEXT, cursor: "pointer" }}>
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      <SectionLabel>Citation Style</SectionLabel>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {(["IEEE", "APA", "Vancouver"] as const).map((cs) => (
          <button key={cs} onClick={() => set({ citationStyle: cs })}
            style={{ flex: 1, padding: "5px 6px", fontSize: "0.7rem", fontFamily: MONO, fontWeight: paper.citationStyle === cs ? 700 : 400, border: `1px solid ${paper.citationStyle === cs ? "#00629b" : BORDER}`, borderRadius: 3, backgroundColor: paper.citationStyle === cs ? "rgba(0,98,155,0.07)" : PANEL_BG, color: paper.citationStyle === cs ? "#00629b" : TEXT, cursor: "pointer" }}>
            {cs}
          </button>
        ))}
      </div>

      <SectionLabel>Formula Rendering</SectionLabel>
      <div style={{ padding: "10px 12px", backgroundColor: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 3 }}>
        <div style={{ fontFamily: SANS, fontSize: "0.7rem", fontWeight: 600, color: TEXT, marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
          <FunctionSquare size={12} /> Equations ({paper.equations.length} registered)
        </div>
        {paper.equations.map((eq) => (
          <div key={eq.id} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderTop: `1px solid ${BORDER}`, fontFamily: SANS, fontSize: "0.68rem" }}>
            <span style={{ fontFamily: SERIF, fontStyle: "italic", color: TEXT }}>{eq.display}</span>
            <span style={{ color: MUTED }}>Eq. ({eq.number})</span>
          </div>
        ))}
      </div>
    </div>
  );

  /* ── EXPORT TAB ── */
  const exportTabPanel = (
    <ExportPanel
      accentColor="#00629b"
      onPDF={() => window.print()}
      onWord={exportWord}
      onXML={exportXML}
      onDocx={exportWord}
      summary={[
        { label: "Sections", value: paper.sections.length },
        { label: "Figures", value: paper.figures.length },
        { label: "Tables", value: paper.tables.length },
        { label: "Equations", value: paper.equations.length },
        { label: "References", value: paper.references.length },
        { label: "Authors", value: paper.authors.length },
      ]}
    />
  );

  /* ── RIGHT PANEL SECTIONS (standardised order) ── */
  const acRight = "#00629b";

  const rpLayout = (
    <div>
      <ChoiceRow label="Columns"
        options={[{ value: "2", label: "2 Columns (IEEE)" }, { value: "1", label: "1 Column" }]}
        value="2"
        onChange={() => {}}
      />
      <ChoiceRow label="Margins"
        options={[{ value: "narrow", label: "Narrow" }, { value: "normal", label: "Normal" }, { value: "wide", label: "Wide" }]}
        value={paper.marginSize}
        onChange={(v) => set({ marginSize: v as typeof paper.marginSize })}
      />
      <ChoiceRow label="Page size"
        options={[{ value: "letter", label: "US Letter" }, { value: "a4", label: "A4" }]}
        value="letter"
        onChange={() => {}}
      />
    </div>
  );

  const rpTypography = (
    <div>
      <ChoiceRow label="Font family"
        options={[{ value: "times", label: "Times New Roman" }, { value: "helvetica", label: "Helvetica" }]}
        value="times"
        onChange={() => {}}
      />
      <SliderField label="Font size" value={paper.fontSize} min={8} max={13} step={0.5} unit="pt" onChange={(v) => set({ fontSize: v })} />
      <SliderField label="Line spacing" value={paper.lineSpacing} min={1} max={2} step={0.05} onChange={(v) => set({ lineSpacing: v })} />
    </div>
  );

  const rpContentStyle = (
    <div>
      <ChoiceRow label="Citation style"
        options={[{ value: "IEEE", label: "IEEE" }, { value: "APA", label: "APA" }, { value: "Vancouver", label: "Vancouver" }]}
        value={paper.citationStyle}
        onChange={(v) => set({ citationStyle: v as typeof paper.citationStyle })}
      />
      <ChoiceRow label="Heading style"
        options={[{ value: "roman", label: "Uppercase Roman" }, { value: "title", label: "Title Case" }]}
        value="roman"
        onChange={() => {}}
      />
    </div>
  );

  const rpFiguresTables = (
    <div>
      <ChoiceRow label="Figure position"
        options={[{ value: "inline", label: "Inline" }, { value: "top", label: "Top of col." }, { value: "bottom", label: "Bottom" }]}
        value="inline"
        onChange={() => {}}
      />
      <ChoiceRow label="Table position"
        options={[{ value: "inline", label: "Inline" }, { value: "top", label: "Top of col." }, { value: "bottom", label: "Bottom" }]}
        value="inline"
        onChange={() => {}}
      />
      <ChoiceRow label="Caption style"
        options={[{ value: "below", label: "Below item" }, { value: "above", label: "Above item" }]}
        value="below"
        onChange={() => {}}
      />
    </div>
  );

  const rpExport = (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <button onClick={() => window.print()}
        style={{ width: "100%", padding: "7px 10px", fontFamily: SANS, fontWeight: 700, fontSize: "0.75rem", backgroundColor: acRight, color: "#fff", border: "none", borderRadius: 3, cursor: "pointer" }}>
        Generate PDF
      </button>
      <button onClick={() => window.print()}
        style={{ width: "100%", padding: "7px 10px", fontFamily: SANS, fontWeight: 600, fontSize: "0.75rem", backgroundColor: "#fff", color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 3, cursor: "pointer" }}>
        Download PDF
      </button>
      <button onClick={exportWord}
        style={{ width: "100%", padding: "7px 10px", fontFamily: SANS, fontWeight: 600, fontSize: "0.75rem", backgroundColor: "#fff", color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 3, cursor: "pointer" }}>
        Export DOCX
      </button>
      <button onClick={exportXML}
        style={{ width: "100%", padding: "7px 10px", fontFamily: SANS, fontWeight: 600, fontSize: "0.75rem", backgroundColor: "#fff", color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 3, cursor: "pointer" }}>
        Export XML
      </button>
    </div>
  );

  const rpDocumentInfo = (
    <div style={{ fontFamily: SANS, fontSize: "0.7rem", color: MUTED, lineHeight: 1.75 }}>
      {[
        { label: "Journal", value: paper.journal },
        { label: "Publisher", value: "IEEE" },
        { label: "ISSN", value: "2162-237X", mono: true },
        { label: "Volume", value: `${paper.volume}, No. ${paper.issue}` },
        { label: "Pages", value: paper.pages },
        { label: "DOI", value: paper.doi, mono: true, wrap: true },
      ].map(({ label, value, mono, wrap }, i, arr) => (
        <div key={label} style={{ display: wrap ? "block" : "flex", justifyContent: "space-between", borderBottom: i < arr.length - 1 ? `1px solid ${BORDER}` : "none", paddingBottom: 4, marginBottom: 4 }}>
          <span>{label}</span>
          <span style={{ color: TEXT, fontWeight: mono ? 400 : 600, fontFamily: mono ? MONO : SANS, fontSize: mono ? "0.62rem" : "0.7rem", wordBreak: wrap ? "break-all" : "normal", marginTop: wrap ? 2 : 0, display: wrap ? "block" : "inline" }}>{value}</span>
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 9999, display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 4, backgroundColor: toast.ok ? "#166534" : "#991b1b", color: "#fff", fontFamily: SANS, fontSize: "0.82rem", boxShadow: "0 4px 12px rgba(0,0,0,0.25)" }}>
          {toast.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {toast.msg}
        </div>
      )}

      <JournalEditorShell
        journal={{
          name: "IEEE Transactions on Neural Networks and Learning Systems",
          abbrev: "IEEE TRANS. NEURAL NETW. LEARN. SYST.",
          publisher: "IEEE",
          accentColor: "#00629b",
          type: "ieee",
        }}
        actions={{
          onExportPDF: () => window.print(),
          onExportWord: exportWord,
          onXML: exportXML,
          onUpload: handleUpload,
        }}
        tabContent={{
          metadata: metadataPanel,
          content: contentPanel,
          figures: figuresPanel,
          references: referencesPanel,
          layout: layoutTabPanel,
          export: exportTabPanel,
        }}
        preview={<IEEEPreview paper={paper} />}
        rightPanelSections={{
          layout:        rpLayout,
          typography:    rpTypography,
          contentStyle:  rpContentStyle,
          figuresTables: rpFiguresTables,
          export:        rpExport,
          documentInfo:  rpDocumentInfo,
        }}
      />
    </>
  );
}
