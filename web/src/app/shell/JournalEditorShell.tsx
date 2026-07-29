import React, { useEffect, useState, useRef } from "react";
import {
  FileText, Edit3, Eye, Upload, Printer, FileDown, Save,
  Image, BookMarked, Sliders, FolderDown,
  Settings2, PanelLeft, PanelRight, X, ChevronDown, ChevronRight, ChevronUp,
} from "lucide-react";

/* ─── design tokens ────────────────────────────────────────────────── */
export const SANS  = "'Inter', system-ui, sans-serif";
export const SERIF = "'Source Serif 4', 'Times New Roman', Georgia, serif";
export const MONO  = "'JetBrains Mono', monospace";

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

export type JournalPageSize = "a4" | "letter";

export interface JournalPageLayout {
  size: JournalPageSize;
  label: string;
  cssSize: "A4" | "Letter";
  width: number;
  height: number;
}

const PAGE_PRESETS: Record<JournalPageSize, Omit<JournalPageLayout, "size">> = {
  a4: { label: "A4 · 210 × 297 mm", cssSize: "A4", width: 794, height: 1123 },
  letter: { label: "Letter · 8.5 × 11 in", cssSize: "Letter", width: 816, height: 1056 },
};

const DEFAULT_JOURNAL_PAGE_SIZES: Record<string, JournalPageSize> = {
  elsevier: "a4",
  ieee: "letter",
  springer: "a4",
  nature: "a4",
};

const PREVIEW_TOP_PADDING = 22;
const PREVIEW_PAGE_GAP = 28;

type PreviewMeasuredUnit = {
  html: string;
  top: number;
  bottom: number;
  order: number;
  columnIndex: number;
  assignedPage?: number;
  containerKey?: string;
  containerOpen?: string;
  containerClose?: string;
};

type PreviewFlowModel = {
  rootOpen: string;
  rootClose: string;
  before: PreviewMeasuredUnit[];
  after: PreviewMeasuredUnit[];
  body?: {
    open: string;
    close: string;
    columns?: Array<{ open: string; close: string }>;
    columnCount?: number;
    columnGap?: string;
    units: PreviewMeasuredUnit[];
  };
};

function tagParts(element: HTMLElement, stripId = false, listStart?: number): { open: string; close: string } {
  const clone = element.cloneNode(false) as HTMLElement;
  if (stripId) clone.removeAttribute("id");
  if (listStart && element.tagName === "OL") clone.setAttribute("start", String(listStart));
  const tagName = element.tagName.toLowerCase();
  const close = `</${tagName}>`;
  const html = clone.outerHTML;
  return html.endsWith(close) ? { open: html.slice(0, -close.length), close } : { open: html, close: "" };
}

function measuredUnit(element: HTMLElement, rootRect: DOMRect, order: number, columnIndex = -1): PreviewMeasuredUnit {
  const rect = element.getBoundingClientRect();
  return {
    html: element.outerHTML,
    top: Math.max(0, rect.top - rootRect.top),
    bottom: Math.max(0, rect.bottom - rootRect.top),
    order,
    columnIndex,
  };
}

const ATOMIC_CONTENT_TAGS = new Set([
  "P", "H1", "H2", "H3", "H4", "H5", "H6", "FIGURE", "TABLE", "IMG",
  "LI", "BLOCKQUOTE", "PRE", "HR",
]);

function fittedVisualUnit(element: HTMLElement, rootRect: DOMRect, pageHeight: number, order: number, columnIndex: number): PreviewMeasuredUnit {
  const unit = measuredUnit(element, rootRect, order, columnIndex);
  const originalHeight = Math.max(1, unit.bottom - unit.top);
  const targetHeight = Math.max(1, pageHeight - 80);
  if (originalHeight <= targetHeight) return unit;

  const scale = targetHeight / originalHeight;
  const fittedHeight = originalHeight * scale;
  unit.bottom = unit.top + fittedHeight;
  unit.html = `<div class="visual-page-fitted-block" style="height:${fittedHeight}px;overflow:hidden"><div style="width:${100 / scale}%;transform:scale(${scale});transform-origin:top left">${unit.html}</div></div>`;
  return unit;
}

function collectContentUnits(
  children: HTMLElement[],
  rootRect: DOMRect,
  pageHeight: number,
  columnIndex: number,
  orderState: { value: number },
): PreviewMeasuredUnit[] {
  return children.flatMap((child) => {
    const rect = child.getBoundingClientRect();
    const isAtomic = ATOMIC_CONTENT_TAGS.has(child.tagName) || child.children.length === 0;
    if ((child.tagName === "OL" || child.tagName === "UL") && rect.height > pageHeight * 0.72) {
      const listKey = `list-${orderState.value}`;
      const listItems = Array.from(child.children) as HTMLElement[];
      return listItems.map((item, index) => {
        const unit = measuredUnit(item, rootRect, orderState.value++, columnIndex);
        const listTags = tagParts(child, false, child.tagName === "OL" ? index + 1 : undefined);
        unit.containerKey = listKey;
        unit.containerOpen = listTags.open;
        unit.containerClose = listTags.close;
        return unit;
      });
    }
    if (isAtomic && rect.height > pageHeight * 0.72 && ["FIGURE", "TABLE", "IMG", "P", "LI"].includes(child.tagName)) {
      return [fittedVisualUnit(child, rootRect, pageHeight, orderState.value++, columnIndex)];
    }
    const keepTogether = isAtomic || rect.height <= pageHeight * 0.72;
    if (keepTogether) {
      return [measuredUnit(child, rootRect, orderState.value++, columnIndex)];
    }
    return collectContentUnits(Array.from(child.children) as HTMLElement[], rootRect, pageHeight, columnIndex, orderState);
  });
}

