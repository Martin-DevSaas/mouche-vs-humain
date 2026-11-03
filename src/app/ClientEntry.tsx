"use client";

import dynamic from "next/dynamic";
import { useT } from "@/features/fly-connect4/ui/i18n";

// The 3D board, the worker and the brain assets load only on this route, client side.
const Game = dynamic(() => import("@/features/fly-connect4/ui/Game"), {
  ssr: false,
  loading: () => <Loading />,
});

export function ClientEntry() {
  return <Game />;
}

function Loading() {
  const t = useT();
  return (
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
      {t.game.loadingBoard}
    </div>
  );
}
