import React, { useState, useRef, useCallback } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, AlignLeft, Columns, AlertCircle, CheckCircle2 } from "lucide-react";
import type { PaperData, Section } from "./types";
import { DEMO } from "./demo";
import {
  JournalEditorShell, SERIF, SANS, MONO, MUTED, BORDER, TEXT, PANEL_BG,
  FieldInput, FieldTextarea, SectionLabel, SliderField, ChoiceRow, ExportPanel,
} from "./shell/JournalEditorShell";

/* ─── local types ─────────────────────────────────────────────────── */
type Lang = "en" | "zh" | "both";

function bi(o: { en: string; zh: string }, lang: Lang) {
  return lang === "en" ? o.en : o.zh;
}

/* ═══════════════════════════════════════════════════════════════════════
   ELSEVIER ESWA PREVIEW  (untouched layout logic)
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
    <div id="preview-root" style={{ fontFamily: SERIF, backgroundColor: "#fff", color: "#111", fontSize: "9.5pt", lineHeight: 1.55, padding: "36px 44px" }}>

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
      {showZh && <h1 style={{ fontFamily: SERIF, fontWeight: 700, fontSize: bil ? "13pt" : "15pt", lineHeight: 1.25, marginBottom: 4, color: "#111" }}>{paper.title.zh}</h1>}
      {showEn && <h1 style={{ fontFamily: SERIF, fontWeight: bil ? 600 : 700, fontStyle: bil ? "italic" : "normal", fontSize: bil ? "11pt" : "15pt", lineHeight: 1.3, marginBottom: 10, color: bil ? "#444" : "#111" }}>{paper.title.en}</h1>}

      {/* authors */}
      <div style={{ marginBottom: 5, fontFamily: SANS, fontSize: "9pt", lineHeight: 1.7 }}>
        {paper.authors.map((a, i) => (
          <span key={i}>
            <span style={{ color: "#c0392b", fontWeight: 500 }}>{bil ? `${a.nameZh} (${a.name})` : showZh ? a.nameZh : a.name}</span>
            <sup style={{ fontSize: "7pt", color: "#666" }}>{a.affKeys}</sup>
            {i < paper.authors.length - 1 && <span style={{ color: "#888", margin: "0 4px" }}>,</span>}
          </span>
        ))}
      </div>

      {/* affiliations */}
      <div style={{ marginBottom: 8, fontFamily: SANS, fontSize: "7.8pt", color: "#444", lineHeight: 1.6 }}>
        {paper.affiliations.map((aff) => (
          <div key={aff.key}>
            <sup style={{ fontSize: "6pt" }}>{aff.key}</sup>{" "}
            {bil ? `${aff.textZh} / ${aff.text}` : showZh ? aff.textZh : aff.text}
          </div>
        ))}
      </div>

      {/* article history */}
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
            {showEn && paper.highlights.map((h, i) => <li key={i} style={{ fontStyle: bil ? "italic" : "normal", color: bil ? "#666" : "#333" }}>{h}</li>)}
          </ul>
        </div>
      )}

      {/* abstract */}
      <div style={{ marginBottom: 14, padding: "9px 12px", backgroundColor: "#f8f9fa", border: "1px solid #e0e0e0" }}>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: "8pt", color: "#333", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {showZh ? (bil ? "Abstract · 摘要" : "摘要") : "Abstract"}
        </div>
        {showZh && <p style={{ margin: "0 0 6px", fontFamily: SERIF, fontSize: "9pt", textAlign: "justify", lineHeight: 1.6 }}>{paper.abstract.zh}</p>}
        {bil && <hr style={{ border: "none", borderTop: "1px dashed #ddd", margin: "6px 0" }} />}
        {showEn && <p style={{ margin: "0 0 8px", fontFamily: SERIF, fontSize: "9pt", textAlign: "justify", lineHeight: 1.6, fontStyle: bil ? "italic" : "normal", color: bil ? "#555" : "#111" }}>{paper.abstract.en}</p>}
        <div style={{ fontFamily: SANS, fontSize: "8pt", lineHeight: 1.7 }}>
          <span style={{ fontWeight: 600 }}>Keywords{showZh ? " / 关键词" : ""}:</span>{" "}
          {(showZh ? paper.keywords.zh : paper.keywords.en).join("; ")}
          {bil && <><br /><span style={{ color: "#888", fontStyle: "italic" }}>{paper.keywords.en.join("; ")}</span></>}
        </div>
      </div>

      {/* body */}
      <div style={{ columns: columns === 2 ? 2 : 1, columnGap: "1.8em", columnRule: columns === 2 ? "1px solid #e0e0e0" : undefined }}>
        {paper.sections.map((sec, si) => (
          <div key={sec.id} style={{ breakInside: "avoid-column", marginBottom: "0.5em" }}>
            <h2 style={{ fontFamily: SANS, fontWeight: 700, fontSize: "9.5pt", color: "#111", margin: "12px 0 5px", paddingBottom: 3, borderBottom: "1px solid #ddd" }}>
              {bil ? `${sec.number}. ${sec.title.zh} / ${sec.title.en}` : `${sec.number}. ${bi(sec.title, lang)}`}
            </h2>
            {(showZh ? sec.content.zh : sec.content.en).split("\n\n").filter(Boolean).map((para, pi) => (
              <p key={pi} style={{ margin: "0 0 6px", textAlign: "justify", fontFamily: SERIF, fontSize: "9.5pt", lineHeight: 1.6, textIndent: "1.2em" }}>{para.trim()}</p>
            ))}
            {bil && sec.content.en !== sec.content.zh && (
              <div style={{ borderLeft: "2px solid #e8e8e8", paddingLeft: 8, marginBottom: 4 }}>
                {sec.content.en.split("\n\n").filter(Boolean).map((para, pi) => (
                  <p key={pi} style={{ margin: "0 0 5px", textAlign: "justify", fontFamily: SERIF, fontSize: "8.8pt", lineHeight: 1.55, color: "#555", fontStyle: "italic", textIndent: "1.2em" }}>{para.trim()}</p>
                ))}
              </div>
            )}
            {paper.figures[si] && (
              <figure style={{ breakInside: "avoid", margin: "10px 0", textAlign: "center" }}>
                <div style={{ backgroundColor: paper.figures[si].placeholder, border: "1px solid #ddd", padding: "22px 12px", fontSize: "8pt", fontFamily: SANS, color: "#666", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 90 }}>
                  [Fig. {paper.figures[si].number}]
                </div>
                <figcaption style={{ fontFamily: SANS, fontSize: "8pt", color: "#444", marginTop: 5, lineHeight: 1.5, textAlign: "left" }}>
                  <strong>Fig. {paper.figures[si].number}.</strong>{" "}
                  {bil ? `${paper.figures[si].caption.zh} / ${paper.figures[si].caption.en}` : bi(paper.figures[si].caption, lang)}
                </figcaption>
              </figure>
            )}
            {paper.tables[si] && (
              <figure style={{ breakInside: "avoid", margin: "10px 0" }}>
                <figcaption style={{ fontFamily: SANS, fontSize: "8pt", fontWeight: 600, color: "#444", marginBottom: 4 }}>
                  Table {paper.tables[si].number}.{" "}
                  <span style={{ fontWeight: 400 }}>{bil ? `${paper.tables[si].caption.zh} / ${paper.tables[si].caption.en}` : bi(paper.tables[si].caption, lang)}</span>
                </figcaption>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: SANS, fontSize: "8pt" }}>
                  <thead>
                    <tr>{paper.tables[si].headers.map((h, hi) => <th key={hi} style={{ borderTop: "1px solid #bbb", borderBottom: "2px solid #111", padding: "3px 6px", textAlign: hi === 0 ? "left" : "center", fontWeight: 700 }}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {paper.tables[si].rows.map((row, ri) => {
                      const isLast = ri === paper.tables[si].rows.length - 1;
                      const isOurs = row.cells[0].includes("(ours)") || row.cells[0].includes("本文");
                      return (
                        <tr key={ri} style={{ borderBottom: isLast ? "1.5px solid #666" : "1px solid #ddd", backgroundColor: isOurs ? "rgba(192,57,43,0.04)" : "transparent" }}>
                          {row.cells.map((c, ci) => <td key={ci} style={{ padding: "3px 6px", textAlign: ci === 0 ? "left" : "center", fontWeight: isOurs ? 700 : 400, color: isOurs && ci === 0 ? "#c0392b" : "#222" }}>{c}</td>)}
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
          <figure key={fig.id} style={{ breakInside: "avoid", margin: "10px 0", textAlign: "center" }}>
            <div style={{ backgroundColor: fig.placeholder, border: "1px solid #ddd", padding: "22px 12px", fontSize: "8pt", fontFamily: SANS, color: "#666", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 90 }}>[Fig. {fig.number}]</div>
            <figcaption style={{ fontFamily: SANS, fontSize: "8pt", color: "#444", marginTop: 5, lineHeight: 1.5, textAlign: "left" }}>
              <strong>Fig. {fig.number}.</strong>{" "}{bil ? `${fig.caption.zh} / ${fig.caption.en}` : bi(fig.caption, lang)}
            </figcaption>
          </figure>
        ))}
        {paper.tables.slice(paper.sections.length).map((tbl) => (
          <figure key={tbl.id} style={{ breakInside: "avoid", margin: "10px 0" }}>
            <figcaption style={{ fontFamily: SANS, fontSize: "8pt", fontWeight: 600, color: "#444", marginBottom: 4 }}>
              Table {tbl.number}. <span style={{ fontWeight: 400 }}>{bil ? `${tbl.caption.zh} / ${tbl.caption.en}` : bi(tbl.caption, lang)}</span>
            </figcaption>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: SANS, fontSize: "8pt" }}>
              <thead><tr>{tbl.headers.map((h, hi) => <th key={hi} style={{ borderTop: "1px solid #bbb", borderBottom: "2px solid #111", padding: "3px 6px", textAlign: hi === 0 ? "left" : "center", fontWeight: 700 }}>{h}</th>)}</tr></thead>
              <tbody>
                {tbl.rows.map((row, ri) => {
                  const isLast = ri === tbl.rows.length - 1;
                  const isOurs = row.cells[0].includes("(ours)") || row.cells[0].includes("本文");
                  return (
                    <tr key={ri} style={{ borderBottom: isLast ? "1.5px solid #666" : "1px solid #ddd", backgroundColor: isOurs ? "rgba(192,57,43,0.04)" : "transparent" }}>
                      {row.cells.map((c, ci) => <td key={ci} style={{ padding: "3px 6px", textAlign: ci === 0 ? "left" : "center", fontWeight: isOurs ? 700 : 400, color: isOurs && ci === 0 ? "#c0392b" : "#222" }}>{c}</td>)}
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
          {paper.references.map((ref, i) => <li key={i} style={{ marginBottom: 3 }}>{ref}</li>)}
        </ol>
      </div>

      {/* footer */}
      <div style={{ marginTop: 16, paddingTop: 5, borderTop: "1px solid #ddd", display: "flex", justifyContent: "space-between", fontFamily: SANS, fontSize: "7pt", color: "#aaa" }}>
        <span>{paper.journal} · {paper.volume} ({paper.year}) {paper.pages}</span>
        <span>© {paper.year} Elsevier Ltd. All rights reserved.</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SECTION CARD
   ═══════════════════════════════════════════════════════════════════════ */
function SectionCard({ sec, onUpdate, onDelete }: {
  sec: Section;
  onUpdate: (s: Section) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 6, border: `1px solid ${BORDER}`, borderRadius: 3, overflow: "hidden" }}>
      <div onClick={() => setOpen((o) => !o)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", backgroundColor: PANEL_BG, cursor: "pointer", userSelect: "none" }}>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span style={{ flex: 1, fontFamily: SANS, fontSize: "0.75rem", fontWeight: 600 }}>§{sec.number} {sec.title.en || sec.title.zh || "(untitled)"}</span>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}><Trash2 size={11} /></button>
      </div>
      {open && (
        <div style={{ padding: "10px 10px 4px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: 8 }}>
            <FieldInput label="§ No." value={sec.number} onChange={(v) => onUpdate({ ...sec, number: v })} />
            <div />
          </div>
          <FieldInput label="Heading (EN)" value={sec.title.en} onChange={(v) => onUpdate({ ...sec, title: { ...sec.title, en: v } })} />
          <FieldInput label="Heading (中文)" value={sec.title.zh} onChange={(v) => onUpdate({ ...sec, title: { ...sec.title, zh: v } })} />
          <FieldTextarea label="Body (EN)" value={sec.content.en} onChange={(v) => onUpdate({ ...sec, content: { ...sec.content, en: v } })} rows={5} />
          <FieldTextarea label="Body (中文)" value={sec.content.zh} onChange={(v) => onUpdate({ ...sec, content: { ...sec.content, zh: v } })} rows={5} />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   ELSEVIER PAGE
   ═══════════════════════════════════════════════════════════════════════ */
export function ElsevierPage() {
  const [paper, setPaper] = useState<PaperData>(DEMO);
  const [lang, setLang]   = useState<Lang>("en");
  const [columns, setColumns] = useState<1 | 2>(2);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const set = useCallback((patch: Partial<PaperData>) => setPaper((p) => ({ ...p, ...patch })), []);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const handleUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as Partial<PaperData>;
        setPaper((p) => ({ ...p, ...parsed }));
        showToast(`Imported "${file.name}"`);
      } catch {
        const lines = (e.target?.result as string).split("\n").filter(Boolean);
        const title = lines[0] || "";
        set({ title: { en: title, zh: title } });
        showToast(`Imported text from "${file.name}"`);
      }
    };
    reader.readAsText(file);
  };

  const exportWord = () => {
    const node = document.getElementById("preview-root");
    if (!node) return;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:"Times New Roman",serif;font-size:10pt;line-height:1.55;margin:2.5cm}h1{font-size:14pt}h2{font-size:10pt;font-weight:bold;border-bottom:1px solid #ccc}p{text-align:justify;text-indent:1.2em;margin-bottom:6pt}table{border-collapse:collapse;width:100%;font-size:9pt}th,td{border-bottom:1px solid #ccc;padding:3pt 6pt}figcaption{font-size:8pt}ol{font-size:8.5pt;padding-left:14pt}</style></head><body>${node.innerHTML}</body></html>`;
    const blob = new Blob(["﻿", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: "article.doc" }).click();
    URL.revokeObjectURL(url);
  };

  /* ── METADATA TAB ── */
  const metadataPanel = (
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

      <SectionLabel>Authors</SectionLabel>
      {paper.authors.map((a, i) => (
        <div key={i} style={{ marginBottom: 8, padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 3, backgroundColor: PANEL_BG }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <FieldInput label="Name (EN)" value={a.name} onChange={(v) => { const authors = [...paper.authors]; authors[i] = { ...a, name: v }; set({ authors }); }} />
            <FieldInput label="Name (中文)" value={a.nameZh} onChange={(v) => { const authors = [...paper.authors]; authors[i] = { ...a, nameZh: v }; set({ authors }); }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <FieldInput label="Aff. keys" value={a.affKeys} onChange={(v) => { const authors = [...paper.authors]; authors[i] = { ...a, affKeys: v }; set({ authors }); }} />
            <FieldInput label="Email" value={a.email || ""} onChange={(v) => { const authors = [...paper.authors]; authors[i] = { ...a, email: v }; set({ authors }); }} />
          </div>
          <button onClick={() => set({ authors: paper.authors.filter((_, j) => j !== i) })}
            style={{ fontFamily: SANS, fontSize: "0.7rem", color: "#ef4444", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, padding: 0 }}>
            <Trash2 size={11} /> Remove
          </button>
        </div>
      ))}
      <button onClick={() => set({ authors: [...paper.authors, { name: "", nameZh: "", affKeys: "a" }] })}
        style={{ fontFamily: SANS, fontSize: "0.72rem", color: "#c0392b", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
        <Plus size={12} /> Add Author
      </button>

      <SectionLabel>Affiliations</SectionLabel>
      {paper.affiliations.map((aff, i) => (
        <div key={i} style={{ marginBottom: 8, padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 3, backgroundColor: PANEL_BG }}>
          <div style={{ display: "grid", gridTemplateColumns: "56px 1fr", gap: 8 }}>
            <FieldInput label="Key" value={aff.key} onChange={(v) => { const affiliations = [...paper.affiliations]; affiliations[i] = { ...aff, key: v }; set({ affiliations }); }} />
            <FieldInput label="Text (EN)" value={aff.text} onChange={(v) => { const affiliations = [...paper.affiliations]; affiliations[i] = { ...aff, text: v }; set({ affiliations }); }} />
          </div>
          <FieldInput label="Text (中文)" value={aff.textZh} onChange={(v) => { const affiliations = [...paper.affiliations]; affiliations[i] = { ...aff, textZh: v }; set({ affiliations }); }} />
          <button onClick={() => set({ affiliations: paper.affiliations.filter((_, j) => j !== i) })}
            style={{ fontFamily: SANS, fontSize: "0.7rem", color: "#ef4444", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, padding: 0 }}>
            <Trash2 size={11} /> Remove
          </button>
        </div>
      ))}
      <button onClick={() => set({ affiliations: [...paper.affiliations, { key: String.fromCharCode(97 + paper.affiliations.length), text: "", textZh: "" }] })}
        style={{ fontFamily: SANS, fontSize: "0.72rem", color: "#c0392b", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
        <Plus size={12} /> Add Affiliation
      </button>
    </div>
  );

  /* ── CONTENT TAB ── */
  const contentPanel = (
    <div>
      <FieldTextarea label="Abstract (EN)" value={paper.abstract.en} onChange={(v) => set({ abstract: { ...paper.abstract, en: v } })} rows={6} />
      <FieldTextarea label="Abstract (中文)" value={paper.abstract.zh} onChange={(v) => set({ abstract: { ...paper.abstract, zh: v } })} rows={6} />
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontFamily: SANS, fontSize: "0.65rem", fontWeight: 700, color: MUTED, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>Keywords (EN)</div>
        <input value={paper.keywords.en.join(", ")} onChange={(e) => set({ keywords: { ...paper.keywords, en: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } })}
          style={{ width: "100%", padding: "6px 9px", fontSize: "0.8rem", fontFamily: SANS, border: `1px solid ${BORDER}`, borderRadius: 3, outline: "none" }} />
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontFamily: SANS, fontSize: "0.65rem", fontWeight: 700, color: MUTED, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>Keywords (中文)</div>
        <input value={paper.keywords.zh.join(", ")} onChange={(e) => set({ keywords: { ...paper.keywords, zh: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } })}
          style={{ width: "100%", padding: "6px 9px", fontSize: "0.8rem", fontFamily: SANS, border: `1px solid ${BORDER}`, borderRadius: 3, outline: "none" }} />
      </div>
      <FieldTextarea label="Highlights (EN) — one per line" value={paper.highlights.join("\n")} onChange={(v) => set({ highlights: v.split("\n").map((s) => s.trim()).filter(Boolean) })} rows={4} />
      <FieldTextarea label="Highlights (中文)" value={paper.highlightsZh.join("\n")} onChange={(v) => set({ highlightsZh: v.split("\n").map((s) => s.trim()).filter(Boolean) })} rows={4} />

      <SectionLabel>Sections</SectionLabel>
      {paper.sections.map((sec, i) => (
        <SectionCard key={sec.id} sec={sec}
          onUpdate={(s) => { const sections = [...paper.sections]; sections[i] = s; set({ sections }); }}
          onDelete={() => set({ sections: paper.sections.filter((_, j) => j !== i) })}
        />
      ))}
      <button onClick={() => set({ sections: [...paper.sections, { id: `s${Date.now()}`, number: String(paper.sections.length + 1), title: { en: "", zh: "" }, content: { en: "", zh: "" }, subsections: [] }] })}
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
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontFamily: SANS, fontSize: "0.75rem", fontWeight: 600 }}>Fig. {fig.number}</span>
            <button onClick={() => set({ figures: paper.figures.filter((_, j) => j !== i) })} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}><Trash2 size={11} /></button>
          </div>
          <FieldInput label="Caption (EN)" value={fig.caption.en} onChange={(v) => { const figures = [...paper.figures]; figures[i] = { ...fig, caption: { ...fig.caption, en: v } }; set({ figures }); }} />
          <FieldInput label="Caption (中文)" value={fig.caption.zh} onChange={(v) => { const figures = [...paper.figures]; figures[i] = { ...fig, caption: { ...fig.caption, zh: v } }; set({ figures }); }} />
        </div>
      ))}
      <button onClick={() => set({ figures: [...paper.figures, { id: `f${Date.now()}`, number: paper.figures.length + 1, caption: { en: "", zh: "" }, placeholder: "#dbeafe" }] })}
        style={{ fontFamily: SANS, fontSize: "0.72rem", display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", border: `1px solid ${BORDER}`, borderRadius: 3, backgroundColor: PANEL_BG, color: TEXT, cursor: "pointer", marginBottom: 16 }}>
        <Plus size={12} /> Add Figure
      </button>

      <SectionLabel>Tables</SectionLabel>
      {paper.tables.map((tbl, i) => (
        <div key={tbl.id} style={{ marginBottom: 8, padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 3, backgroundColor: PANEL_BG }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontFamily: SANS, fontSize: "0.75rem", fontWeight: 600 }}>Table {tbl.number}</span>
            <button onClick={() => set({ tables: paper.tables.filter((_, j) => j !== i) })} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}><Trash2 size={11} /></button>
          </div>
          <FieldInput label="Caption (EN)" value={tbl.caption.en} onChange={(v) => { const tables = [...paper.tables]; tables[i] = { ...tbl, caption: { ...tbl.caption, en: v } }; set({ tables }); }} />
          <FieldInput label="Caption (中文)" value={tbl.caption.zh} onChange={(v) => { const tables = [...paper.tables]; tables[i] = { ...tbl, caption: { ...tbl.caption, zh: v } }; set({ tables }); }} />
          <FieldInput label="Column headers (comma-separated)" value={tbl.headers.join(", ")} onChange={(v) => { const tables = [...paper.tables]; tables[i] = { ...tbl, headers: v.split(",").map((s) => s.trim()) }; set({ tables }); }} />
        </div>
      ))}
      <button onClick={() => set({ tables: [...paper.tables, { id: `t${Date.now()}`, number: paper.tables.length + 1, caption: { en: "", zh: "" }, headers: ["Col 1", "Col 2"], rows: [{ cells: ["", ""] }] }] })}
        style={{ fontFamily: SANS, fontSize: "0.72rem", display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", border: `1px solid ${BORDER}`, borderRadius: 3, backgroundColor: PANEL_BG, color: TEXT, cursor: "pointer" }}>
        <Plus size={12} /> Add Table
      </button>
    </div>
  );

  /* ── REFERENCES TAB ── */
  const referencesPanel = (
    <div>
      <p style={{ fontFamily: SANS, fontSize: "0.72rem", color: MUTED, marginBottom: 8, lineHeight: 1.5 }}>One reference per line. Auto-numbered in preview.</p>
      <FieldTextarea label="References" value={paper.references.join("\n")} onChange={(v) => set({ references: v.split("\n").map((s) => s.trim()).filter(Boolean) })} rows={22} />
    </div>
  );

  /* ── LAYOUT TAB (in left panel) ── */
  const layoutTabPanel = (
    <div>
      <p style={{ fontFamily: SANS, fontSize: "0.72rem", color: MUTED, marginBottom: 12, lineHeight: 1.5 }}>
        Layout and formatting settings. You can also adjust these in the right panel.
      </p>
      <SectionLabel>Column Layout</SectionLabel>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {([{ v: 1 as const, icon: <AlignLeft size={14} />, label: "Single column" }, { v: 2 as const, icon: <Columns size={14} />, label: "Two column" }] as const).map(({ v, icon, label }) => (
          <button key={v} onClick={() => setColumns(v)}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 8px", border: `1.5px solid ${columns === v ? "#c0392b" : BORDER}`, borderRadius: 3, backgroundColor: columns === v ? "rgba(192,57,43,0.04)" : PANEL_BG, color: columns === v ? "#c0392b" : TEXT, cursor: "pointer", fontFamily: SANS, fontSize: "0.7rem", fontWeight: columns === v ? 700 : 400 }}>
            {icon}{label}
          </button>
        ))}
      </div>
      <SectionLabel>Language</SectionLabel>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {(["en", "zh", "both"] as Lang[]).map((l) => {
          const lbl = { en: "English", zh: "中文", both: "Bilingual 双语" };
          return (
            <button key={l} onClick={() => setLang(l)}
              style={{ flex: 1, padding: "6px 6px", fontSize: "0.7rem", fontFamily: SANS, fontWeight: lang === l ? 700 : 400, border: `1px solid ${lang === l ? "#c0392b" : BORDER}`, borderRadius: 3, backgroundColor: lang === l ? "rgba(192,57,43,0.06)" : PANEL_BG, color: lang === l ? "#c0392b" : TEXT, cursor: "pointer" }}>
              {lbl[l]}
            </button>
          );
        })}
      </div>
    </div>
  );

  /* ── EXPORT TAB ── */
  const exportTabPanel = (
    <ExportPanel
      accentColor="#c0392b"
      onPDF={() => window.print()}
      onWord={exportWord}
      onXML={() => {
        const blob = new Blob([`<?xml version="1.0"?>\n<article><title>${paper.title.en}</title></article>`], { type: "application/xml" });
        Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "article.xml" }).click();
      }}
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

  /* ── RIGHT PANEL SECTIONS (standardised order) ── */
  const acRight = "#c0392b";

  const rpLayout = (
    <div>
      <ChoiceRow label="Columns"
        options={[{ value: "1", label: "1 Column" }, { value: "2", label: "2 Columns" }]}
        value={String(columns)}
        onChange={(v) => setColumns(Number(v) as 1 | 2)}
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
        options={[{ value: "times", label: "Times New Roman" }, { value: "garamond", label: "EB Garamond" }, { value: "charter", label: "Charter" }]}
        value="times"
        onChange={() => {}}
      />
      <SliderField label="Font size" value={10} min={8} max={13} step={0.5} unit="pt" onChange={() => {}} />
      <SliderField label="Line spacing" value={1.55} min={1} max={2} step={0.05} onChange={() => {}} />
    </div>
  );

  const rpContentStyle = (
    <div>
      <div style={{ fontFamily: SANS, fontSize: "0.72rem", color: TEXT, marginBottom: 5 }}>Language</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
        {(["en", "zh", "both"] as Lang[]).map((l) => {
          const lbl = { en: "English only", zh: "中文 only", both: "Bilingual (双语)" };
          return (
            <button key={l} onClick={() => setLang(l)}
              style={{ padding: "5px 8px", textAlign: "left", fontSize: "0.72rem", fontFamily: SANS, fontWeight: lang === l ? 700 : 400, border: `1px solid ${lang === l ? acRight : BORDER}`, borderRadius: 3, backgroundColor: lang === l ? "rgba(192,57,43,0.06)" : "#f9fafb", color: lang === l ? acRight : TEXT, cursor: "pointer" }}>
              {lbl[l]}
            </button>
          );
        })}
      </div>
      <ChoiceRow label="Citation style"
        options={[{ value: "numbered", label: "[1] Numbered" }, { value: "author", label: "Author-date" }]}
        value="numbered"
        onChange={() => {}}
      />
      <ChoiceRow label="Heading style"
        options={[{ value: "bold", label: "Bold" }, { value: "italic", label: "Italic Bold" }, { value: "caps", label: "Small Caps" }]}
        value="bold"
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
      <button onClick={() => {
        const blob = new Blob([`<?xml version="1.0"?>\n<article><title>${paper.title.en}</title></article>`], { type: "application/xml" });
        Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "article.xml" }).click();
      }}
        style={{ width: "100%", padding: "7px 10px", fontFamily: SANS, fontWeight: 600, fontSize: "0.75rem", backgroundColor: "#fff", color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 3, cursor: "pointer" }}>
        Export XML
      </button>
    </div>
  );

  const rpDocumentInfo = (
    <div style={{ fontFamily: SANS, fontSize: "0.7rem", color: MUTED, lineHeight: 1.75 }}>
      {[
        { label: "Journal", value: "Expert Systems with Applications" },
        { label: "Publisher", value: "Elsevier" },
        { label: "ISSN", value: paper.issn, mono: true },
        { label: "Volume", value: `${paper.volume} (${paper.year})` },
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
          name: "Expert Systems with Applications",
          abbrev: "ESWA",
          publisher: "Elsevier",
          accentColor: "#c0392b",
          type: "elsevier",
        }}
        actions={{
          onExportPDF: () => window.print(),
          onExportWord: exportWord,
          onUpload: handleUpload,
        }}
        langToggle={{ lang, onChange: setLang }}
        tabContent={{
          metadata: metadataPanel,
          content: contentPanel,
          figures: figuresPanel,
          references: referencesPanel,
          layout: layoutTabPanel,
          export: exportTabPanel,
        }}
        preview={<Preview paper={paper} lang={lang} columns={columns} />}
        rightPanelSections={{
          layout:       rpLayout,
          typography:   rpTypography,
          contentStyle: rpContentStyle,
          figuresTables: rpFiguresTables,
          export:       rpExport,
          documentInfo: rpDocumentInfo,
        }}
      />
    </>
  );
}
