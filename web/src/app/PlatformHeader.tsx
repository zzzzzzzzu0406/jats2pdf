import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Activity, BookOpen, Menu, X } from "lucide-react";
import { LangToggle, useI18n } from "./i18n";

type JournalKey = "elsevier" | "ieee" | "springer" | "nature";

const JOURNALS: Array<{
  key: JournalKey;
  label: string;
  short: string;
  path: string;
  samplePath: string;
  accent: string;
}> = [
  { key: "elsevier", label: "Elsevier", short: "ESWA", path: "/studio", samplePath: "/samples/elsevier", accent: "#c0392b" },
  { key: "ieee", label: "IEEE", short: "IEEE", path: "/studio/ieee", samplePath: "/samples/ieee", accent: "#00629b" },
  { key: "springer", label: "Springer", short: "SPR", path: "/studio/springer", samplePath: "/samples/springer", accent: "#1565c0" },
  { key: "nature", label: "Nature", short: "NAT", path: "/studio/nature", samplePath: "/samples/nature", accent: "#c0000a" },
];

function currentJournal(pathname: string, search: string): JournalKey | null {
  if (pathname === "/studio/editor") {
    const requested = new URLSearchParams(search).get("journal");
    return JOURNALS.some((journal) => journal.key === requested) ? requested as JournalKey : "elsevier";
  }
  const match = JOURNALS.find((journal) => pathname === journal.path || pathname === journal.samplePath);
  return match?.key || null;
}

function navStyle(active: boolean, accent?: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 34,
    padding: "0 10px",
    borderRadius: 4,
    border: active ? `1px solid ${accent || "rgba(255,255,255,0.24)"}` : "1px solid transparent",
    background: active ? "rgba(255,255,255,0.12)" : "transparent",
    color: active ? "#fff" : "rgba(255,255,255,0.62)",
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: "0.72rem",
    fontWeight: active ? 650 : 450,
    textDecoration: "none",
    whiteSpace: "nowrap",
    transition: "color 160ms ease, background 160ms ease, border-color 160ms ease",
  };
}

export function PlatformHeader() {
  const { t } = useI18n();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const sampleMode = location.pathname.startsWith("/samples");
  const activeJournal = currentJournal(location.pathname, location.search);
  const activeDetails = JOURNALS.find((journal) => journal.key === activeJournal);

  const links: Array<{ label: string; to: string; active: boolean; accent?: string }> = [
    { label: t("门户", "Portal"), to: "/", active: location.pathname === "/" },
    ...JOURNALS.map((journal) => ({
      label: journal.label,
      to: sampleMode ? journal.samplePath : journal.path,
      active: activeJournal === journal.key,
      accent: journal.accent,
    })),
  ];

  return (
    <header
      className="no-print"
      style={{
        position: "relative",
        zIndex: 40,
        flexShrink: 0,
        background: "#0f2744",
        borderBottom: "1px solid rgba(255,255,255,0.12)",
        color: "#fff",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <div style={{ minHeight: 58, display: "flex", alignItems: "center", gap: 16, padding: "0 18px" }}>
        <Link to="/" aria-label="ScholarFormat home" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none", flexShrink: 0 }}>
          <span style={{ width: 28, height: 28, display: "grid", placeItems: "center", border: "1px solid rgba(255,255,255,0.24)", borderRadius: 5, color: "#fff" }}>
            <BookOpen size={15} strokeWidth={1.7} />
          </span>
          <span>
            <strong style={{ display: "block", color: "#fff", fontSize: "0.77rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>ScholarFormat</strong>
            <span className="hidden sm:block" style={{ marginTop: 2, color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.53rem", letterSpacing: "0.04em" }}>Academic Publishing Platform</span>
          </span>
        </Link>

        <nav className="hidden lg:flex" aria-label={t("主导航", "Primary navigation")} style={{ alignItems: "center", gap: 3, marginLeft: 8 }}>
          <span style={{ width: 1, height: 22, background: "rgba(255,255,255,0.14)", marginRight: 5 }} />
          {links.map((link) => (
            <Link key={link.to} to={link.to} aria-current={link.active ? "page" : undefined} style={navStyle(link.active, link.accent)}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex" style={{ alignItems: "center", gap: 12, marginLeft: "auto" }}>
          {activeDetails && (
            <div style={{ display: "flex", alignItems: "center", gap: 7, paddingLeft: 12, borderLeft: "1px solid rgba(255,255,255,0.14)" }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: activeDetails.accent }} />
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.64rem" }}>{t("当前期刊", "Current journal")}</span>
              <strong style={{ color: "#fff", fontSize: "0.7rem" }}>{activeDetails.short}</strong>
            </div>
          )}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "rgba(255,255,255,0.42)", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.58rem" }}>
            <Activity size={12} color="#4ade80" /> API
          </span>
          <LangToggle />
        </div>

        <button
          type="button"
          className="grid place-items-center lg:hidden"
          aria-label={mobileOpen ? t("关闭导航", "Close navigation") : t("打开导航", "Open navigation")}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((open) => !open)}
          style={{ marginLeft: "auto", width: 32, height: 32, color: "#fff", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 4, cursor: "pointer" }}
        >
          {mobileOpen ? <X size={16} /> : <Menu size={16} />}
        </button>
      </div>

      {mobileOpen && (
        <nav className="grid gap-1 lg:hidden" aria-label={t("页面导航", "Page navigation")} style={{ padding: "8px 14px 12px", borderTop: "1px solid rgba(255,255,255,0.1)", background: "#102d4e" }}>
          {links.map((link) => (
            <Link key={link.to} to={link.to} aria-current={link.active ? "page" : undefined} onClick={() => setMobileOpen(false)} style={{ ...navStyle(link.active, link.accent), width: "100%", justifyContent: "flex-start" }}>
              {link.label}
            </Link>
          ))}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px 2px", borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: 4 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "rgba(255,255,255,0.45)", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.58rem" }}><Activity size={12} color="#4ade80" /> API online</span>
            <LangToggle />
          </div>
        </nav>
      )}
    </header>
  );
}
