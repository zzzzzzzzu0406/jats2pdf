import { Outlet, NavLink } from "react-router";

const SANS = "'Inter', system-ui, sans-serif";
const MONO = "'JetBrains Mono', monospace";

export function Root() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>

      {/* ── THIN BRAND BAR (no journal switching) ── */}
      <div
        className="no-print"
        style={{
          backgroundColor: "#070f1c",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          height: 30,
          padding: "0 16px",
        }}
      >
        <span style={{
          fontFamily: SANS, fontWeight: 800, fontSize: "0.63rem",
          letterSpacing: "0.16em", textTransform: "uppercase",
          color: "rgba(255,255,255,0.5)",
        }}>
          ScholarFormat
        </span>
        <span style={{
          marginLeft: 10, paddingLeft: 10,
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          fontFamily: MONO, fontSize: "0.56rem",
          color: "rgba(255,255,255,0.18)",
          letterSpacing: "0.04em",
        }}>
          Academic Publishing Platform · JATS XML Engine
        </span>

        {/* status dot */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "#22c55e" }} />
          <span style={{ fontFamily: MONO, fontSize: "0.55rem", color: "rgba(255,255,255,0.18)", letterSpacing: "0.04em" }}>
            engine active
          </span>
        </div>

        {/* dev-only demo nav — minimal, clearly not a journal switcher */}
        <div style={{ marginLeft: 20, display: "flex", alignItems: "center", gap: 0, paddingLeft: 16, borderLeft: "1px solid rgba(255,255,255,0.06)" }}>
          <span style={{ fontFamily: MONO, fontSize: "0.52rem", color: "rgba(255,255,255,0.12)", marginRight: 8, letterSpacing: "0.06em" }}>
            demo:
          </span>
          {[
            { path: "/",         label: "ESWA",     end: true  },
            { path: "/ieee",     label: "IEEE",     end: false },
            { path: "/springer", label: "Springer", end: false },
            { path: "/nature",   label: "Nature",   end: false },
          ].map((w) => (
            <NavLink key={w.path} to={w.path} end={w.end} style={{ textDecoration: "none" }}>
              {({ isActive }) => (
                <span style={{
                  fontFamily: MONO, fontSize: "0.58rem",
                  color: isActive ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.15)",
                  padding: "0 6px",
                  fontWeight: isActive ? 700 : 400,
                  letterSpacing: "0.05em",
                }}>
                  {w.label}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </div>

      {/* ── PAGE CONTENT ── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <Outlet />
      </div>
    </div>
  );
}
