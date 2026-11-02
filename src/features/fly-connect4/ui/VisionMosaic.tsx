"use client";

// "Ce que voit la mouche": one hexagon per ommatidium, placed at its viewing direction
// (azimuth / elevation), shaded by the photon catch of the selected photoreceptor type.

import { useEffect, useRef } from "react";
import { RECEPTORS, type Column, type Receptor } from "../vision/eye";

interface Props {
  columns: readonly Column[];
  /** sampleOmmatidia output: catches[i * 5 + r]. */
  catches: Float32Array | null;
  receptor: Receptor;
  /** Field shown, degrees. */
  azRange?: number;
  elRange?: number;
  dphiDeg?: number;
  className?: string;
}

const MAX_CATCH = 0.48; // the light-grey background (palette.background) shows as white

export function VisionMosaic({
  columns,
  catches,
  receptor,
  azRange = 55,
  elRange = 38,
  dphiDeg = 4.9,
  className,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0b0d12";
    ctx.fillRect(0, 0, w, h);
    const scale = Math.min(w / (2 * azRange), h / (2 * elRange));
    // Hex lattice with a vertical neighbour: flat-topped cells of circumradius dPhi/sqrt(3);
    // in azimuth/elevation coordinates cells widen as 1/cos(elevation).
    const r = (dphiDeg / Math.sqrt(3)) * scale * 1.04;
    const ri = RECEPTORS.indexOf(receptor);
    for (let i = 0; i < columns.length; i++) {
      const c = columns[i];
      if (Math.abs(c.az) > azRange + dphiDeg || Math.abs(c.el) > elRange + dphiDeg) continue;
      const v = catches ? Math.min(1, catches[i * RECEPTORS.length + ri] / MAX_CATCH) : 0.15;
      const g = Math.round(255 * v);
      ctx.fillStyle = `rgb(${g},${g},${g})`;
      const x = w / 2 + c.az * scale;
      const y = h / 2 - c.el * scale;
      const sx = 1 / Math.max(0.3, Math.cos((c.el * Math.PI) / 180));
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        ctx.lineTo(x + r * sx * Math.cos(a), y + r * Math.sin(a));
      }
      ctx.fill();
    }
    // Midline: left of it the left eye, right of it the right eye (they overlap in front).
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
  }, [columns, catches, receptor, azRange, elRange, dphiDeg]);

  return (
    <canvas
      ref={ref}
      className={className}
      style={{
        width: "100%",
        maxWidth: 560,
        aspectRatio: `${azRange} / ${elRange}`,
        display: "block",
        borderRadius: 6,
      }}
      role="img"
      aria-label={`Mosaïque des facettes de l'œil de Simone, photorécepteurs ${receptor}`}
    />
  );
}
