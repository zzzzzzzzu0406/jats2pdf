import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import { I18nProvider } from "./i18n";
import { Root } from "./Root";
import PortalApp from "./PortalApp";

/* ─── lazy-loaded journal pages ───────────────────────────────────── */
const App          = lazy(() => import("./App"));
const ElsevierPage = lazy(() => import("./ElsevierPage").then(m => ({ default: m.ElsevierPage })));
const IEEEPage     = lazy(() => import("./IEEEPage").then(m => ({ default: m.IEEEPage })));
const SpringerPage = lazy(() => import("./SpringerPage").then(m => ({ default: m.SpringerPage })));
const NaturePage   = lazy(() => import("./NaturePage").then(m => ({ default: m.NaturePage })));

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<Loading />}>{children}</Suspense>;
}

function Loading() {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100%", fontFamily: "'Inter', system-ui, sans-serif",
      fontSize: "0.85rem", color: "#6b7280", backgroundColor: "#f8fafc",
    }}>
      Loading…
    </div>
  );
}

function withI18n(el: React.ReactNode) {
  return <I18nProvider>{el}</I18nProvider>;
}

export const router = createBrowserRouter([
  // Portal at /
  {
    path: "/",
    element: withI18n(<Root />),
    children: [
      { index: true, element: <PortalApp /> },
    ],
  },
  // Studio journal pages at /studio (lazy-loaded)
  {
    path: "/studio",
    element: withI18n(<Root />),
    children: [
      { index: true, element: <Lazy><ElsevierPage /></Lazy> },
      { path: "ieee",     element: <Lazy><IEEEPage /></Lazy> },
      { path: "springer", element: <Lazy><SpringerPage /></Lazy> },
      { path: "nature",   element: <Lazy><NaturePage /></Lazy> },
      { path: "editor",   element: <Lazy><App /></Lazy> },
    ],
  },
  // Editor standalone at /editor (lazy-loaded)
  {
    path: "/editor",
    element: withI18n(<Root />),
    children: [
      { index: true, element: <Lazy><App /></Lazy> },
    ],
  },
]);
