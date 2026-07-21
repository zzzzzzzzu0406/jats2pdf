import { createContext, useContext, useState, useCallback } from "react";

export type UiLang = "zh" | "en";
export type ContentLang = "en" | "zh" | "both";

const UI_LANG_KEY = "scholartype-ui-language";
const CONTENT_LANG_KEY = "scholartype-content-language";

function readInitial<T extends string>(key: string, fallback: T, valid: T[]): T {
  try {
    const param = new URLSearchParams(window.location.search).get("ui_lang");
    if (key === UI_LANG_KEY && param && (param === "zh" || param === "en")) return param as T;
    const stored = window.localStorage.getItem(key);
    if (stored && valid.includes(stored as T)) return stored as T;
  } catch { /* noop */ }
  return fallback;
}

interface I18nCtx {
  ui: UiLang;
  setUi: (l: UiLang) => void;
  t: (zh: string, en: string) => string;
  contentLang: ContentLang;
  setContentLang: (l: ContentLang) => void;
  contentLabel: (l: ContentLang) => string;
}

const Ctx = createContext<I18nCtx>({
  ui: "zh", setUi: () => {}, t: (z) => z,
  contentLang: "en", setContentLang: () => {}, contentLabel: () => "EN",
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const initialUi = readInitial(UI_LANG_KEY, "zh", ["zh", "en"]);
  const [ui, setUiRaw] = useState<UiLang>(initialUi);
  const [contentLang, setContentLangRaw] = useState<ContentLang>(
    () => readInitial(CONTENT_LANG_KEY, initialUi as ContentLang, ["en", "zh", "both"])
  );

  const setUi = useCallback((l: UiLang) => {
    setUiRaw(l);
    try { window.localStorage.setItem(UI_LANG_KEY, l); } catch {}
    // UI language switch also changes content language for consistency
    setContentLangRaw(l);  // "zh" → content zh, "en" → content en
    try { window.localStorage.setItem(CONTENT_LANG_KEY, l); } catch {}
  }, []);

  const setContentLang = useCallback((l: ContentLang) => {
    setContentLangRaw(l);
    try { window.localStorage.setItem(CONTENT_LANG_KEY, l); } catch {}
  }, []);

  const t = useCallback((zh: string, en: string) => ui === "zh" ? zh : en, [ui]);

  const contentLabel = useCallback((l: ContentLang) => {
    return l === "en" ? (ui === "zh" ? "英文" : "EN") : l === "zh" ? (ui === "zh" ? "中文" : "ZH") : (ui === "zh" ? "双语" : "Both");
  }, [ui]);

  return <Ctx.Provider value={{ ui, setUi, t, contentLang, setContentLang, contentLabel }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}

/** 全局 UI 语言切换 */
export function LangToggle({ style }: { style?: React.CSSProperties }) {
  const { ui, setUi } = useI18n();
  const btn = (label: string, lang: UiLang) => (
    <button
      onClick={() => setUi(lang)}
      style={{
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: "0.68rem",
        fontWeight: ui === lang ? 700 : 400,
        color: ui === lang ? "#fff" : "rgba(255,255,255,0.35)",
        background: ui === lang ? "rgba(255,255,255,0.10)" : "transparent",
        border: "1px solid " + (ui === lang ? "rgba(255,255,255,0.20)" : "rgba(255,255,255,0.06)"),
        borderRadius: 4,
        padding: "2px 8px",
        cursor: "pointer",
        transition: "all 0.15s",
        ...style,
      }}
    >
      {label}
    </button>
  );
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
      {btn("中文", "zh")}
      {btn("EN", "en")}
    </div>
  );
}

/** 内容语言三态切换 (EN / ZH / 双语) */
export function ContentLangToggle({ style }: { style?: React.CSSProperties }) {
  const { contentLang, setContentLang, contentLabel } = useI18n();
  return (
    <div style={{ display: "flex", gap: 1, alignItems: "center", ...style }}>
      {(["en", "zh", "both"] as ContentLang[]).map((l) => (
        <button
          key={l}
          onClick={() => setContentLang(l)}
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: "0.65rem",
            fontWeight: contentLang === l ? 600 : 400,
            color: contentLang === l ? "#fff" : "rgba(255,255,255,0.40)",
            background: contentLang === l ? "rgba(255,255,255,0.12)" : "transparent",
            border: "1px solid " + (contentLang === l ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)"),
            borderRadius: 4,
            padding: "3px 9px",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          {contentLabel(l)}
        </button>
      ))}
    </div>
  );
}
