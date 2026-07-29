import { Outlet } from "react-router-dom";
import { PlatformHeader } from "./PlatformHeader";

export function Root() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <PlatformHeader />
      <main style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <Outlet />
      </main>
    </div>
  );
}
