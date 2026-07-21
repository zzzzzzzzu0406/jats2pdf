import { Outlet, NavLink } from "react-router-dom";
import { useI18n, LangToggle } from "./i18n";

const SANS = "'Inter', system-ui, sans-serif";
const MONO = "'JetBrains Mono', monospace";

function NavItem({ to, end, label, mono }: { to: string; end?: boolean; label: string; mono?: boolean }) {
  return (
    <NavLink to={to} end={end} style={{ textDecoration: "none" }}>
      {({ isActive }) => (
        <span style={{
          fontFamily: mono ? MONO : SANS,
          fontSize: "0.72rem",
          fontWeight: isActive ? 600 : 400,
          color: isActive ? "#fff" : "rgba(255,255,255,0.45)",
          padding: "4px 10px",
          borderRadius: 5,
          background: isActive ? "rgba(255,255,255,0.12)" : "transparent",
          transition: "all 0.2s",
          cursor: "pointer",
        }}>
          {label}
        </span>
      )}
    </NavLink>
  );
}

export function Root() {
  const { t } = useI18n();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>

      {/* ── UNIFIED NAV BAR ── */}
      <div
        className="no-print"
        style={{
          backgroundColor: "#0a1628",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          height: 38,
          padding: "0 16px",
          gap: 2,
        }}
      >
        {/* Brand */}
        <NavLink to="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", marginRight: 8 }}>
          <span style={{
            fontFamily: SANS, fontWeight: 800, fontSize: "0.78rem",
            letterSpacing: "0.12em", textTransform: "uppercase",
            color: "rgba(255,255,255,0.55)",
          }}>
            ScholarFormat
          </span>
        </NavLink>

        {/* Divider */}
        <span style={{ width: 1, height: 18, background: "rgba(255,255,255,0.10)", margin: "0 8px" }} />

        {/* Portal */}
        <NavItem to="/" end label={t("门户", "Portal")} />

        {/* Journal section */}
        <span style={{ fontFamily: MONO, fontSize: "0.55rem", color: "rgba(255,255,255,0.22)", margin: "0 0 0 12px", letterSpacing: "0.06em" }}>
          {t("期刊", "Journals")}
        </span>
        {[
          { path: "/studio",         label: "ESWA",     end: true },
          { path: "/studio/ieee",     label: "IEEE",     end: false },
          { path: "/studio/springer", label: "Springer", end: false },
          { path: "/studio/nature",   label: "Nature",   end: false },
        ].map((w) => (
          <NavItem key={w.path} to={w.path} end={w.end} label={w.label} mono />
        ))}

        {/* Editor */}
        <span style={{ width: 1, height: 18, background: "rgba(255,255,255,0.10)", margin: "0 8px 0 12px" }} />
        <NavItem to="/editor" label={t("编辑器", "Editor")} />

        {/* Right side: status + language */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontFamily: MONO, fontSize: "0.56rem", color: "rgba(255,255,255,0.18)",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
            API
          </span>
          <LangToggle />
        </div>
      </div>

      {/* ── PAGE CONTENT ── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <Outlet />
      </div>
    </div>
  );
}
