import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  AlignLeft,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Columns2,
  Database,
  Download,
  Eye,
  FileDown,
  FileText,
  Languages,
  Library,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Upload as UploadIcon,
} from "lucide-react";

type Language = "zh" | "en";
type PortalView = "upload" | "library" | "reader";
const UI_LANGUAGE_STORAGE_KEY = "scholartype-ui-language";

function initialLanguage(): Language {
  const queryLanguage = new URLSearchParams(window.location.search).get("ui_lang");
  if (queryLanguage === "zh" || queryLanguage === "en") return queryLanguage;
  try {
    return window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY) === "en" ? "en" : "zh";
  } catch {
    return "zh";
  }
}

interface ArticleAuthor {
  name?: string;
  given_name?: string;
  surname?: string;
}

interface ArticleSummary {
  id: string;
  title: string;
  abstract?: string;
  journal?: string;
  doi?: string;
  year?: number | null;
  lang?: string;
  ref_count?: number;
  section_count?: number;
  figure_count?: number;
  table_count?: number;
  formula_count?: number;
  source?: string;
  original_filename?: string;
  created_at?: string;
  authors?: ArticleAuthor[];
}

interface ArticleListResponse {
  items: ArticleSummary[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

interface UploadResponse {
  article_id: string;
  title: string;
  authors: ArticleAuthor[];
  journal: string;
  doi: string;
  lang: string;
  ref_count: number;
  asset_count: number;
}

interface RenderSettings {
  columns: 1 | 2;
  refStyle: "elsevier" | "gbt7714";
  fontStyle: "academic" | "modern" | "international";
  fontSize: "small" | "medium" | "large";
}

const DEFAULT_SETTINGS: RenderSettings = {
  columns: 2,
  refStyle: "elsevier",
  fontStyle: "academic",
  fontSize: "medium",
};

const copy = {
  zh: {
    brand: "ScholarType",
    subtitle: "JATS 智能排版门户",
    upload: "上传转换",
    library: "文章库",
    heroKicker: "真实 JATS XML → 出版级 PDF",
    heroTitle: "把结构化论文，转换为可出版版面",
    heroBody: "上传 JATS XML，或包含 XML 与图片资源的 ZIP。系统会真实解析文章结构、渲染公式与图表，并生成可下载的 HTML 和 PDF。",
    dropTitle: "拖放 JATS 文件到这里",
    dropHint: "支持 .xml（最大 10 MB）或 .zip 资源包（最大 50 MB）",
    choose: "选择文件",
    converting: "正在解析并生成预览…",
    uploadSuccess: "解析完成，正在打开真实文章预览",
    invalidType: "请选择 .xml 或 .zip 文件",
    fileTooLarge: "文件超过允许大小",
    features: ["JATS 结构解析", "MathML 公式", "图表与交叉引用", "单/双栏", "GB/T 7714", "PDF 导出"],
    libraryTitle: "已解析文章",
    libraryBody: "从后端数据库读取真实文章，可搜索并继续预览或导出。",
    search: "搜索标题、作者、摘要或关键词",
    searchButton: "搜索",
    refresh: "刷新",
    loading: "正在读取文章库…",
    empty: "没有找到匹配的文章",
    view: "打开排版",
    references: "参考文献",
    sections: "章节",
    figures: "图",
    formulas: "公式",
    back: "返回文章库",
    preview: "真实排版预览",
    previewLoading: "正在由后端渲染文章…",
    layout: "版面设置",
    single: "单栏",
    double: "双栏",
    refStyle: "参考文献格式",
    fontStyle: "字体风格",
    fontSize: "正文字号",
    academic: "学术经典",
    modern: "现代清晰",
    international: "国际期刊",
    small: "小",
    medium: "中",
    large: "大",
    downloadHtml: "下载 HTML",
    downloadPdf: "下载 PDF",
    footer: "前端展示已连接 FastAPI、JATS 解析器与 PDF 渲染引擎",
  },
  en: {
    brand: "ScholarType",
    subtitle: "JATS Typesetting Portal",
    upload: "Upload",
    library: "Library",
    heroKicker: "Real JATS XML → publication-ready PDF",
    heroTitle: "Turn structured articles into publication layouts",
    heroBody: "Upload JATS XML or a ZIP containing XML and image assets. The backend parses the real article, renders formulas and figures, and produces downloadable HTML and PDF output.",
    dropTitle: "Drop a JATS file here",
    dropHint: ".xml up to 10 MB or an asset .zip up to 50 MB",
    choose: "Choose file",
    converting: "Parsing and preparing the preview…",
    uploadSuccess: "Parsed successfully. Opening the real article preview",
    invalidType: "Choose an .xml or .zip file",
    fileTooLarge: "The file exceeds the size limit",
    features: ["JATS parsing", "MathML", "Figures & xrefs", "1/2 columns", "GB/T 7714", "PDF export"],
    libraryTitle: "Parsed articles",
    libraryBody: "Read real records from the backend database, then preview or export them.",
    search: "Search title, author, abstract, or keyword",
    searchButton: "Search",
    refresh: "Refresh",
    loading: "Loading the article library…",
    empty: "No matching articles found",
    view: "Open layout",
    references: "references",
    sections: "sections",
    figures: "figures",
    formulas: "formulas",
    back: "Back to library",
    preview: "Backend-rendered preview",
    previewLoading: "Rendering the article on the backend…",
    layout: "Layout settings",
    single: "Single",
    double: "Double",
    refStyle: "Reference style",
    fontStyle: "Typography",
    fontSize: "Body size",
    academic: "Academic",
    modern: "Modern",
    international: "International",
    small: "Small",
    medium: "Medium",
    large: "Large",
    downloadHtml: "Download HTML",
    downloadPdf: "Download PDF",
    footer: "The frontend is connected to FastAPI, the JATS parser, and the PDF renderer",
  },
};

async function responseError(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    return payload.detail || payload.message || `${response.status} ${response.statusText}`;
  } catch {
    return `${response.status} ${response.statusText}`;
  }
}

function authorName(author: ArticleAuthor): string {
  return author.name || [author.given_name, author.surname].filter(Boolean).join(" ");
}

function settingsQuery(settings: RenderSettings): string {
  return new URLSearchParams({
    two_column: String(settings.columns === 2),
    ref_style: settings.refStyle,
    font_style: settings.fontStyle,
    font_size: settings.fontSize,
  }).toString();
}

function TopBar({
  lang,
  view,
  onLanguage,
  onNavigate,
}: {
  lang: Language;
  view: PortalView;
  onLanguage: (lang: Language) => void;
  onNavigate: (view: "upload" | "library") => void;
}) {
  const t = copy[lang];
  const active = view === "reader" ? "library" : view;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-4 px-4 sm:px-7">
        <button className="flex items-center gap-2.5" onClick={() => onNavigate("upload")}>
          <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-primary text-primary-foreground">
            <BookOpen size={18} strokeWidth={1.7} />
          </span>
          <span className="text-left">
            <span className="block font-['EB_Garamond'] text-lg font-semibold leading-none text-primary">{t.brand}</span>
            <span className="mt-1 hidden font-['Inter'] text-[10px] text-muted-foreground sm:block">{t.subtitle}</span>
          </span>
        </button>

        <nav className="ml-2 flex h-full items-center gap-1 sm:ml-8">
          <button
            onClick={() => onNavigate("upload")}
            className={`flex h-full items-center gap-2 border-b-2 px-3 font-['Inter'] text-sm transition-colors ${
              active === "upload"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <UploadIcon size={15} />
            {t.upload}
          </button>
          <button
            onClick={() => onNavigate("library")}
            className={`flex h-full items-center gap-2 border-b-2 px-3 font-['Inter'] text-sm transition-colors ${
              active === "library"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Library size={15} />
            {t.library}
          </button>
        </nav>

        <div className="ml-auto flex overflow-hidden rounded-sm border border-border">
          <button
            onClick={() => onLanguage("zh")}
            className={`px-2.5 py-1.5 font-['Inter'] text-xs ${lang === "zh" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            中文
          </button>
          <button
            onClick={() => onLanguage("en")}
            className={`border-l border-border px-2.5 py-1.5 font-['Inter'] text-xs ${lang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            EN
          </button>
        </div>
      </div>
    </header>
  );
}

function UploadPage({ lang, onUploaded }: { lang: Language; onUploaded: (article: ArticleSummary) => void }) {
  const t = copy[lang];
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const uploadFile = useCallback(async (file?: File) => {
    if (!file || busy) return;
    const lower = file.name.toLowerCase();
    const isZip = lower.endsWith(".zip");
    if (!lower.endsWith(".xml") && !isZip) {
      setStatus({ kind: "error", message: t.invalidType });
      return;
    }
    const limit = (isZip ? 50 : 10) * 1024 * 1024;
    if (file.size > limit) {
      setStatus({ kind: "error", message: `${t.fileTooLarge} (${isZip ? "50" : "10"} MB)` });
      return;
    }

    setBusy(true);
    setStatus(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body });
      if (!response.ok) throw new Error(await responseError(response));
      const payload = (await response.json()) as UploadResponse;
      setStatus({ kind: "success", message: t.uploadSuccess });
      window.setTimeout(() => {
        onUploaded({
          id: payload.article_id,
          title: payload.title,
          authors: payload.authors,
          journal: payload.journal,
          doi: payload.doi,
          lang: payload.lang,
          ref_count: payload.ref_count,
          source: "upload",
          original_filename: file.name,
        });
      }, 450);
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [busy, onUploaded, t]);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void uploadFile(event.dataTransfer.files[0]);
  };

  return (
    <main className="flex-1">
      <section className="mx-auto grid max-w-6xl gap-12 px-5 py-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:py-24">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 font-['Inter'] text-xs text-primary">
            <Sparkles size={13} />
            {t.heroKicker}
          </div>
          <h1 className="max-w-xl font-['EB_Garamond'] text-4xl font-normal leading-[1.12] text-foreground sm:text-6xl">
            {t.heroTitle}
          </h1>
          <p className="mt-6 max-w-xl font-['Inter'] text-sm leading-7 text-muted-foreground sm:text-base">{t.heroBody}</p>
          <div className="mt-8 flex flex-wrap gap-2">
            {t.features.map((feature) => (
              <span key={feature} className="rounded-sm border border-border bg-muted/35 px-2.5 py-1 font-['Inter'] text-xs text-muted-foreground">
                {feature}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !busy && inputRef.current?.click()}
            className={`relative flex min-h-[390px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-sm border-2 border-dashed px-8 text-center transition-all ${
              dragging ? "border-primary bg-primary/5 shadow-lg" : "border-border bg-card hover:border-primary/40 hover:bg-primary/[0.02]"
            } ${busy ? "pointer-events-none" : ""}`}
          >
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".xml,.zip,application/xml,text/xml,application/zip"
              onChange={(event) => void uploadFile(event.target.files?.[0])}
            />
            <span className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/5" />
            <span className="absolute -bottom-16 -left-12 h-48 w-48 rounded-full bg-secondary" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-primary">
              {busy ? <Loader2 className="animate-spin" size={25} /> : <UploadIcon size={25} strokeWidth={1.5} />}
            </div>
            <h2 className="relative mt-6 font-['EB_Garamond'] text-2xl text-foreground">{busy ? t.converting : t.dropTitle}</h2>
            <p className="relative mt-2 max-w-sm font-['Inter'] text-xs leading-5 text-muted-foreground">{t.dropHint}</p>
            <button
              type="button"
              disabled={busy}
              className="relative mt-7 rounded-sm bg-primary px-6 py-2.5 font-['Inter'] text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? t.converting : t.choose}
            </button>
          </div>

          {status && (
            <div className={`mt-4 flex items-start gap-2 rounded-sm border px-4 py-3 font-['Inter'] text-sm ${status.kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
              {status.kind === "success" ? <CheckCircle2 className="mt-0.5 shrink-0" size={16} /> : <AlertCircle className="mt-0.5 shrink-0" size={16} />}
              {status.message}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function ArticleCard({ article, lang, onOpen }: { article: ArticleSummary; lang: Language; onOpen: () => void }) {
  const t = copy[lang];
  const authors = (article.authors || []).map(authorName).filter(Boolean).slice(0, 3).join(", ");
  return (
    <article className="group flex h-full flex-col rounded-sm border border-border bg-background p-5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-sm bg-secondary px-2 py-1 font-['Inter'] text-[10px] font-medium uppercase tracking-wide text-secondary-foreground">
          {article.journal || article.lang || "JATS"}
        </span>
        {article.year && <span className="font-['Inter'] text-xs text-muted-foreground">{article.year}</span>}
      </div>
      <h2 className="mt-4 line-clamp-3 font-['EB_Garamond'] text-xl leading-snug text-foreground group-hover:text-primary">{article.title}</h2>
      {authors && <p className="mt-2 line-clamp-1 font-['Inter'] text-xs text-muted-foreground">{authors}</p>}
      {article.abstract && <p className="mt-4 line-clamp-3 font-['Inter'] text-xs leading-5 text-muted-foreground">{article.abstract}</p>}
      <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-5 font-['Inter'] text-[10px] text-muted-foreground">
        <span>{article.section_count || 0} {t.sections}</span>
        <span>{article.figure_count || 0} {t.figures}</span>
        <span>{article.formula_count || 0} {t.formulas}</span>
        <span>{article.ref_count || 0} {t.references}</span>
      </div>
      <button onClick={onOpen} className="mt-4 flex items-center justify-center gap-2 rounded-sm border border-primary/25 px-3 py-2 font-['Inter'] text-xs font-medium text-primary hover:bg-primary hover:text-primary-foreground">
        <Eye size={14} />
        {t.view}
      </button>
    </article>
  );
}

function LibraryPage({ lang, refreshKey, onOpen }: { lang: Language; refreshKey: number; onOpen: (article: ArticleSummary) => void }) {
  const t = copy[lang];
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: "1", per_page: "24", search: submittedQuery });
    fetch(`/api/articles?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response));
        return response.json() as Promise<ArticleListResponse>;
      })
      .then((payload) => {
        setArticles(payload.items);
        setTotal(payload.total);
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [refreshKey, reload, submittedQuery]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmittedQuery(query.trim());
  };

  return (
    <main className="mx-auto w-full max-w-[1500px] flex-1 px-5 py-10 sm:px-7">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <div className="flex items-center gap-2 font-['Inter'] text-xs uppercase tracking-[0.16em] text-primary">
            <Database size={14} />
            API / SQLite
          </div>
          <h1 className="mt-3 font-['EB_Garamond'] text-4xl text-foreground">{t.libraryTitle}</h1>
          <p className="mt-2 font-['Inter'] text-sm text-muted-foreground">{t.libraryBody} {total > 0 && `(${total})`}</p>
        </div>
        <form onSubmit={submit} className="flex w-full max-w-xl gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-sm border border-border bg-background px-3 focus-within:border-primary/50">
            <Search size={15} className="shrink-0 text-muted-foreground" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} className="h-10 min-w-0 flex-1 bg-transparent font-['Inter'] text-sm outline-none" />
          </label>
          <button type="submit" className="rounded-sm bg-primary px-4 font-['Inter'] text-xs text-primary-foreground">{t.searchButton}</button>
          <button type="button" onClick={() => setReload((value) => value + 1)} title={t.refresh} className="rounded-sm border border-border px-3 text-muted-foreground hover:bg-muted hover:text-foreground">
            <RefreshCw size={15} />
          </button>
        </form>
      </div>

      {loading ? (
        <div className="flex min-h-[360px] items-center justify-center gap-3 font-['Inter'] text-sm text-muted-foreground"><Loader2 className="animate-spin" size={18} />{t.loading}</div>
      ) : error ? (
        <div className="mt-10 flex items-start gap-2 rounded-sm border border-red-200 bg-red-50 p-4 font-['Inter'] text-sm text-red-800"><AlertCircle size={17} />{error}</div>
      ) : articles.length === 0 ? (
        <div className="flex min-h-[360px] flex-col items-center justify-center text-muted-foreground"><FileText size={32} strokeWidth={1.2} /><p className="mt-4 font-['Inter'] text-sm">{t.empty}</p></div>
      ) : (
        <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {articles.map((article) => <ArticleCard key={article.id} article={article} lang={lang} onOpen={() => onOpen(article)} />)}
        </div>
      )}
    </main>
  );
}

function Segmented<T extends string | number>({ values, value, onChange }: { values: { value: T; label: string; icon?: React.ReactNode }[]; value: T; onChange: (value: T) => void }) {
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-sm border border-border">
      {values.map((item, index) => (
        <button key={String(item.value)} onClick={() => onChange(item.value)} className={`flex items-center justify-center gap-1.5 px-2 py-2 font-['Inter'] text-xs ${index > 0 ? "border-l border-border" : ""} ${value === item.value ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}>
          {item.icon}{item.label}
        </button>
      ))}
    </div>
  );
}

function ReaderPage({ article, lang, onBack }: { article: ArticleSummary; lang: Language; onBack: () => void }) {
  const t = copy[lang];
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [previewLoading, setPreviewLoading] = useState(true);
  const query = useMemo(() => settingsQuery(settings), [settings]);
  const previewUrl = `/api/articles/${encodeURIComponent(article.id)}/preview?${query}`;
  const authors = (article.authors || []).map(authorName).filter(Boolean).join(", ");

  useEffect(() => setPreviewLoading(true), [previewUrl]);

  const selectClass = "mt-1.5 h-9 w-full rounded-sm border border-border bg-background px-2 font-['Inter'] text-xs text-foreground outline-none focus:border-primary/50";

  return (
    <main className="flex min-h-0 flex-1 flex-col bg-muted/25">
      <div className="border-b border-border bg-background px-4 py-3 sm:px-7">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3">
          <button onClick={onBack} className="flex shrink-0 items-center gap-1.5 rounded-sm border border-border px-3 py-2 font-['Inter'] text-xs text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowLeft size={14} />{t.back}</button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-['Inter'] text-[10px] uppercase tracking-[0.14em] text-primary"><Eye size={12} />{t.preview}</div>
            <h1 className="mt-1 truncate font-['EB_Garamond'] text-lg text-foreground">{article.title}</h1>
            {authors && <p className="truncate font-['Inter'] text-[10px] text-muted-foreground">{authors}</p>}
          </div>
          <div className="ml-auto hidden items-center gap-2 sm:flex">
            <a href={`/api/articles/${encodeURIComponent(article.id)}/html?${query}`} className="flex items-center gap-1.5 rounded-sm border border-border px-3 py-2 font-['Inter'] text-xs text-muted-foreground hover:bg-muted hover:text-foreground"><FileDown size={14} />{t.downloadHtml}</a>
            <a href={`/api/articles/${encodeURIComponent(article.id)}/pdf?${query}`} className="flex items-center gap-1.5 rounded-sm bg-primary px-3 py-2 font-['Inter'] text-xs text-primary-foreground hover:bg-primary/90"><Download size={14} />{t.downloadPdf}</a>
          </div>
        </div>
      </div>

      <div className="mx-auto grid min-h-0 w-full max-w-[1500px] flex-1 gap-4 p-4 lg:grid-cols-[230px_minmax(0,1fr)] sm:p-6">
        <aside className="h-fit rounded-sm border border-border bg-background p-4 lg:sticky lg:top-24">
          <div className="flex items-center gap-2 font-['Inter'] text-xs font-semibold text-foreground"><Languages size={14} className="text-primary" />{t.layout}</div>
          <div className="mt-4">
            <Segmented
              value={settings.columns}
              onChange={(columns) => setSettings((current) => ({ ...current, columns }))}
              values={[{ value: 1, label: t.single, icon: <AlignLeft size={13} /> }, { value: 2, label: t.double, icon: <Columns2 size={13} /> }]}
            />
          </div>
          <label className="mt-4 block font-['Inter'] text-[11px] text-muted-foreground">
            {t.refStyle}
            <select value={settings.refStyle} onChange={(event) => setSettings((current) => ({ ...current, refStyle: event.target.value as RenderSettings["refStyle"] }))} className={selectClass}>
              <option value="elsevier">Elsevier</option>
              <option value="gbt7714">GB/T 7714</option>
            </select>
          </label>
          <label className="mt-4 block font-['Inter'] text-[11px] text-muted-foreground">
            {t.fontStyle}
            <select value={settings.fontStyle} onChange={(event) => setSettings((current) => ({ ...current, fontStyle: event.target.value as RenderSettings["fontStyle"] }))} className={selectClass}>
              <option value="academic">{t.academic}</option>
              <option value="modern">{t.modern}</option>
              <option value="international">{t.international}</option>
            </select>
          </label>
          <label className="mt-4 block font-['Inter'] text-[11px] text-muted-foreground">
            {t.fontSize}
            <select value={settings.fontSize} onChange={(event) => setSettings((current) => ({ ...current, fontSize: event.target.value as RenderSettings["fontSize"] }))} className={selectClass}>
              <option value="small">{t.small}</option>
              <option value="medium">{t.medium}</option>
              <option value="large">{t.large}</option>
            </select>
          </label>
          <div className="mt-5 grid gap-2 sm:hidden">
            <a href={`/api/articles/${encodeURIComponent(article.id)}/html?${query}`} className="flex items-center justify-center gap-1.5 rounded-sm border border-border px-3 py-2 font-['Inter'] text-xs text-muted-foreground"><FileDown size={14} />{t.downloadHtml}</a>
            <a href={`/api/articles/${encodeURIComponent(article.id)}/pdf?${query}`} className="flex items-center justify-center gap-1.5 rounded-sm bg-primary px-3 py-2 font-['Inter'] text-xs text-primary-foreground"><Download size={14} />{t.downloadPdf}</a>
          </div>
        </aside>

        <section className="relative min-h-[720px] overflow-hidden rounded-sm border border-border bg-background shadow-sm">
          {previewLoading && <div className="absolute inset-0 z-10 flex items-center justify-center gap-3 bg-background font-['Inter'] text-sm text-muted-foreground"><Loader2 className="animate-spin" size={18} />{t.previewLoading}</div>}
          <iframe key={previewUrl} title={article.title} src={previewUrl} onLoad={() => setPreviewLoading(false)} className="h-[calc(100vh-180px)] min-h-[720px] w-full border-0 bg-white" />
        </section>
      </div>
    </main>
  );
}

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const initialArticleId = params.get("article");
  const initialView = params.get("view") === "library" ? "library" : "upload";
  const [lang, setLang] = useState<Language>(initialLanguage);
  const [view, setView] = useState<PortalView>(initialArticleId ? "reader" : initialView);
  const [article, setArticle] = useState<ArticleSummary | null>(initialArticleId ? { id: initialArticleId, title: initialArticleId } : null);
  const [refreshKey, setRefreshKey] = useState(0);

  const navigate = useCallback((next: PortalView, selected?: ArticleSummary | null) => {
    setView(next);
    if (selected !== undefined) setArticle(selected);
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("ui_lang", lang);
    if (next === "library") url.searchParams.set("view", "library");
    if (next === "reader" && selected) url.searchParams.set("article", selected.id);
    window.history.pushState({}, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [lang]);

  useEffect(() => {
    try {
      window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // URL 参数仍可在页面之间传递界面语言。
    }
    const url = new URL(window.location.href);
    url.searchParams.set("ui_lang", lang);
    window.history.replaceState({}, "", url);
  }, [lang]);

  useEffect(() => {
    const handlePopState = () => {
      const current = new URLSearchParams(window.location.search);
      const currentLanguage = current.get("ui_lang");
      if (currentLanguage === "zh" || currentLanguage === "en") setLang(currentLanguage);
      const id = current.get("article");
      if (id) {
        setArticle((existing) => existing?.id === id ? existing : { id, title: id });
        setView("reader");
      } else {
        setView(current.get("view") === "library" ? "library" : "upload");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const openArticle = (selected: ArticleSummary) => {
    window.location.assign(`/studio/?article=${encodeURIComponent(selected.id)}&ui_lang=${lang}`);
  };
  const uploaded = (selected: ArticleSummary) => {
    setRefreshKey((value) => value + 1);
    openArticle(selected);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <TopBar lang={lang} view={view} onLanguage={setLang} onNavigate={(next) => navigate(next)} />
      {view === "upload" && <UploadPage lang={lang} onUploaded={uploaded} />}
      {view === "library" && <LibraryPage lang={lang} refreshKey={refreshKey} onOpen={openArticle} />}
      {view === "reader" && article && <ReaderPage article={article} lang={lang} onBack={() => navigate("library")} />}
      {view !== "reader" && <footer className="mt-auto border-t border-border px-5 py-5 text-center font-['Inter'] text-xs text-muted-foreground">{copy[lang].footer}</footer>}
    </div>
  );
}
