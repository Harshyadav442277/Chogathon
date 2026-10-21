"use client";
import dynamic from "next/dynamic";

// WebGL only exists in the browser.
const WorldClient = dynamic(() => import("@/world/WorldClient"), {
  ssr: false,
  loading: () => <div className="w-loading">Summoning Monadia…</div>,
});

export default function WorldLoader() {
  return <WorldClient />;
}
