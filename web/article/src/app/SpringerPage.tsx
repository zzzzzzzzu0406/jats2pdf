import React, { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { SPRINGER_DEMO, type SpringerPaperData, type SpringerSection } from "./demoSpringer";
import {
  JournalEditorShell, SERIF, SANS, MONO, MUTED, BORDER, TEXT, PANEL_BG,
  FieldInput, FieldTextarea, SectionLabel, SliderField, ChoiceRow, ExportPanel,
} from "./shell/JournalEditorShell";

/* ═══════════════════════════════════════════════════════════════════════
   SPRINGER PAPER PREVIEW
   ═══════════════════════════════════════════════════════════════════════ */
const SPRINGER_BLUE = "#1565c0";
const SPRINGER_BLUE_LIGHT = "#e3f2fd";

function SpringerPreview({ paper, fontSize, lineSpacing }: {
  paper: SpringerPaperData;
  fontSize: number;
  lineSpacing: number;
}) {
  return (
    <div id="springer-preview-root" style={{ fontFamily: SERIF, fontSize: `${fontSize}pt`, lineHeight: lineSpacing, color: "#111", backgroundColor: "#fff", padding: "40px 52px 48px" }}>

      {/* ── TOP RULE + JOURNAL IDENTITY ── */}
      <div style={{ borderTop: `3px solid ${SPRINGER_BLUE}`, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingTop: 6 }}>
          <div>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: "8.5pt", color: SPRINGER_BLUE, letterSpacing: "0.02em", marginBottom: 1 }}>
              {paper.journal}
            </div>
            <div style={{ fontFamily: SANS, fontSize: "7.5pt", color: "#666" }}>
              {paper.publisher} · ISSN {paper.issn}
            </div>
          </div>
          <div style={{ textAlign: "right", fontFamily: MONO, fontSize: "7pt", color: "#888", lineHeight: 1.6 }}>
            <div>{paper.journalAbbrev} {paper.volume}, {paper.pages} ({paper.year})</div>
            <div>https://doi.org/{paper.doi}</div>
          </div>
        </div>
      </div>

      {/* ── ARTICLE TYPE BADGE ── */}
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontFamily: SANS, fontSize: "7.5pt", fontWeight: 700, color: SPRINGER_BLUE, textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: `1.5px solid ${SPRINGER_BLUE}`, paddingBottom: 1 }}>
          {paper.articleType}
        </span>
      </div>

      {/* ── RECEIVED / ACCEPTED DATES ── */}
      <div style={{ fontFamily: SANS, fontSize: "7.5pt", color: "#666", marginBottom: 12, display: "flex", gap: 18 }}>
        <span>Received: {paper.received}</span>
        {paper.revised && <span>Revised: {paper.revised}</span>}
        <span>Accepted: {paper.accepted}</span>
        <span>Published online: {paper.published}</span>
      </div>

      {/* ── TITLE ── */}
      <h1 style={{ fontFamily: SERIF, fontWeight: 700, fontSize: `${fontSize + 5}pt`, lineHeight: 1.2, margin: "0 0 14px", color: "#000" }}>
        {paper.title}
      </h1>

      {/* ── AUTHORS ── */}
      <div style={{ fontFamily: SANS, fontSize: "9pt", lineHeight: 1.9, marginBottom: 6, color: "#111" }}>
        {paper.authors.map((a, i) => (
          <span key={i}>
            <span style={{ fontWeight: 500 }}>{a.name}</span>
            {a.affKeys.map((k) => (
              <sup key={k} style={{ fontSize: "6.5pt", color: SPRINGER_BLUE }}>{k}</sup>
            ))}
            {a.corresponding && <sup style={{ fontSize: "6.5pt", color: SPRINGER_BLUE }}>✉</sup>}
            {i < paper.authors.length - 1 && <span style={{ color: "#888", margin: "0 3px" }}>·</span>}
          </span>
        ))}
      </div>

      {/* ── AFFILIATIONS ── */}
      <div style={{ fontFamily: SANS, fontSize: "7.5pt", color: "#555", lineHeight: 1.65, marginBottom: 8, fontStyle: "italic" }}>
        {paper.affiliations.map((aff) => (
          <div key={aff.key}>
            <sup style={{ fontSize: "6pt", fontStyle: "normal" }}>{aff.key}</sup> {aff.text}
          </div>
        ))}
      </div>

      {/* ── CORRESPONDENCE LINE ── */}
      {paper.authors.filter((a) => a.corresponding).map((a) => (
        <div key={a.name} style={{ fontFamily: SANS, fontSize: "7.5pt", color: "#444", marginBottom: 16, borderTop: "0.5px solid #ddd", borderBottom: "0.5px solid #ddd", padding: "5px 0" }}>
          <span style={{ fontWeight: 600 }}>Correspondence:</span> {a.name}{a.email ? ` (${a.email})` : ""}
        </div>
      ))}

      {/* ── ABSTRACT BOX ── */}
      <div style={{ marginBottom: 14, padding: "10px 14px", backgroundColor: SPRINGER_BLUE_LIGHT, borderLeft: `3px solid ${SPRINGER_BLUE}` }}>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: "8pt", color: SPRINGER_BLUE, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Abstract
        </div>
        <p style={{ margin: "0 0 8px", fontFamily: SERIF, fontSize: `${fontSize}pt`, textAlign: "justify", lineHeight: lineSpacing }}>
          {paper.abstract}
        </p>
        <div style={{ fontFamily: SANS, fontSize: "7.5pt", color: "#444", marginTop: 6 }}>
          <span style={{ fontWeight: 700 }}>Keywords: </span>
          {paper.keywords.map((k, i) => (
            <span key={i}>
              <span style={{ fontStyle: "italic" }}>{k}</span>
              {i < paper.keywords.length - 1 && <span style={{ margin: "0 4px", color: "#888" }}>·</span>}
            </span>
          ))}
        </div>
      </div>

      {/* ── DIVIDER ── */}
      <div style={{ borderTop: "1px solid #bbb", marginBottom: 14 }} />

      {/* ── BODY SECTIONS (single column) ── */}
      {paper.sections.map((sec, si) => (
        <div key={sec.id} style={{ marginBottom: "1em" }}>
          <h2 style={{ fontFamily: SANS, fontWeight: 700, fontSize: `${fontSize + 0.5}pt`, color: "#111", margin: "16px 0 6px" }}>
            {sec.number} {sec.title}
          </h2>
          {sec.content.split("\n\n").filter(Boolean).map((para, pi) => (
            <p key={pi} style={{ margin: "0 0 7px", textAlign: "justify", fontFamily: SERIF, fontSize: `${fontSize}pt`, lineHeight: lineSpacing }}>
              {para.trim()}
            </p>
          ))}
          {paper.figures[si] && (
            <figure style={{ margin: "14px 0", textAlign: "center" }}>
              <div style={{ backgroundColor: paper.figures[si].placeholder, border: "1px solid #ddd", padding: "24px 16px", fontSize: "8pt", fontFamily: SANS, color: "#666", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 96 }}>
                [Fig. {paper.figures[si].number}]
              </div>
              <figcaption style={{ fontFamily: SANS, fontSize: "8pt", color: "#444", marginTop: 6, lineHeight: 1.5, textAlign: "left" }}>
                <strong style={{ color: "#000" }}>Fig. {paper.figures[si].number}</strong> {paper.figures[si].caption}
              </figcaption>
            </figure>
          )}
          {paper.tables[si] && (
            <figure style={{ margin: "14px 0" }}>
              <figcaption style={{ fontFamily: SANS, fontSize: "8pt", color: "#000", fontWeight: 700, marginBottom: 5 }}>
                Table {paper.tables[si].number} <span style={{ fontWeight: 400, color: "#444" }}>{paper.tables[si].caption}</span>
              </figcaption>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: SANS, fontSize: "8pt" }}>
                <thead>
                  <tr>
                    {paper.tables[si].headers.map((h, hi) => (
                      <th key={hi} style={{ borderTop: "1.5px solid #000", borderBottom: "1px solid #999", padding: "3px 8px", textAlign: hi === 0 ? "left" : "center", fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paper.tables[si].rows.map((row, ri) => {
                    const isLast = ri === paper.tables[si].rows.length - 1;
                    const isOurs = row.cells[0].toLowerCase().includes("ours");
                    return (
                      <tr key={ri} style={{ borderBottom: isLast ? "1.5px solid #000" : "0.5px solid #ddd", backgroundColor: isOurs ? `rgba(21,101,192,0.05)` : "transparent" }}>
                        {row.cells.map((c, ci) => (
                          <td key={ci} style={{ padding: "3px 8px", textAlign: ci === 0 ? "left" : "center", fontWeight: isOurs ? 700 : 400, color: isOurs && ci === 0 ? SPRINGER_BLUE : "#222" }}>{c}</td>
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

      {/* remaining figures */}
      {paper.figures.slice(paper.sections.length).map((fig) => (
        <figure key={fig.id} style={{ margin: "14px 0", textAlign: "center" }}>
          <div style={{ backgroundColor: fig.placeholder, border: "1px solid #ddd", padding: "24px 16px", fontSize: "8pt", fontFamily: SANS, color: "#666", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 96 }}>[Fig. {fig.number}]</div>
          <figcaption style={{ fontFamily: SANS, fontSize: "8pt", color: "#444", marginTop: 6, lineHeight: 1.5, textAlign: "left" }}>
            <strong style={{ color: "#000" }}>Fig. {fig.number}</strong> {fig.caption}
          </figcaption>
        </figure>
      ))}

      {/* ── REFERENCES ── */}
      <div style={{ marginTop: 20, paddingTop: 10, borderTop: "2px solid #000" }}>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: "9pt", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          References
        </div>
        <ol style={{ margin: 0, paddingLeft: 20, fontFamily: SANS, fontSize: "8pt", lineHeight: 1.65, color: "#333", listStyleType: "decimal" }}>
          {paper.references.map((ref, i) => (
            <li key={i} style={{ marginBottom: 4 }}>{ref}</li>
          ))}
        </ol>
      </div>

      {/* ── FOOTER ── */}
      <div style={{ marginTop: 16, paddingTop: 5, borderTop: "0.5px solid #ddd", display: "flex", justifyContent: "space-between", fontFamily: SANS, fontSize: "6.5pt", color: "#aaa" }}>
        <span>© {paper.year} The Author(s), under exclusive licence to Springer Nature</span>
        <span>{paper.journalAbbrev} {paper.volume}, {paper.pages} ({paper.year})</span>
      </div>
    </div>
  );
}

/* ─── section card ─────────────────────────────────────────────────── */
function SpringerSectionCard({ sec, onUpdate, onDelete }: {
  sec: SpringerSection;
  onUpdate: (s: SpringerSection) => void;
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
          <div style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: 8 }}>
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
   SPRINGER PAGE
   ═══════════════════════════════════════════════════════════════════════ */
export function SpringerPage() {
  const [paper, setPaper] = useState<SpringerPaperData>(SPRINGER_DEMO);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [fontSize, setFontSize] = useState(SPRINGER_DEMO.fontSize);
  const [lineSpacing, setLineSpacing] = useState(SPRINGER_DEMO.lineSpacing);

  const set = (patch: Partial<SpringerPaperData>) => setPaper((p) => ({ ...p, ...patch }));

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const handleUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as Partial<SpringerPaperData>;
        setPaper((p) => ({ ...p, ...parsed }));
        showToast(`Imported "${file.name}"`);
      } catch {
        showToast("Could not parse file", false);
      }
    };
    reader.readAsText(file);
  };

  const exportWord = () => {
    const node = document.getElementById("springer-preview-root");
    if (!node) return;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:"Times New Roman",serif;font-size:${fontSize}pt;line-height:${lineSpacing};margin:2.5cm}h1{font-size:${fontSize + 5}pt;font-weight:bold}h2{font-size:${fontSize + 0.5}pt;font-weight:bold}p{text-align:justify;margin-bottom:6pt}table{border-collapse:collapse;width:100%;font-size:8pt}th{border-top:1.5pt solid #000;border-bottom:1pt solid #999;padding:3pt 8pt;font-weight:bold}td{border-bottom:0.5pt solid #ddd;padding:3pt 8pt}figcaption{font-size:8pt}</style></head><body>${node.innerHTML}</body></html>`;
    const blob = new Blob(["﻿", html], { type: "application/msword" });
    Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "springer-article.doc" }).click();
  };

  const exportXML = () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<article xmlns:xlink="http://www.w3.org/1999/xlink" article-type="${paper.articleType.toLowerCase().replace(" ", "-")}">\n  <front>\n    <journal-meta>\n      <journal-title-group><journal-title>${paper.journal}</journal-title><abbrev-journal-title abbrev-type="publisher">${paper.journalAbbrev}</abbrev-journal-title></journal-title-group>\n      <issn pub-type="ppub">${paper.issn}</issn>\n      <publisher><publisher-name>${paper.publisher}</publisher-name></publisher>\n    </journal-meta>\n    <article-meta>\n      <title-group><article-title>${paper.title}</article-title></title-group>\n      <pub-date pub-type="epub"><year>${paper.year}</year></pub-date>\n      <volume>${paper.volume}</volume>\n      <issue>${paper.issue}</issue>\n      <fpage>${paper.pages.split("–")[0]}</fpage>\n      <lpage>${paper.pages.split("–")[1] ?? paper.pages}</lpage>\n      <abstract><p>${paper.abstract}</p></abstract>\n      <kwd-group>${paper.keywords.map((k) => `<kwd>${k}</kwd>`).join("")}</kwd-group>\n    </article-meta>\n  </front>\n</article>`;
    const blob = new Blob([xml], { type: "application/xml" });
    Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "springer-article.xml" }).click();
  };

  /* ── METADATA TAB ── */
  const metadataPanel = (
    <div>
      <FieldInput label="Title" value={paper.title} onChange={(v) => set({ title: v })} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <FieldInput label="Article Type" value={paper.articleType} onChange={(v) => set({ articleType: v })} />
        <FieldInput label="Journal Abbrev." value={paper.journalAbbrev} onChange={(v) => set({ journalAbbrev: v })} mono />
      </div>

      <SectionLabel>Authors</SectionLabel>
      {paper.authors.map((a, i) => (
        <div key={i} style={{ marginBottom: 8, padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 3, backgroundColor: PANEL_BG }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 8 }}>
            <FieldInput label="Full Name" value={a.name} onChange={(v) => { const authors = [...paper.authors]; authors[i] = { ...a, name: v }; set({ authors }); }} />
            <FieldInput label="Aff. Keys" value={a.affKeys.join(",")} onChange={(v) => { const authors = [...paper.authors]; authors[i] = { ...a, affKeys: v.split(",").map((s) => s.trim()) }; set({ authors }); }} mono />
          </div>
          <FieldInput label="Email" value={a.email || ""} onChange={(v) => { const authors = [...paper.authors]; authors[i] = { ...a, email: v }; set({ authors }); }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: SANS, fontSize: "0.72rem", color: TEXT, cursor: "pointer" }}>
              <input type="checkbox" checked={a.corresponding || false} onChange={(e) => { const authors = [...paper.authors]; authors[i] = { ...a, corresponding: e.target.checked }; set({ authors }); }} />
              Corresponding
            </label>
            <button onClick={() => set({ authors: paper.authors.filter((_, j) => j !== i) })}
              style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center", gap: 3, fontFamily: SANS, fontSize: "0.7rem" }}>
              <Trash2 size={11} /> Remove
            </button>
          </div>
        </div>
      ))}
      <button onClick={() => set({ authors: [...paper.authors, { name: "", affKeys: ["1"] }] })}
        style={{ fontFamily: SANS, fontSize: "0.72rem", color: SPRINGER_BLUE, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
        <Plus size={12} /> Add Author
      </button>

      <SectionLabel>Affiliations</SectionLabel>
      {paper.affiliations.map((aff, i) => (
        <div key={i} style={{ marginBottom: 6, display: "grid", gridTemplateColumns: "40px 1fr", gap: 8, alignItems: "start" }}>
          <FieldInput label="Key" value={aff.key} onChange={(v) => { const affiliations = [...paper.affiliations]; affiliations[i] = { ...aff, key: v }; set({ affiliations }); }} mono />
          <FieldInput label="Full affiliation text" value={aff.text} onChange={(v) => { const affiliations = [...paper.affiliations]; affiliations[i] = { ...aff, text: v }; set({ affiliations }); }} />
        </div>
      ))}
      <button onClick={() => set({ affiliations: [...paper.affiliations, { key: String(paper.affiliations.length + 1), text: "" }] })}
        style={{ fontFamily: SANS, fontSize: "0.72rem", color: SPRINGER_BLUE, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
        <Plus size={12} /> Add Affiliation
      </button>

      <SectionLabel>Publication Details</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <FieldInput label="Volume" value={paper.volume} onChange={(v) => set({ volume: v })} />
        <FieldInput label="Issue" value={paper.issue} onChange={(v) => set({ issue: v })} />
        <FieldInput label="Year" value={paper.year} onChange={(v) => set({ year: v })} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <FieldInput label="Pages" value={paper.pages} onChange={(v) => set({ pages: v })} mono />
        <FieldInput label="ISSN" value={paper.issn} onChange={(v) => set({ issn: v })} mono />
      </div>
      <FieldInput label="DOI" value={paper.doi} onChange={(v) => set({ doi: v })} mono />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <FieldInput label="Received" value={paper.received} onChange={(v) => set({ received: v })} />
        <FieldInput label="Accepted" value={paper.accepted} onChange={(v) => set({ accepted: v })} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <FieldInput label="Revised" value={paper.revised || ""} onChange={(v) => set({ revised: v })} />
        <FieldInput label="Published online" value={paper.published} onChange={(v) => set({ published: v })} />
      </div>
    </div>
  );

  /* ── CONTENT TAB ── */
  const contentPanel = (
    <div>
      <FieldTextarea label="Abstract" value={paper.abstract} onChange={(v) => set({ abstract: v })} rows={6} />
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontFamily: SANS, fontSize: "0.65rem", fontWeight: 700, color: MUTED, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>Keywords (comma separated)</div>
        <input value={paper.keywords.join(", ")} onChange={(e) => set({ keywords: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
          style={{ width: "100%", padding: "6px 9px", fontSize: "0.8rem", fontFamily: SANS, border: `1px solid ${BORDER}`, borderRadius: 3, outline: "none" }} />
      </div>

      <SectionLabel>Sections</SectionLabel>
      {paper.sections.map((sec, i) => (
        <SpringerSectionCard key={sec.id} sec={sec}
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
          <FieldTextarea label="Caption" value={fig.caption} onChange={(v) => { const figures = [...paper.figures]; figures[i] = { ...fig, caption: v }; set({ figures }); }} rows={3} />
        </div>
      ))}
      <button onClick={() => set({ figures: [...paper.figures, { id: `f${Date.now()}`, number: paper.figures.length + 1, caption: "", placeholder: "#e3f2fd" }] })}
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
      <p style={{ fontFamily: SANS, fontSize: "0.72rem", color: MUTED, marginBottom: 8, lineHeight: 1.5 }}>One reference per line. Springer author-date format recommended.</p>
      <FieldTextarea label="References" value={paper.references.join("\n")} onChange={(v) => set({ references: v.split("\n").map((s) => s.trim()).filter(Boolean) })} rows={22} />
    </div>
  );

  /* ── LAYOUT TAB ── */
  const layoutTabPanel = (
    <div>
      <SectionLabel>Typography</SectionLabel>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: SANS, fontSize: "0.72rem", color: TEXT, marginBottom: 6 }}>Font Size: <span style={{ fontFamily: MONO, fontSize: "0.7rem", color: MUTED }}>{fontSize}pt</span></div>
        <input type="range" min={8} max={13} step={0.5} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} style={{ width: "100%", accentColor: SPRINGER_BLUE }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: "0.62rem", color: "#9ca3af", marginTop: 2 }}><span>8pt</span><span>13pt</span></div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: SANS, fontSize: "0.72rem", color: TEXT, marginBottom: 6 }}>Line Spacing: <span style={{ fontFamily: MONO, fontSize: "0.7rem", color: MUTED }}>{lineSpacing.toFixed(2)}</span></div>
        <input type="range" min={1} max={2} step={0.05} value={lineSpacing} onChange={(e) => setLineSpacing(Number(e.target.value))} style={{ width: "100%", accentColor: SPRINGER_BLUE }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: "0.62rem", color: "#9ca3af", marginTop: 2 }}><span>1.0</span><span>2.0</span></div>
      </div>

      <SectionLabel>Citation Style</SectionLabel>
      <div style={{ display: "flex", gap: 6 }}>
        {(["Springer", "APA", "Vancouver"] as const).map((cs) => (
          <button key={cs} onClick={() => set({ citationStyle: cs })}
            style={{ flex: 1, padding: "5px 6px", fontSize: "0.7rem", fontFamily: MONO, fontWeight: paper.citationStyle === cs ? 700 : 400, border: `1px solid ${paper.citationStyle === cs ? SPRINGER_BLUE : BORDER}`, borderRadius: 3, backgroundColor: paper.citationStyle === cs ? "rgba(21,101,192,0.07)" : PANEL_BG, color: paper.citationStyle === cs ? SPRINGER_BLUE : TEXT, cursor: "pointer" }}>
            {cs}
          </button>
        ))}
      </div>
    </div>
  );

  /* ── EXPORT TAB ── */
  const exportTabPanel = (
    <ExportPanel
      accentColor={SPRINGER_BLUE}
      onPDF={() => window.print()}
      onWord={exportWord}
      onXML={exportXML}
      onDocx={exportWord}
      summary={[
        { label: "Sections", value: paper.sections.length },
        { label: "Figures", value: paper.figures.length },
        { label: "Tables", value: paper.tables.length },
        { label: "References", value: paper.references.length },
        { label: "Authors", value: paper.authors.length },
      ]}
    />
  );

  /* ── RIGHT PANEL SECTIONS ── */
  const acRight = SPRINGER_BLUE;

  const rpLayout = (
    <div>
      <ChoiceRow label="Columns"
        options={[{ value: "1", label: "1 Column (Springer)" }, { value: "2", label: "2 Columns" }]}
        value="1"
        onChange={() => {}}
      />
      <ChoiceRow label="Margins"
        options={[{ value: "narrow", label: "Narrow" }, { value: "normal", label: "Normal" }, { value: "wide", label: "Wide" }]}
        value="normal"
        onChange={() => {}}
      />
      <ChoiceRow label="Page size"
        options={[{ value: "a4", label: "A4" }, { value: "letter", label: "Letter" }]}
        value="a4"
        onChange={() => {}}
      />
    </div>
  );

  const rpTypography = (
    <div>
      <ChoiceRow label="Font family"
        options={[{ value: "times", label: "Times New Roman" }, { value: "minion", label: "Minion Pro" }, { value: "charter", label: "Charter" }]}
        value="times"
        onChange={() => {}}
      />
      <SliderField label="Font size" value={fontSize} min={8} max={13} step={0.5} unit="pt" onChange={setFontSize} />
      <SliderField label="Line spacing" value={lineSpacing} min={1} max={2} step={0.05} onChange={setLineSpacing} />
    </div>
  );

  const rpContentStyle = (
    <div>
      <ChoiceRow label="Citation style"
        options={[{ value: "Springer", label: "Springer" }, { value: "APA", label: "APA" }, { value: "Vancouver", label: "Vancouver" }]}
        value={paper.citationStyle}
        onChange={(v) => set({ citationStyle: v as typeof paper.citationStyle })}
      />
      <ChoiceRow label="Heading style"
        options={[{ value: "bold", label: "Bold" }, { value: "italic", label: "Italic Bold" }]}
        value="bold"
        onChange={() => {}}
      />
    </div>
  );

  const rpFiguresTables = (
    <div>
      <ChoiceRow label="Figure position"
        options={[{ value: "inline", label: "Inline" }, { value: "top", label: "Top of page" }, { value: "bottom", label: "Bottom" }]}
        value="inline"
        onChange={() => {}}
      />
      <ChoiceRow label="Table position"
        options={[{ value: "inline", label: "Inline" }, { value: "top", label: "Top of page" }, { value: "bottom", label: "Bottom" }]}
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
      <button onClick={() => window.print()} style={{ width: "100%", padding: "7px 10px", fontFamily: SANS, fontWeight: 700, fontSize: "0.75rem", backgroundColor: acRight, color: "#fff", border: "none", borderRadius: 3, cursor: "pointer" }}>
        Generate PDF
      </button>
      <button onClick={() => window.print()} style={{ width: "100%", padding: "7px 10px", fontFamily: SANS, fontWeight: 600, fontSize: "0.75rem", backgroundColor: "#fff", color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 3, cursor: "pointer" }}>
        Download PDF
      </button>
      <button onClick={exportWord} style={{ width: "100%", padding: "7px 10px", fontFamily: SANS, fontWeight: 600, fontSize: "0.75rem", backgroundColor: "#fff", color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 3, cursor: "pointer" }}>
        Export DOCX
      </button>
      <button onClick={exportXML} style={{ width: "100%", padding: "7px 10px", fontFamily: SANS, fontWeight: 600, fontSize: "0.75rem", backgroundColor: "#fff", color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 3, cursor: "pointer" }}>
        Export XML
      </button>
    </div>
  );

  const rpDocumentInfo = (
    <div style={{ fontFamily: SANS, fontSize: "0.7rem", color: MUTED, lineHeight: 1.75 }}>
      {[
        { label: "Journal", value: paper.journal },
        { label: "Publisher", value: paper.publisher },
        { label: "ISSN", value: paper.issn, mono: true },
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
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 9999, display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 4, backgroundColor: toast.ok ? "#166534" : "#991b1b", color: "#fff", fontFamily: SANS, fontSize: "0.82rem", boxShadow: "0 4px 12px rgba(0,0,0,0.25)" }}>
          {toast.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {toast.msg}
        </div>
      )}

      <JournalEditorShell
        journal={{ name: "Machine Learning", abbrev: "Mach Learn", publisher: "Springer", accentColor: SPRINGER_BLUE, type: "springer" }}
        actions={{ onExportPDF: () => window.print(), onExportWord: exportWord, onUpload: handleUpload }}
        tabContent={{ metadata: metadataPanel, content: contentPanel, figures: figuresPanel, references: referencesPanel, layout: layoutTabPanel, export: exportTabPanel }}
        preview={<SpringerPreview paper={paper} fontSize={fontSize} lineSpacing={lineSpacing} />}
        rightPanelSections={{ layout: rpLayout, typography: rpTypography, contentStyle: rpContentStyle, figuresTables: rpFiguresTables, export: rpExport, documentInfo: rpDocumentInfo }}
      />
    </>
  );
}
