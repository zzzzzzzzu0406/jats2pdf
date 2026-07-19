import React, { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { NATURE_DEMO, type NaturePaperData, type NatureSection } from "./demoNature";
import {
  JournalEditorShell, SERIF, SANS, MONO, MUTED, BORDER, TEXT, PANEL_BG,
  FieldInput, FieldTextarea, SectionLabel, SliderField, ChoiceRow, ExportPanel,
} from "./shell/JournalEditorShell";

/* ═══════════════════════════════════════════════════════════════════════
   NATURE PAPER PREVIEW
   ═══════════════════════════════════════════════════════════════════════ */
const NATURE_RED  = "#c0000a";
const NATURE_DARK = "#111111";

function NaturePreview({ paper, fontSize, lineSpacing }: {
  paper: NaturePaperData;
  fontSize: number;
  lineSpacing: number;
}) {
  return (
    <div id="nature-preview-root" style={{ fontFamily: SERIF, fontSize: `${fontSize}pt`, lineHeight: lineSpacing, color: NATURE_DARK, backgroundColor: "#fff", padding: "40px 56px 52px" }}>

      {/* ── JOURNAL NAMEPLATE ── */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16, borderBottom: `2px solid ${NATURE_DARK}`, paddingBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          {/* "nature" logotype style */}
          <span style={{ fontFamily: SERIF, fontWeight: 900, fontSize: "22pt", letterSpacing: "-0.02em", color: NATURE_RED, lineHeight: 1 }}>
            nature
          </span>
          <span style={{ fontFamily: SANS, fontWeight: 500, fontSize: "7.5pt", color: "#555", letterSpacing: "0.03em", paddingLeft: 12, borderLeft: "1px solid #ccc" }}>
            {paper.journal}
          </span>
        </div>
        <div style={{ fontFamily: MONO, fontSize: "7pt", color: "#888", textAlign: "right", lineHeight: 1.6 }}>
          <div>VOL {paper.volume} | {paper.published.split(" ").slice(-1)[0]}</div>
          <div>www.nature.com/nature</div>
        </div>
      </div>

      {/* ── ARTICLE TYPE TAG ── */}
      <div style={{ marginBottom: 12 }}>
        <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: "7.5pt", color: NATURE_RED, textTransform: "uppercase", letterSpacing: "0.14em" }}>
          {paper.articleType}
        </span>
      </div>

      {/* ── TITLE ── */}
      <h1 style={{ fontFamily: SERIF, fontWeight: 700, fontSize: `${fontSize + 7}pt`, lineHeight: 1.15, margin: "0 0 16px", color: NATURE_DARK, maxWidth: "95%" }}>
        {paper.title}
      </h1>

      {/* ── AUTHORS ── */}
      <div style={{ fontFamily: SANS, fontSize: "8.5pt", lineHeight: 1.9, marginBottom: 6, color: "#222" }}>
        {paper.authors.map((a, i) => (
          <span key={i}>
            <span style={{ fontWeight: a.corresponding ? 700 : 500 }}>{a.name}</span>
            {a.equalContrib && <sup style={{ fontSize: "6pt", color: "#555" }}>✝</sup>}
            {a.affKeys.map((k) => (
              <sup key={k} style={{ fontSize: "6pt", color: "#555" }}>{k}</sup>
            ))}
            {a.corresponding && <sup style={{ fontSize: "6pt", color: NATURE_RED }}>✉</sup>}
            {i < paper.authors.length - 1 && <span style={{ color: "#aaa", margin: "0 2px" }}>,</span>}
          </span>
        ))}
      </div>

      {/* ── EQUAL CONTRIBUTION NOTE ── */}
      {paper.authors.some((a) => a.equalContrib) && (
        <div style={{ fontFamily: SANS, fontSize: "7pt", color: "#666", fontStyle: "italic", marginBottom: 4 }}>
          ✝ These authors contributed equally to this work.
        </div>
      )}

      {/* ── AFFILIATIONS ── */}
      <div style={{ fontFamily: SANS, fontSize: "7.5pt", color: "#555", lineHeight: 1.65, marginBottom: 8 }}>
        {paper.affiliations.map((aff) => (
          <div key={aff.key}>
            <sup style={{ fontSize: "6pt" }}>{aff.key}</sup> {aff.text}
          </div>
        ))}
      </div>

      {/* ── CORRESPONDENCE ── */}
      {paper.authors.filter((a) => a.corresponding).map((a) => (
        <div key={a.name} style={{ fontFamily: SANS, fontSize: "7.5pt", color: "#444", marginBottom: 14 }}>
          ✉ e-mail: <span style={{ color: NATURE_RED }}>{a.email || `${a.name.split(" ").pop()?.toLowerCase()}@institution.edu`}</span>
        </div>
      ))}

      {/* ── RECEIVED / ACCEPTED ── */}
      <div style={{ fontFamily: SANS, fontSize: "7.5pt", color: "#888", marginBottom: 16, borderTop: "0.5px solid #ddd", borderBottom: "0.5px solid #ddd", padding: "5px 0" }}>
        Received: {paper.received} · Accepted: {paper.accepted} · Published: {paper.published}
      </div>

      {/* ── AT A GLANCE ── */}
      {paper.summary && paper.summary.length > 0 && (
        <div style={{ marginBottom: 16, padding: "10px 14px", border: "1px solid #e5e5e5", backgroundColor: "#fafafa", borderLeft: `3px solid ${NATURE_RED}` }}>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: "8pt", color: NATURE_RED, marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            At a glance
          </div>
          <ul style={{ margin: 0, paddingLeft: 14, fontFamily: SANS, fontSize: "8pt", lineHeight: 1.65, color: "#333" }}>
            {paper.summary.map((pt, i) => <li key={i} style={{ marginBottom: 3 }}>{pt}</li>)}
          </ul>
        </div>
      )}

      {/* ── ABSTRACT ── */}
      <div style={{ marginBottom: 18 }}>
        <p style={{ fontFamily: SANS, fontWeight: 700, fontSize: "8pt", color: "#000", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Abstract
        </p>
        <p style={{ margin: 0, fontFamily: SERIF, fontSize: `${fontSize}pt`, textAlign: "justify", lineHeight: lineSpacing, color: NATURE_DARK }}>
          {paper.abstract}
        </p>
      </div>

      {/* ── RULE ── */}
      <div style={{ borderTop: "1px solid #ccc", marginBottom: 16 }} />

      {/* ── BODY (single column, wide) ── */}
      {paper.sections.map((sec, si) => (
        <div key={sec.id} style={{ marginBottom: "1.2em" }}>
          <h2 style={{ fontFamily: SANS, fontWeight: 700, fontSize: `${fontSize + 1.5}pt`, color: NATURE_DARK, margin: "18px 0 7px", lineHeight: 1.3 }}>
            {sec.title}
          </h2>
          {sec.content.split("\n\n").filter(Boolean).map((para, pi) => (
            <p key={pi} style={{ margin: "0 0 8px", textAlign: "justify", fontFamily: SERIF, fontSize: `${fontSize}pt`, lineHeight: lineSpacing }}>
              {para.trim()}
            </p>
          ))}
          {paper.figures[si] && (
            <figure style={{ margin: "18px 0" }}>
              <div style={{ backgroundColor: paper.figures[si].placeholder, border: "1px solid #ddd", padding: "28px 16px", fontSize: "8pt", fontFamily: SANS, color: "#666", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 110 }}>
                [Fig. {paper.figures[si].number} — {paper.figures[si].title}]
              </div>
              <figcaption style={{ fontFamily: SANS, fontSize: "8pt", color: "#222", marginTop: 8, lineHeight: 1.55 }}>
                <strong style={{ color: NATURE_DARK }}>Fig. {paper.figures[si].number} | {paper.figures[si].title}</strong>
                {" "}{paper.figures[si].caption}
              </figcaption>
            </figure>
          )}
          {paper.tables[si] && (
            <figure style={{ margin: "16px 0" }}>
              <figcaption style={{ fontFamily: SANS, fontSize: "8pt", color: NATURE_DARK, fontWeight: 700, marginBottom: 5 }}>
                Table {paper.tables[si].number} | {paper.tables[si].title}
                {paper.tables[si].caption && <span style={{ fontWeight: 400, color: "#444" }}> {paper.tables[si].caption}</span>}
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
                    return (
                      <tr key={ri} style={{ borderBottom: isLast ? "1.5px solid #000" : "0.5px solid #e5e5e5" }}>
                        {row.cells.map((c, ci) => (
                          <td key={ci} style={{ padding: "3px 8px", textAlign: ci === 0 ? "left" : "center" }}>{c}</td>
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
        <figure key={fig.id} style={{ margin: "18px 0" }}>
          <div style={{ backgroundColor: fig.placeholder, border: "1px solid #ddd", padding: "28px 16px", fontSize: "8pt", fontFamily: SANS, color: "#666", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 110 }}>
            [Fig. {fig.number}]
          </div>
          <figcaption style={{ fontFamily: SANS, fontSize: "8pt", color: "#222", marginTop: 8, lineHeight: 1.55 }}>
            <strong style={{ color: NATURE_DARK }}>Fig. {fig.number} | {fig.title}</strong> {fig.caption}
          </figcaption>
        </figure>
      ))}

      {/* ── REFERENCES ── */}
      <div style={{ marginTop: 22, paddingTop: 10, borderTop: "2px solid #000" }}>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: "8.5pt", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          References
        </div>
        {paper.references.map((ref, i) => (
          <div key={i} style={{ fontFamily: SANS, fontSize: "7.5pt", lineHeight: 1.65, marginBottom: 5, color: "#333", paddingLeft: 18, position: "relative" }}>
            <span style={{ position: "absolute", left: 0, fontWeight: 700 }}>{i + 1}.</span>
            {ref.replace(/^\d+\.\s*/, "")}
          </div>
        ))}
      </div>

      {/* ── FOOTER ── */}
      <div style={{ marginTop: 18, paddingTop: 6, borderTop: "0.5px solid #ccc", display: "flex", justifyContent: "space-between", fontFamily: SANS, fontSize: "6.5pt", color: "#aaa" }}>
        <span>© {paper.year} Springer Nature Limited</span>
        <span>{paper.journal} | VOL {paper.volume} | {paper.published.split(" ").slice(-1)[0]} | {paper.pages}</span>
      </div>
    </div>
  );
}

/* ─── section card ─────────────────────────────────────────────────── */
function NatureSectionCard({ sec, onUpdate, onDelete }: {
  sec: NatureSection;
  onUpdate: (s: NatureSection) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 6, border: `1px solid ${BORDER}`, borderRadius: 3, overflow: "hidden" }}>
      <div onClick={() => setOpen((o) => !o)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", backgroundColor: PANEL_BG, cursor: "pointer" }}>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span style={{ flex: 1, fontFamily: SANS, fontSize: "0.75rem", fontWeight: 600 }}>{sec.title || "(untitled)"}</span>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}><Trash2 size={11} /></button>
      </div>
      {open && (
        <div style={{ padding: "10px 10px 4px" }}>
          <FieldInput label="Heading (no number)" value={sec.title} onChange={(v) => onUpdate({ ...sec, title: v })} />
          <FieldTextarea label="Body — blank line between paragraphs" value={sec.content} onChange={(v) => onUpdate({ ...sec, content: v })} rows={7} />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   NATURE PAGE
   ═══════════════════════════════════════════════════════════════════════ */
export function NaturePage() {
  const [paper, setPaper] = useState<NaturePaperData>(NATURE_DEMO);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [fontSize, setFontSize] = useState(NATURE_DEMO.fontSize);
  const [lineSpacing, setLineSpacing] = useState(NATURE_DEMO.lineSpacing);

  const set = (patch: Partial<NaturePaperData>) => setPaper((p) => ({ ...p, ...patch }));

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const handleUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as Partial<NaturePaperData>;
        setPaper((p) => ({ ...p, ...parsed }));
        showToast(`Imported "${file.name}"`);
      } catch {
        showToast("Could not parse file", false);
      }
    };
    reader.readAsText(file);
  };

  const exportWord = () => {
    const node = document.getElementById("nature-preview-root");
    if (!node) return;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:"Times New Roman",serif;font-size:${fontSize}pt;line-height:${lineSpacing};margin:2.5cm}h1{font-size:${fontSize + 7}pt;font-weight:bold;line-height:1.15}h2{font-size:${fontSize + 1.5}pt;font-weight:bold;margin-top:18pt}p{text-align:justify;margin-bottom:8pt}table{border-collapse:collapse;width:100%;font-size:8pt}th{border-top:1.5pt solid #000;border-bottom:1pt solid #999;padding:3pt 8pt;font-weight:bold}td{border-bottom:0.5pt solid #e5e5e5;padding:3pt 8pt}figcaption{font-size:8pt}</style></head><body>${node.innerHTML}</body></html>`;
    const blob = new Blob(["﻿", html], { type: "application/msword" });
    Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "nature-article.doc" }).click();
  };

  const exportXML = () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<article xmlns:xlink="http://www.w3.org/1999/xlink" article-type="${paper.articleType.toLowerCase()}">\n  <front>\n    <journal-meta>\n      <journal-title-group><journal-title>${paper.journal}</journal-title></journal-title-group>\n      <publisher><publisher-name>Springer Nature</publisher-name></publisher>\n    </journal-meta>\n    <article-meta>\n      <title-group><article-title>${paper.title}</article-title></title-group>\n      <pub-date pub-type="epub"><year>${paper.year}</year></pub-date>\n      <volume>${paper.volume}</volume>\n      <issue>${paper.issue}</issue>\n      <fpage>${paper.pages.split("–")[0]}</fpage>\n      <lpage>${paper.pages.split("–")[1] ?? paper.pages}</lpage>\n      <abstract><p>${paper.abstract}</p></abstract>\n    </article-meta>\n  </front>\n</article>`;
    const blob = new Blob([xml], { type: "application/xml" });
    Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "nature-article.xml" }).click();
  };

  /* ── METADATA TAB ── */
  const metadataPanel = (
    <div>
      <FieldInput label="Title" value={paper.title} onChange={(v) => set({ title: v })} />
      <FieldInput label="Article Type" value={paper.articleType} onChange={(v) => set({ articleType: v })} />

      <SectionLabel>Authors</SectionLabel>
      {paper.authors.map((a, i) => (
        <div key={i} style={{ marginBottom: 8, padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 3, backgroundColor: PANEL_BG }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 8 }}>
            <FieldInput label="Full Name" value={a.name} onChange={(v) => { const authors = [...paper.authors]; authors[i] = { ...a, name: v }; set({ authors }); }} />
            <FieldInput label="Aff. Keys" value={a.affKeys.join(",")} onChange={(v) => { const authors = [...paper.authors]; authors[i] = { ...a, affKeys: v.split(",").map((s) => s.trim()) }; set({ authors }); }} mono />
          </div>
          <FieldInput label="Email" value={a.email || ""} onChange={(v) => { const authors = [...paper.authors]; authors[i] = { ...a, email: v }; set({ authors }); }} />
          <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: SANS, fontSize: "0.72rem", color: TEXT, cursor: "pointer" }}>
              <input type="checkbox" checked={a.corresponding || false} onChange={(e) => { const authors = [...paper.authors]; authors[i] = { ...a, corresponding: e.target.checked }; set({ authors }); }} />
              Corresponding
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: SANS, fontSize: "0.72rem", color: TEXT, cursor: "pointer" }}>
              <input type="checkbox" checked={a.equalContrib || false} onChange={(e) => { const authors = [...paper.authors]; authors[i] = { ...a, equalContrib: e.target.checked }; set({ authors }); }} />
              Equal contrib.
            </label>
            <button onClick={() => set({ authors: paper.authors.filter((_, j) => j !== i) })}
              style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center", gap: 3, fontFamily: SANS, fontSize: "0.7rem" }}>
              <Trash2 size={11} /> Remove
            </button>
          </div>
        </div>
      ))}
      <button onClick={() => set({ authors: [...paper.authors, { name: "", affKeys: ["1"] }] })}
        style={{ fontFamily: SANS, fontSize: "0.72rem", color: NATURE_RED, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
        <Plus size={12} /> Add Author
      </button>

      <SectionLabel>Affiliations</SectionLabel>
      {paper.affiliations.map((aff, i) => (
        <div key={i} style={{ marginBottom: 6, display: "grid", gridTemplateColumns: "40px 1fr", gap: 8, alignItems: "start" }}>
          <FieldInput label="Key" value={aff.key} onChange={(v) => { const affiliations = [...paper.affiliations]; affiliations[i] = { ...aff, key: v }; set({ affiliations }); }} mono />
          <FieldInput label="Full affiliation" value={aff.text} onChange={(v) => { const affiliations = [...paper.affiliations]; affiliations[i] = { ...aff, text: v }; set({ affiliations }); }} />
        </div>
      ))}
      <button onClick={() => set({ affiliations: [...paper.affiliations, { key: String(paper.affiliations.length + 1), text: "" }] })}
        style={{ fontFamily: SANS, fontSize: "0.72rem", color: NATURE_RED, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
        <Plus size={12} /> Add Affiliation
      </button>

      <SectionLabel>Publication Details</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <FieldInput label="Volume" value={paper.volume} onChange={(v) => set({ volume: v })} />
        <FieldInput label="Issue" value={paper.issue} onChange={(v) => set({ issue: v })} />
        <FieldInput label="Year" value={paper.year} onChange={(v) => set({ year: v })} />
      </div>
      <FieldInput label="Pages" value={paper.pages} onChange={(v) => set({ pages: v })} mono />
      <FieldInput label="DOI" value={paper.doi} onChange={(v) => set({ doi: v })} mono />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <FieldInput label="Received" value={paper.received} onChange={(v) => set({ received: v })} />
        <FieldInput label="Accepted" value={paper.accepted} onChange={(v) => set({ accepted: v })} />
      </div>
      <FieldInput label="Published" value={paper.published} onChange={(v) => set({ published: v })} />
    </div>
  );

  /* ── CONTENT TAB ── */
  const contentPanel = (
    <div>
      <FieldTextarea label="Abstract" value={paper.abstract} onChange={(v) => set({ abstract: v })} rows={5} />

      <SectionLabel>At a Glance (bullet summary)</SectionLabel>
      <FieldTextarea
        label="One bullet per line"
        value={paper.summary.join("\n")}
        onChange={(v) => set({ summary: v.split("\n").map((s) => s.trim()).filter(Boolean) })}
        rows={4}
      />

      <SectionLabel>Sections</SectionLabel>
      {paper.sections.map((sec, i) => (
        <NatureSectionCard key={sec.id} sec={sec}
          onUpdate={(s) => { const sections = [...paper.sections]; sections[i] = s; set({ sections }); }}
          onDelete={() => set({ sections: paper.sections.filter((_, j) => j !== i) })}
        />
      ))}
      <button onClick={() => set({ sections: [...paper.sections, { id: `s${Date.now()}`, title: "", content: "" }] })}
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
          <FieldInput label="Short title" value={fig.title} onChange={(v) => { const figures = [...paper.figures]; figures[i] = { ...fig, title: v }; set({ figures }); }} />
          <FieldTextarea label="Full caption" value={fig.caption} onChange={(v) => { const figures = [...paper.figures]; figures[i] = { ...fig, caption: v }; set({ figures }); }} rows={3} />
        </div>
      ))}
      <button onClick={() => set({ figures: [...paper.figures, { id: `f${Date.now()}`, number: paper.figures.length + 1, title: "", caption: "", placeholder: "#fce7f3" }] })}
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
          <FieldInput label="Title" value={tbl.title} onChange={(v) => { const tables = [...paper.tables]; tables[i] = { ...tbl, title: v }; set({ tables }); }} />
          <FieldInput label="Caption" value={tbl.caption} onChange={(v) => { const tables = [...paper.tables]; tables[i] = { ...tbl, caption: v }; set({ tables }); }} />
          <FieldInput label="Column headers (comma-separated)" value={tbl.headers.join(", ")} onChange={(v) => { const tables = [...paper.tables]; tables[i] = { ...tbl, headers: v.split(",").map((s) => s.trim()) }; set({ tables }); }} />
        </div>
      ))}
      <button onClick={() => set({ tables: [...paper.tables, { id: `t${Date.now()}`, number: paper.tables.length + 1, title: "", caption: "", headers: ["Column 1", "Column 2"], rows: [{ cells: ["", ""] }] }] })}
        style={{ fontFamily: SANS, fontSize: "0.72rem", display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", border: `1px solid ${BORDER}`, borderRadius: 3, backgroundColor: PANEL_BG, color: TEXT, cursor: "pointer" }}>
        <Plus size={12} /> Add Table
      </button>
    </div>
  );

  /* ── REFERENCES TAB ── */
  const referencesPanel = (
    <div>
      <p style={{ fontFamily: SANS, fontSize: "0.72rem", color: MUTED, marginBottom: 8, lineHeight: 1.5 }}>One reference per line. Nature numbered format. Include "1." prefix or it will be added automatically.</p>
      <FieldTextarea label="References" value={paper.references.join("\n")} onChange={(v) => set({ references: v.split("\n").map((s) => s.trim()).filter(Boolean) })} rows={22} />
    </div>
  );

  /* ── LAYOUT TAB ── */
  const layoutTabPanel = (
    <div>
      <SectionLabel>Typography</SectionLabel>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: SANS, fontSize: "0.72rem", color: TEXT, marginBottom: 6 }}>Font Size: <span style={{ fontFamily: MONO, fontSize: "0.7rem", color: MUTED }}>{fontSize}pt</span></div>
        <input type="range" min={8} max={13} step={0.5} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} style={{ width: "100%", accentColor: NATURE_RED }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: "0.62rem", color: "#9ca3af", marginTop: 2 }}><span>8pt</span><span>13pt</span></div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: SANS, fontSize: "0.72rem", color: TEXT, marginBottom: 6 }}>Line Spacing: <span style={{ fontFamily: MONO, fontSize: "0.7rem", color: MUTED }}>{lineSpacing.toFixed(2)}</span></div>
        <input type="range" min={1} max={2} step={0.05} value={lineSpacing} onChange={(e) => setLineSpacing(Number(e.target.value))} style={{ width: "100%", accentColor: NATURE_RED }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: "0.62rem", color: "#9ca3af", marginTop: 2 }}><span>1.0</span><span>2.0</span></div>
      </div>

      <SectionLabel>Citation Style</SectionLabel>
      <div style={{ display: "flex", gap: 6 }}>
        {(["Nature", "APA", "Vancouver"] as const).map((cs) => (
          <button key={cs} onClick={() => set({ citationStyle: cs })}
            style={{ flex: 1, padding: "5px 6px", fontSize: "0.7rem", fontFamily: MONO, fontWeight: paper.citationStyle === cs ? 700 : 400, border: `1px solid ${paper.citationStyle === cs ? NATURE_RED : BORDER}`, borderRadius: 3, backgroundColor: paper.citationStyle === cs ? "rgba(192,0,10,0.06)" : PANEL_BG, color: paper.citationStyle === cs ? NATURE_RED : TEXT, cursor: "pointer" }}>
            {cs}
          </button>
        ))}
      </div>
    </div>
  );

  /* ── EXPORT TAB ── */
  const exportTabPanel = (
    <ExportPanel
      accentColor={NATURE_RED}
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
  const acRight = NATURE_RED;

  const rpLayout = (
    <div>
      <ChoiceRow label="Columns"
        options={[{ value: "1", label: "1 Column (Nature)" }, { value: "2", label: "2 Columns" }]}
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
        options={[{ value: "times", label: "Times New Roman" }, { value: "harding", label: "Harding (Nature)" }, { value: "georgia", label: "Georgia" }]}
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
        options={[{ value: "Nature", label: "Nature" }, { value: "APA", label: "APA" }, { value: "Vancouver", label: "Vancouver" }]}
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
        options={[{ value: "inline", label: "Inline" }, { value: "end", label: "End of paper" }]}
        value="inline"
        onChange={() => {}}
      />
      <ChoiceRow label="Table position"
        options={[{ value: "inline", label: "Inline" }, { value: "end", label: "End of paper" }]}
        value="inline"
        onChange={() => {}}
      />
      <ChoiceRow label="Caption style"
        options={[{ value: "below", label: "Below (Fig. N | title)" }, { value: "above", label: "Above item" }]}
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
        { label: "Publisher", value: "Springer Nature" },
        { label: "ISSN", value: "0028-0836", mono: true },
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
        journal={{ name: "Nature", abbrev: "Nature", publisher: "Springer Nature", accentColor: NATURE_RED, type: "nature" }}
        actions={{ onExportPDF: () => window.print(), onExportWord: exportWord, onUpload: handleUpload }}
        tabContent={{ metadata: metadataPanel, content: contentPanel, figures: figuresPanel, references: referencesPanel, layout: layoutTabPanel, export: exportTabPanel }}
        preview={<NaturePreview paper={paper} fontSize={fontSize} lineSpacing={lineSpacing} />}
        rightPanelSections={{ layout: rpLayout, typography: rpTypography, contentStyle: rpContentStyle, figuresTables: rpFiguresTables, export: rpExport, documentInfo: rpDocumentInfo }}
      />
    </>
  );
}