function assignSequentialPages(units: PreviewMeasuredUnit[], pageHeight: number, topInset: number, startPage = 0, subsequentInset = topInset): number {
  if (units.length === 0) return startPage;
  const orderedUnits = [...units].sort((left, right) => left.order - right.order);
  const subsequentTop = Math.min(subsequentInset, 48);
  const pageLimit = pageHeight - subsequentTop;
  let pageIndex = startPage;
  let cursor = topInset;
  let previous: PreviewMeasuredUnit | null = null;

  for (const unit of orderedUnits) {
    const unitHeight = Math.max(1, unit.bottom - unit.top);
    const gap = previous ? Math.max(0, unit.top - previous.bottom) : 0;
    const nextCursor = cursor + gap + unitHeight;
    if (previous && nextCursor > pageLimit) {
      pageIndex += 1;
      cursor = subsequentTop + unitHeight;
    } else {
      cursor = nextCursor;
    }
    unit.assignedPage = pageIndex;
    previous = unit;
  }
  return pageIndex;
}

function isFlowContainer(element: HTMLElement): boolean {
  if (element.classList.contains("journal-responsive-columns")) return true;
  const inlineStyle = element.getAttribute("style") || "";
  return /column-count|columns\s*:/i.test(inlineStyle);
}

function buildPreviewFlowModel(source: HTMLElement, pageHeight: number): { model: PreviewFlowModel; height: number } | null {
  const root = source.firstElementChild as HTMLElement | null;
  if (!root) return null;

  const rootRect = root.getBoundingClientRect();
  const rootTags = tagParts(root, true);
  const directChildren = Array.from(root.children) as HTMLElement[];
  const flowIndex = directChildren.findIndex(isFlowContainer);
  const contentUnits = (children: HTMLElement[], startOrder: number, columnIndex = -1) => {
    const orderState = { value: startOrder };
    return children.flatMap((child) => collectContentUnits([child], rootRect, pageHeight, columnIndex, orderState));
  };

  if (flowIndex < 0) {
    return {
      model: {
        rootOpen: rootTags.open,
        rootClose: rootTags.close,
        before: contentUnits(directChildren, 0),
        after: [],
      },
      height: Math.max(root.scrollHeight, rootRect.height),
    };
  }

  const flowContainer = directChildren[flowIndex];
  const before = contentUnits(directChildren.slice(0, flowIndex), 0);
  const after = contentUnits(directChildren.slice(flowIndex + 1), (flowIndex + 1) * 100000);
  const flowTags = tagParts(flowContainer);
  const flowColumns = Array.from(flowContainer.children).filter((child): child is HTMLElement => child instanceof HTMLElement && child.classList.contains("journal-responsive-columns__column"));

  if (flowColumns.length > 0) {
    const columns = flowColumns.map((column) => tagParts(column));
    const orderState = { value: flowIndex * 100000 };
    const units = flowColumns.flatMap((column, columnIndex) => collectContentUnits(Array.from(column.children) as HTMLElement[], rootRect, pageHeight, columnIndex, orderState));
    return {
      model: { rootOpen: rootTags.open, rootClose: rootTags.close, before, after, body: { open: flowTags.open, close: flowTags.close, columns, columnCount: columns.length, units } },
      height: Math.max(root.scrollHeight, rootRect.height),
    };
  }

  const flowChildren = Array.from(flowContainer.children) as HTMLElement[];
  const computedStyle = window.getComputedStyle(flowContainer);
  const columnCount = Math.max(1, Number.parseInt(computedStyle.columnCount, 10) || 1);
  const flowRect = flowContainer.getBoundingClientRect();
  const orderState = { value: flowIndex * 100000 };
  const units = flowChildren.flatMap((child) => {
    const childRect = child.getBoundingClientRect();
    const columnIndex = columnCount > 1
      ? Math.min(columnCount - 1, Math.max(0, Math.floor((childRect.left - flowRect.left) / Math.max(1, flowRect.width / columnCount))))
      : 0;
    return collectContentUnits([child], rootRect, pageHeight, columnIndex, orderState);
  });

  return {
    model: { rootOpen: rootTags.open, rootClose: rootTags.close, before, after, body: { open: flowTags.open, close: flowTags.close, columnCount, columnGap: computedStyle.columnGap, units } },
    height: Math.max(root.scrollHeight, rootRect.height),
  };
}

