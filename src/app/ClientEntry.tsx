"use client";

import dynamic from "next/dynamic";

// The 3D board, the worker and the brain assets load only on this route, client side.
const Game = dynamic(() => import("@/features/fly-connect4/ui/Game"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: "clamp(340px, 62vw, 640px)",
        borderRadius: 12,
        border: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-muted)",
      }}
    >
      Chargement du plateau…
    </div>
  ),
});

export function ClientEntry() {
  return <Game />;
}
