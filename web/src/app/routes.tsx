import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import { I18nProvider } from "./i18n";
import { Root } from "./Root";
import PortalApp from "./PortalApp";

/* ─── lazy-loaded journal modes ───────────────────────────────────── */
const ElsevierPage = lazy(() => import("./ElsevierPage").then((module) => ({ default: module.ElsevierPage })));
const IEEEPage     = lazy(() => import("./IEEEPage").then((module) => ({ default: module.IEEEPage })));
const SpringerPage = lazy(() => import("./SpringerPage").then((module) => ({ default: module.SpringerPage })));
const NaturePage   = lazy(() => import("./NaturePage").then((module) => ({ default: module.NaturePage })));
const ArticleEditorPage = lazy(() => import("./ArticleEditorPage").then((module) => ({ default: module.default })));

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
  // Each journal keeps its original editor mode and visual system.
  {
    path: "/studio",
    element: withI18n(<Root />),
    children: [
      { index: true, element: <Lazy><ElsevierPage /></Lazy> },
      { path: "editor",   element: <Lazy><ArticleEditorPage /></Lazy> },
      { path: "ieee",     element: <Lazy><IEEEPage /></Lazy> },
      { path: "springer", element: <Lazy><SpringerPage /></Lazy> },
      { path: "nature",   element: <Lazy><NaturePage /></Lazy> },
    ],
  },
  // The same original pages remain available as explicit visual samples.
  {
    path: "/samples",
    element: withI18n(<Root />),
    children: [
      { path: "elsevier", element: <Lazy><ElsevierPage /></Lazy> },
      { path: "ieee",     element: <Lazy><IEEEPage /></Lazy> },
      { path: "springer", element: <Lazy><SpringerPage /></Lazy> },
      { path: "nature",   element: <Lazy><NaturePage /></Lazy> },
    ],
  },
]);