function buildPreviewPages(source: HTMLElement, pageHeight: number): string[] {
  const result = buildPreviewFlowModel(source, pageHeight);
  if (!result) return [];

  const { model, height } = result;
  const allUnits = [...model.before, ...(model.body?.units || []), ...model.after];
  const topInset = Math.min(...allUnits.map((unit) => unit.top), 40);
  const bodyColumnCount = model.body?.columnCount || model.body?.columns?.length || 1;
  if (!model.body || bodyColumnCount === 1) {
    assignSequentialPages(allUnits, pageHeight, topInset);
  } else {
    const body = model.body;
    assignSequentialPages(model.before, pageHeight, topInset);
    const bodyPages = Array.from({ length: bodyColumnCount }, (_, columnIndex) => {
      const columnUnits = body.units.filter((unit) => unit.columnIndex === columnIndex);
      const bodyTop = Math.min(...columnUnits.map((unit) => unit.top), pageHeight - topInset);
      return assignSequentialPages(columnUnits, pageHeight, bodyTop, 0, topInset);
    });
    assignSequentialPages(model.after, pageHeight, topInset, Math.max(...bodyPages, 0));
  }

  const lastUnitPage = allUnits.reduce((lastPage, unit) => Math.max(lastPage, unit.assignedPage || 0), 0);
  const pageCount = Math.max(1, Math.ceil(height / pageHeight), lastUnitPage + 1);
  return Array.from({ length: pageCount }, (_, pageIndex) => {
    const renderUnits = (units: PreviewMeasuredUnit[]) => {
      const orderedUnits = units
        .filter((unit) => unit.assignedPage === pageIndex)
        .sort((left, right) => left.order - right.order);
      let html = "";
      let openContainerKey: string | null = null;
      let closeContainer = "";

      const closeOpenContainer = () => {
        if (openContainerKey) html += closeContainer;
        openContainerKey = null;
        closeContainer = "";
      };

      for (const unit of orderedUnits) {
        if (unit.containerKey) {
          if (openContainerKey !== unit.containerKey) {
            closeOpenContainer();
            html += unit.containerOpen || "";
            openContainerKey = unit.containerKey;
            closeContainer = unit.containerClose || "";
          }
          html += unit.html;
        } else {
          closeOpenContainer();
          html += unit.html;
        }
      }
      closeOpenContainer();
      return html;
    };

    let content = renderUnits(model.before);
    if (model.body) {
      const bodyUnits = model.body.units.filter((unit) => unit.assignedPage === pageIndex);
      if (bodyUnits.length > 0) {
        if (model.body.columns) {
          const columns = model.body.columns.map((column, columnIndex) => {
            const columnHtml = renderUnits(bodyUnits.filter((unit) => unit.columnIndex === columnIndex));
            return `${column.open}${columnHtml}${column.close}`;
          }).join("");
          content += `${model.body.open}${columns}${model.body.close}`;
        } else if (bodyColumnCount > 1) {
          const columns = Array.from({ length: bodyColumnCount }, (_, columnIndex) => (
            `<div class="visual-page-column" style="min-width:0">${renderUnits(bodyUnits.filter((unit) => unit.columnIndex === columnIndex))}</div>`
          )).join("");
          content += `<div class="visual-page-columns" style="display:grid;grid-template-columns:repeat(${bodyColumnCount},minmax(0,1fr));column-gap:${model.body.columnGap || "22px"};align-items:start">${columns}</div>`;
        } else {
          content += `${model.body.open}${renderUnits(bodyUnits)}${model.body.close}`;
        }
      }
    }
    content += renderUnits(model.after);
    return `${model.rootOpen}${content}${model.rootClose}`;
  });
}

export function getJournalPageLayout(type: string, size?: JournalPageSize): JournalPageLayout {
  const pageSize = size || DEFAULT_JOURNAL_PAGE_SIZES[type] || "a4";
  return { size: pageSize, ...PAGE_PRESETS[pageSize] };
}

export interface ShellActions {
  onExportPDF: () => void;
  onExportWord: () => void;
  onXML?: () => void;
  onUpload?: (file: File) => void;
  onSave?: () => void;
  saving?: boolean;
}

export interface LanguageToggleProps {
  lang: "en" | "zh" | "both";
  onChange: (l: "en" | "zh" | "both") => void;
}

export type UiLang = "zh" | "en";

