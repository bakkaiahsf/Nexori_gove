"use client";

import { useMemo } from "react";

const LEGEND = [
  { bg: "bg-surface-container-highest", label: "IDLE" },
  { bg: "bg-primary", label: "SAFE" },
  { bg: "bg-tertiary", label: "RISK" },
  { bg: "bg-critical", label: "CRIT" },
];

// Seeded deterministic palette — no hydration mismatch
function cellColor(i: number, criticalRisks: number, openRisks: number): string {
  const v = Math.abs(Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1;
  const critPct = criticalRisks / Math.max(openRisks, 1);
  if (v > 1 - critPct * 0.12) return "#D64545";
  if (v > 0.82) return "#ffba3e";
  if (v > 0.30) return "#1C2635";
  return "#151D2A";
}

export default function HeatmapClient({
  criticalRisks,
  openRisks,
}: {
  criticalRisks: number;
  openRisks: number;
}) {
  const cells = useMemo(
    () => Array.from({ length: 240 }, (_, i) => cellColor(i, criticalRisks, openRisks)),
    [criticalRisks, openRisks]
  );

  return (
    <div className="col-span-12 bg-surface border border-border-muted p-xl">
      <div className="flex items-center justify-between mb-xl">
        <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
          GLOBAL RISK TOPOLOGY
        </h3>
        <div className="flex gap-md">
          {LEGEND.map(({ bg, label }) => (
            <div key={label} className="flex items-center gap-xs">
              <div className={`w-2 h-2 ${bg}`} />
              <span className="text-[10px] font-mono-technical text-on-surface-variant">{label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-px bg-border-muted">
        {cells.map((color, i) => (
          <div key={i} className="heatmap-cell h-4 md:h-5" style={{ backgroundColor: color }} />
        ))}
      </div>
      <div className="mt-md flex justify-between font-mono-technical text-[10px] text-on-surface-variant">
        <span>REGION_ALPHA // SUB_SECTOR_01</span>
        <span>REAL-TIME TELEMETRY FEED ACTIVE</span>
      </div>
    </div>
  );
}