export interface JournalEditorShellProps {
  journal: JournalInfo;
  actions: ShellActions;
  pageLayout?: JournalPageLayout;
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

type RightSectionKey = keyof JournalEditorShellProps["rightPanelSections"];

/**
 * Split preview blocks into real side-by-side containers. CSS multi-column
 * layout only starts flowing into the next column when its height is bounded;
 * the live preview is intentionally auto-height, so explicit containers are
 * more reliable for editor toggles and responsive resizing.
 */
export function JournalColumns({
  columns,
  children,
  className,
  style,
}: {
  columns: 1 | 2;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const items = React.Children.toArray(children);
  const splitAt = Math.ceil(items.length / 2);
  const groups = columns === 2 ? [items.slice(0, splitAt), items.slice(splitAt)] : [items];

  return (
    <div
      className={className ? `journal-responsive-columns ${className}` : "journal-responsive-columns"}
      data-column-count={columns}
      style={{
        display: "grid",
        gridTemplateColumns: columns === 2 ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)",
        columnGap: "1.8em",
        alignItems: "start",
        ...style,
      }}
    >
      {groups.map((group, index) => (
        <div
          key={index}
          className="journal-responsive-columns__column"
          data-column-index={index}
          style={{
            minWidth: 0,
            ...(columns === 2 && index > 0 ? { borderLeft: "1px solid #ddd", paddingLeft: "0.9em" } : {}),
          }}
        >
          {group}
        </div>
      ))}
    </div>
  );
}

/* ─── bilingual label helpers ──────────────────────────────────────── */
type BilingualLabel = { en: React.ReactNode; zh: React.ReactNode };

function labelFor(lang: UiLang, label: BilingualLabel): React.ReactNode {
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
const RIGHT_SECTION_LABELS: Record<RightSectionKey, BilingualLabel> = {
  layout:        { en: "Layout",          zh: "版面"       },
  typography:    { en: "Typography",      zh: "字体排印"   },
  contentStyle:  { en: "Content Style",   zh: "内容样式"   },
  figuresTables: { en: "Figures & Tables",zh: "图表"       },
  export:        { en: "Export",          zh: "导出"       },
  documentInfo:  { en: "Document Info",   zh: "文档信息"   },
};

const RIGHT_SECTION_ORDER: RightSectionKey[] = [
  "layout", "typography", "contentStyle", "figuresTables", "export", "documentInfo",
];

const DEFAULT_EXPANDED_RIGHT_SECTIONS: Record<RightSectionKey, boolean> = {
  layout: true,
  typography: true,
  contentStyle: false,
  figuresTables: false,
  export: false,
  documentInfo: false,
};

export function JournalEditorShell({
  journal,
  actions,
  pageLayout,
  langToggle,
  uiLang = "en",
  tabContent,
  preview,
  rightPanelSections,
}: JournalEditorShellProps) {
  const resolvedPageLayout = pageLayout || getJournalPageLayout(journal.type);
  const compactAtStart = typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches;
  const [activeTab, setActiveTab]   = useState<LeftTab>("metadata");
  const [leftOpen, setLeftOpen]     = useState(!compactAtStart);
  const [rightOpen, setRightOpen]   = useState(!compactAtStart);
  const [isCompact, setIsCompact]   = useState(compactAtStart);
  const [expandedRightSections, setExpandedRightSections] = useState(DEFAULT_EXPANDED_RIGHT_SECTIONS);
  const [previewMode, setPreviewMode] = useState<"edit" | "preview">("edit");
  const [pageCount, setPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageScale, setPageScale] = useState(1);
  const [pageFragments, setPageFragments] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const previewPageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 900px)");
    const syncCompactPanels = () => {
      setIsCompact(mediaQuery.matches);
      if (mediaQuery.matches) {
        setLeftOpen(false);
        setRightOpen(false);
      }
    };
    syncCompactPanels();
    mediaQuery.addEventListener("change", syncCompactPanels);
    return () => mediaQuery.removeEventListener("change", syncCompactPanels);
  }, []);

  useEffect(() => {
    const page = previewPageRef.current;
    const scroll = previewScrollRef.current;
    if (!page || !scroll) return;

    const syncPreviewMetrics = () => {
      const availableWidth = Math.max(1, scroll.clientWidth - 28);
      const nextScale = Math.min(1, availableWidth / resolvedPageLayout.width);
      setPageScale((current) => Math.abs(current - nextScale) < 0.001 ? current : nextScale);

      const nextFragments = buildPreviewPages(page, resolvedPageLayout.height);
      const nextCount = Math.max(1, nextFragments.length);
      setPageFragments((current) => current.length === nextFragments.length && current.every((fragment, index) => fragment === nextFragments[index]) ? current : nextFragments);
      setPageCount(nextCount);
      setCurrentPage((current) => Math.min(nextCount, Math.max(1, current)));
    };

    syncPreviewMetrics();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncPreviewMetrics) : null;
    const mutationObserver = typeof MutationObserver !== "undefined" ? new MutationObserver(syncPreviewMetrics) : null;
    observer?.observe(page);
    observer?.observe(scroll);
    mutationObserver?.observe(page, { subtree: true, childList: true, attributes: true, characterData: true });
    window.addEventListener("resize", syncPreviewMetrics);
    return () => {
      observer?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener("resize", syncPreviewMetrics);
    };
  }, [preview, resolvedPageLayout.height, resolvedPageLayout.width]);

  useEffect(() => {
    const closePanelsOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLeftOpen(false);
        setRightOpen(false);
      }
    };
    window.addEventListener("keydown", closePanelsOnEscape);
    return () => window.removeEventListener("keydown", closePanelsOnEscape);
  }, []);

  const ac = journal.accentColor;
  const l = (bl: BilingualLabel) => labelFor(uiLang, bl);

  const handleFile = (file: File) => {
    if (actions.onUpload) actions.onUpload(file);
  };

  const toggleLeftPanel = () => {
    setLeftOpen((open) => {
      const nextOpen = !open;
      if (nextOpen && isCompact) setRightOpen(false);
      return nextOpen;
    });
  };

  const toggleRightPanel = () => {
    setRightOpen((open) => {
      const nextOpen = !open;
      if (nextOpen && isCompact) setLeftOpen(false);
      return nextOpen;
    });
  };

  const selectTab = (id: LeftTab) => setActiveTab(id);

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, id: LeftTab) => {
    const currentIndex = LEFT_TAB_ORDER.indexOf(id);
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (currentIndex + 1) % LEFT_TAB_ORDER.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (currentIndex - 1 + LEFT_TAB_ORDER.length) % LEFT_TAB_ORDER.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = LEFT_TAB_ORDER.length - 1;
    if (nextIndex === currentIndex) return;

    event.preventDefault();
    const nextTab = LEFT_TAB_ORDER[nextIndex];
    selectTab(nextTab);
    window.requestAnimationFrame(() => document.getElementById(`journal-tab-${nextTab}`)?.focus());
  };

  const toggleRightSection = (key: RightSectionKey) => {
    setExpandedRightSections((sections) => ({ ...sections, [key]: !sections[key] }));
  };

  const handlePreviewScroll = () => {
    const scroll = previewScrollRef.current;
    if (!scroll) return;
    const pageStride = (resolvedPageLayout.height + PREVIEW_PAGE_GAP) * pageScale;
    const scrollTop = Math.max(0, scroll.scrollTop - PREVIEW_TOP_PADDING);
    const nextPage = Math.floor((scrollTop + (resolvedPageLayout.height * pageScale) / 2) / pageStride) + 1;
    setCurrentPage(Math.min(pageCount, Math.max(1, nextPage)));
  };

  const jumpToPage = (page: number) => {
    const scroll = previewScrollRef.current;
    if (!scroll) return;
    const nextPage = Math.min(pageCount, Math.max(1, page));
    const pageStride = (resolvedPageLayout.height + PREVIEW_PAGE_GAP) * pageScale;
    scroll.scrollTo({ top: PREVIEW_TOP_PADDING + Math.max(0, (nextPage - 1) * pageStride), behavior: "smooth" });
    setCurrentPage(nextPage);
  };

  /* derived widths */
  const LEFT_W  = leftOpen  ? 272 : 0;
  const RIGHT_W = rightOpen ? 252 : 0;
  const visiblePageFragments = pageFragments.length > 0 ? pageFragments : [""];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", backgroundColor: "#fff" }}>

      {/* ── document toolbar: the platform navigation lives in Root ── */}
      <div
        className="no-print editor-document-toolbar"
        style={{
          backgroundColor: "#fff",
          borderBottom: `1px solid ${BORDER}`,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 8,
          minHeight: 54,
          padding: "0 14px",
          overflowX: "auto",
          scrollbarWidth: "thin",
        }}
      >
        {/* Current document context */}
        <div className="editor-current-context" style={{
          display: "flex", alignItems: "center", gap: 9,
          minWidth: 190, maxWidth: 320, flexShrink: 0,
          paddingRight: 12, borderRight: `1px solid ${BORDER}`,
        }}>
          <div style={{ width: 3, height: 30, borderRadius: 2, backgroundColor: ac, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: SANS, fontSize: "0.58rem", fontWeight: 700, color: MUTED, letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 2 }}>
              {l({ en: "Current journal", zh: "当前期刊" })}
            </div>
            <div style={{ fontFamily: SANS, fontSize: "0.76rem", fontWeight: 700, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {journal.name}
            </div>
            <div style={{ fontFamily: MONO, fontSize: "0.56rem", color: MUTED, marginTop: 2 }}>
              {journal.publisher}{journal.abbrev ? ` · ${journal.abbrev}` : ""}
            </div>
          </div>
        </div>

        {/* Editor actions stay local to the document workspace. */}
        <div className="editor-document-actions" style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: "auto" }}>

          {/* view mode */}
          <div role="group" aria-label={uiLang === "zh" ? "视图模式" : "View mode"} style={{ display: "flex", alignItems: "center", gap: 2, padding: 3, border: `1px solid ${BORDER}`, borderRadius: 4, backgroundColor: "#f8fafc" }}>
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
                  backgroundColor: previewMode === v ? "#e5e7eb" : "transparent",
                  color: previewMode === v ? TEXT : MUTED,
                }}>
                <Icon size={12} />{l(label)}
              </button>
            ))}
          </div>

          {/* panel toggles */}
          {previewMode === "edit" && (
            <div className="editor-panel-toggles" style={{ display: "flex", alignItems: "center", gap: 2 }}>
              <button type="button" aria-pressed={leftOpen} onClick={toggleLeftPanel} title={uiLang === "zh" ? "切换左侧编辑面板" : "Toggle editor panel"} aria-label={uiLang === "zh" ? "切换左侧编辑面板" : "Toggle editor panel"}
                style={{ padding: "6px 7px", background: leftOpen ? "#eef2f7" : "transparent", border: `1px solid ${leftOpen ? "#d5dce5" : "transparent"}`, cursor: "pointer", borderRadius: 3, color: leftOpen ? TEXT : MUTED, transition: "color 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#eef2f7"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = leftOpen ? "#eef2f7" : "transparent"; }}>
                <PanelLeft size={14} />
              </button>
              <button type="button" aria-pressed={rightOpen} onClick={toggleRightPanel} title={uiLang === "zh" ? "切换右侧设置面板" : "Toggle settings panel"} aria-label={uiLang === "zh" ? "切换右侧设置面板" : "Toggle settings panel"}
                style={{ padding: "6px 7px", background: rightOpen ? "#eef2f7" : "transparent", border: `1px solid ${rightOpen ? "#d5dce5" : "transparent"}`, cursor: "pointer", borderRadius: 3, color: rightOpen ? TEXT : MUTED, transition: "color 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#eef2f7"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = rightOpen ? "#eef2f7" : "transparent"; }}>
                <PanelRight size={14} />
              </button>
            </div>
          )}

          {/* lang toggle — only when provided */}
          {langToggle && previewMode === "edit" && (
            <div style={{ display: "flex", alignItems: "center", gap: 1, padding: "0 4px 0 8px", borderLeft: `1px solid ${BORDER}` }}>
              <span style={{ fontFamily: MONO, fontSize: "0.58rem", color: MUTED, marginRight: 5 }}>{l({ en: "Lang", zh: "语言" })}</span>
              {(["en", "zh", "both"] as const).map((l) => {
                const lbl = { en: "EN", zh: "中", both: "双" };
                return (
                  <button key={l} onClick={() => langToggle.onChange(l)}
                    style={{
                      padding: "4px 7px", fontSize: "0.66rem", fontFamily: SANS,
                      fontWeight: langToggle.lang === l ? 700 : 400,
                      border: "none", borderRadius: 3, cursor: "pointer",
                      backgroundColor: langToggle.lang === l ? "#e5e7eb" : "transparent",
                      color: langToggle.lang === l ? TEXT : MUTED,
                    }}>
                    {lbl[l]}
                  </button>
                );
              })}
            </div>
          )}

          {/* upload */}
          <div style={{ display: "flex", alignItems: "center", paddingLeft: 4, borderLeft: `1px solid ${BORDER}` }}>
            <input ref={fileRef} type="file" accept=".xml,.zip" style={{ display: "none" }}
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
            <button onClick={() => fileRef.current?.click()}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 11px", fontSize: "0.7rem", fontFamily: SANS, fontWeight: 500,
                border: `1px solid ${BORDER}`, borderRadius: 3,
                backgroundColor: "#fff", color: TEXT,
                cursor: "pointer",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#f8fafc"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#fff"; }}>
              <Upload size={12} /> {l({ en: "Upload", zh: "上传" })}
            </button>
          </div>

          {actions.onSave && (
            <div style={{ display: "flex", alignItems: "center", paddingLeft: 2 }}>
              <button
                type="button"
                onClick={actions.onSave}
                disabled={actions.saving}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "5px 11px", fontSize: "0.7rem", fontFamily: SANS, fontWeight: 600,
                  border: `1px solid ${actions.saving ? BORDER : "#cbd5e1"}`, borderRadius: 3,
                  backgroundColor: actions.saving ? "#f8fafc" : "#fff",
                  color: actions.saving ? "#9ca3af" : TEXT,
                  cursor: actions.saving ? "wait" : "pointer",
                }}
              >
                <Save size={12} /> {l({ en: actions.saving ? "Saving…" : "Save", zh: actions.saving ? "保存中…" : "保存" })}
              </button>
            </div>
          )}

          {/* primary export buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 2 }}>
            <button onClick={actions.onExportPDF}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "6px 15px", fontSize: "0.72rem", fontFamily: SANS, fontWeight: 700,
                backgroundColor: ac, color: "#fff",
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
                backgroundColor: "#fff", color: TEXT,
                border: `1px solid ${BORDER}`, borderRadius: 3, cursor: "pointer",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#f8fafc"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#fff"; }}>
              <FileDown size={12} /> Word
            </button>
          </div>

        </div>
      </div>

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
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: SANS, fontSize: "0.7rem", color: MUTED }}>
          {l({ en: "Academic Paper Formatter — JATS XML → Standard Journal Layout", zh: "学术论文排版 — JATS XML → 标准期刊版面" })}
        </span>
        <div className="hidden md:block" style={{ marginLeft: "auto", flexShrink: 0, fontFamily: SANS, fontSize: "0.68rem", color: "#9ca3af" }}>
          {l({ en: <>Upload <strong>.xml</strong> or <strong>.zip</strong> to import manuscript</>, zh: <>上传 <strong>.xml</strong> 或 <strong>.zip</strong> 以导入稿件</> })}
        </div>
      </div>

      <div
        className="no-print editor-pagination-bar"
        style={{
          minHeight: 34,
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 8,
          flexShrink: 0,
          backgroundColor: "#fff",
          borderBottom: `1px solid ${BORDER}`,
          fontFamily: SANS,
          fontSize: "0.65rem",
          color: MUTED,
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: "0.58rem", color: "#9ca3af" }}>{resolvedPageLayout.label}</span>
        <span aria-live="polite" style={{ minWidth: 58, textAlign: "center", color: TEXT, fontWeight: 650 }}>
          {currentPage} / {pageCount}
        </span>
        <button
          type="button"
          aria-label={uiLang === "zh" ? "上一页" : "Previous page"}
          title={uiLang === "zh" ? "上一页" : "Previous page"}
          disabled={currentPage <= 1}
          onClick={() => jumpToPage(currentPage - 1)}
          style={{ display: "grid", placeItems: "center", width: 25, height: 24, border: `1px solid ${BORDER}`, borderRadius: 3, background: "#fff", color: currentPage <= 1 ? "#cbd5e1" : TEXT, cursor: currentPage <= 1 ? "not-allowed" : "pointer" }}
        >
          <ChevronUp size={13} />
        </button>
        <button
          type="button"
          aria-label={uiLang === "zh" ? "下一页" : "Next page"}
          title={uiLang === "zh" ? "下一页" : "Next page"}
          disabled={currentPage >= pageCount}
          onClick={() => jumpToPage(currentPage + 1)}
          style={{ display: "grid", placeItems: "center", width: 25, height: 24, border: `1px solid ${BORDER}`, borderRadius: 3, background: "#fff", color: currentPage >= pageCount ? "#cbd5e1" : TEXT, cursor: currentPage >= pageCount ? "not-allowed" : "pointer" }}
        >
          <ChevronDown size={13} />
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          MAIN WORKSPACE (3 columns)
          ══════════════════════════════════════════════════════════════ */}
      <div className="editor-workspace" style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0, position: "relative" }}>

        {previewMode === "edit" && isCompact && (leftOpen || rightOpen) && (
          <button
            type="button"
            className="editor-panel-scrim"
            aria-label={uiLang === "zh" ? "关闭侧栏" : "Close side panels"}
            onClick={() => { setLeftOpen(false); setRightOpen(false); }}
          />
        )}

        {/* ── LEFT EDITOR PANEL ── */}
        {previewMode === "edit" && (
          <div
            className="no-print editor-left-panel"
            data-mobile-open={leftOpen ? "true" : "false"}
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
                <div className="editor-panel-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 34, padding: "0 10px 0 14px", borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
                  <span style={{ fontFamily: SANS, fontSize: "0.65rem", fontWeight: 700, color: MUTED, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    {l({ en: "Editor", zh: "编辑" })}
                  </span>
                  <button
                    type="button"
                    className="editor-panel-close"
                    onClick={() => setLeftOpen(false)}
                    title={uiLang === "zh" ? "关闭编辑面板" : "Close editor panel"}
                    aria-label={uiLang === "zh" ? "关闭编辑面板" : "Close editor panel"}
                  >
                    <X size={14} />
                  </button>
                </div>
                {/* tab rail */}
                <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
                  <div role="tablist" aria-label={uiLang === "zh" ? "编辑面板" : "Editor panels"} style={{ display: "flex", borderBottom: `1px solid ${BORDER}`, overflowX: "auto", scrollbarWidth: "thin" }}>
                    {LEFT_TAB_ORDER.map((id) => (
                      <button
                        key={id}
                        id={`journal-tab-${id}`}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === id}
                        aria-controls={`journal-tabpanel-${id}`}
                        tabIndex={activeTab === id ? 0 : -1}
                        onClick={() => selectTab(id)}
                        onKeyDown={(event) => handleTabKeyDown(event, id)}
                        style={{
                          display: "flex", flexDirection: "column", alignItems: "center",
                          gap: 3, padding: "9px 10px", fontSize: "0.62rem",
                          fontFamily: SANS, fontWeight: 500, whiteSpace: "nowrap",
                          border: "none", background: "none", cursor: "pointer",
                          flex: "1 0 76px",
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
                <div
                  id={`journal-tabpanel-${activeTab}`}
                  role="tabpanel"
                  aria-labelledby={`journal-tab-${activeTab}`}
                  tabIndex={0}
                  style={{ flex: 1, overflowY: "auto", padding: "14px 14px 20px", scrollbarWidth: "thin", outline: "none" }}
                >
                  {tabContent[activeTab]}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── CENTER PREVIEW ── */}
        <div
          ref={previewScrollRef}
          className="preview-shell"
          onScroll={handlePreviewScroll}
          style={{
            flex: 1,
            overflowY: "auto",
            backgroundColor: CANVAS_BG,
            minWidth: 0,
            boxSizing: "border-box",
            paddingTop: PREVIEW_TOP_PADDING,
            paddingBottom: 24,
            position: "relative",
          }}
        >
          <div
            className="preview-measurement"
            aria-hidden="true"
            style={{ width: resolvedPageLayout.width }}
          >
            <div ref={previewPageRef} className="preview-page-source" style={{ width: resolvedPageLayout.width }}>
              {preview}
            </div>
          </div>
          <div
            className="preview-page-stack"
            style={{
              width: resolvedPageLayout.width * pageScale,
              margin: "0 auto",
              display: "flex",
              flexDirection: "column",
              gap: PREVIEW_PAGE_GAP * pageScale,
            }}
          >
            {visiblePageFragments.map((fragment, pageIndex) => {
              const pageNumber = pageIndex + 1;
              return (
                <div
                  key={pageNumber}
                  className="visual-page-slot"
                  data-page-number={pageNumber}
                  style={{ width: resolvedPageLayout.width * pageScale, height: resolvedPageLayout.height * pageScale }}
                >
                  <div
                    className="visual-page-frame"
                    data-page-size={resolvedPageLayout.size}
                    style={{
                      width: resolvedPageLayout.width,
                      height: resolvedPageLayout.height,
                      transform: `scale(${pageScale})`,
                    }}
                  >
                    <div
                      className="visual-page-content"
                      style={{ width: resolvedPageLayout.width, minHeight: resolvedPageLayout.height }}
                      dangerouslySetInnerHTML={{ __html: fragment }}
                    >
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT SETTINGS PANEL ── */}
        {previewMode === "edit" && rightOpen && (
          <div
            className="no-print editor-right-panel"
            data-mobile-open={rightOpen ? "true" : "false"}
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
              <span style={{ flex: 1, fontFamily: SANS, fontSize: "0.72rem", fontWeight: 700, color: TEXT, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                {l({ en: "Formatting", zh: "格式设置" })}
              </span>
              <button
                type="button"
                className="editor-panel-close"
                onClick={() => setRightOpen(false)}
                title={uiLang === "zh" ? "关闭设置面板" : "Close settings panel"}
                aria-label={uiLang === "zh" ? "关闭设置面板" : "Close settings panel"}
              >
                <X size={14} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "thin" }}>
              {RIGHT_SECTION_ORDER.map((key) => {
                const content = rightPanelSections[key];
                if (!content) return null;
                const label = l(RIGHT_SECTION_LABELS[key]);
                const expanded = expandedRightSections[key];
                const sectionId = `journal-right-section-${key}`;
                return (
                  <div key={key} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <button
                      type="button"
                      id={`${sectionId}-button`}
                      aria-expanded={expanded}
                      aria-controls={sectionId}
                      onClick={() => toggleRightSection(key)}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 7,
                        padding: "10px 14px 8px", textAlign: "left",
                        border: "none", background: "transparent", cursor: "pointer",
                        fontFamily: SANS, fontSize: "0.63rem", fontWeight: 700,
                        color: expanded ? TEXT : MUTED, letterSpacing: "0.08em", textTransform: "uppercase",
                      }}
                    >
                      {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      <span>{label}</span>
                    </button>
                    {expanded && (
                      <div id={sectionId} role="region" aria-labelledby={`${sectionId}-button`} style={{ padding: "0 14px 12px" }}>
                        {content}
                      </div>
                    )}
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
          .preview-page-stack { width: ${resolvedPageLayout.width}px !important; gap: 0 !important; margin: 0 !important; display: block !important; }
          .visual-page-slot { width: ${resolvedPageLayout.width}px !important; height: ${resolvedPageLayout.height}px !important; display: block !important; }
          .visual-page-frame { box-shadow: none !important; transform: none !important; break-inside: avoid; break-after: page; page-break-after: always; }
          .visual-page-slot:last-child .visual-page-frame { break-after: auto; page-break-after: auto; }
          .preview-measurement { display: none !important; }
          .visual-page-content { width: ${resolvedPageLayout.width}px !important; }
          @page { margin: 0; size: ${resolvedPageLayout.cssSize}; }
        }
        @media (max-width: 900px) {
          .editor-document-toolbar {
            padding: 0 8px !important;
            gap: 6px !important;
          }
          .editor-current-context {
            min-width: 150px !important;
            max-width: 150px !important;
            padding-right: 8px !important;
          }
          .editor-document-actions {
            margin-left: 0 !important;
            gap: 6px !important;
          }
          .editor-left-panel,
          .editor-right-panel {
            display: none !important;
            position: absolute !important;
            top: 0;
            bottom: 0;
            z-index: 20;
            max-width: 86vw;
            box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18);
          }
          .editor-panel-scrim {
            position: absolute;
            inset: 0;
            z-index: 10;
            border: none;
            padding: 0;
            background: rgba(15, 23, 42, 0.34);
            cursor: pointer;
          }
          .editor-left-panel[data-mobile-open="true"] {
            display: flex !important;
            left: 0;
            width: min(272px, 86vw) !important;
          }
          .editor-right-panel[data-mobile-open="true"] {
            display: flex !important;
            right: 0;
            width: min(252px, 86vw) !important;
          }
          .preview-shell {
            width: 100%;
          }
          .preview-page-stack {
            max-width: calc(100% - 16px);
          }
        }
        .editor-panel-close {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          padding: 0;
          border: 1px solid transparent;
          border-radius: 3px;
          background: transparent;
          color: ${MUTED};
          cursor: pointer;
        }
        .editor-panel-close:hover {
          border-color: ${BORDER};
          background: ${PANEL_BG};
          color: ${TEXT};
        }
        .editor-panel-close:focus-visible,
        [role="tab"]:focus-visible,
        .editor-panel-scrim:focus-visible {
          outline: 2px solid ${ac};
          outline-offset: -2px;
        }
        .visual-page-frame {
          position: relative;
          overflow: hidden;
          transform-origin: top left;
          background: #fff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.08), 0 4px 20px rgba(0,0,0,0.10);
        }
        .visual-page-slot {
          flex: 0 0 auto;
          position: relative;
        }
        .preview-measurement {
          position: absolute;
          left: -100000px;
          top: 0;
          visibility: hidden;
          pointer-events: none;
          overflow: visible;
        }
        .preview-page-source,
        .visual-page-content {
          display: block;
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
        aria-label={label}
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
      <div role="group" aria-label={label} style={{ display: "flex", gap: 4 }}>
        {options.map((o) => (
          <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}
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
  onPDF, onWord, onHTML, onXML, onDocx, pdfSub,
  summary,
}: {
  accentColor: string;
  onPDF: () => void;
  onWord: () => void;
  onHTML?: () => void;
  onXML?: () => void;
  onDocx?: () => void;
  pdfSub?: string;
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
      <Btn label="Generate PDF" sub={pdfSub || "Browser print engine · A4 output"} onClick={onPDF} primary color={accentColor} />
      <Btn label="Download PDF" sub="Save formatted paper to device" onClick={onPDF} />
      {onHTML && <Btn label="Download HTML" sub="Self-contained preview document" onClick={onHTML} />}
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
