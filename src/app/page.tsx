"use client";

import { useState, useEffect } from "react";

function Icon({
  name,
  size = 20,
  fill = false,
  className = "",
}: {
  name: string;
  size?: number;
  fill?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`material-symbols-outlined select-none leading-none ${className}`}
      style={{ fontSize: size, fontVariationSettings: fill ? "'FILL' 1" : "'FILL' 0" }}
    >
      {name}
    </span>
  );
}

// ── Delivery Confidence gauge ─────────────────────────────────────────────────
const R = 44;
const CIRC = 2 * Math.PI * R;

function DeliveryGauge({ pct }: { pct: number }) {
  const offset = CIRC * (1 - pct / 100);
  return (
    <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={R} fill="transparent" stroke="#2B3648" strokeWidth="4" />
        <circle
          cx="48" cy="48" r={R}
          fill="transparent"
          stroke="#50dbcb"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          strokeWidth="4"
          strokeLinecap="butt"
        />
      </svg>
      <span className="absolute font-stat-lg text-stat-lg text-on-surface">{pct}%</span>
    </div>
  );
}

// ── Static data ───────────────────────────────────────────────────────────────
const APPROVALS = [
  {
    id: "#NX-99201", initials: "JD", name: "J. Danvers",
    type: "Vector Scale Adjustment", urgency: "Standard",
    urgencyStyle: "border-primary/30 text-primary",
  },
  {
    id: "#NX-99184", initials: "SM", name: "S. Miller",
    type: "Neural Weight Override", urgency: "High Priority",
    urgencyStyle: "border-critical/30 text-critical",
  },
  {
    id: "#NX-98742", initials: "AI", name: "AUTO_GOV",
    type: "Cluster Recalibration", urgency: "Routine",
    urgencyStyle: "border-on-surface-variant/30 text-on-surface-variant",
  },
];

const ESCALATIONS = [
  {
    title: "Compliance Breach: SEC-04",
    level: "CRITICAL",
    levelClass: "text-critical",
    detail: "Unexpected API egress detected in Node Cluster VII...",
  },
  {
    title: "Drift Alert: L-Model-2",
    level: "WARNING",
    levelClass: "text-tertiary",
    detail: "Performance deviation observed in localized logic unit...",
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CommandCenter() {
  const [time, setTime] = useState("");
  const [cells, setCells] = useState<string[]>([]);

  useEffect(() => {
    setTime(new Date().toISOString());
    const tick = setInterval(() => setTime(new Date().toISOString()), 1000);

    // Deterministic-looking heatmap using sine hash
    setCells(
      Array.from({ length: 240 }, (_, i) => {
        const v = Math.abs(Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1;
        if (v > 0.95) return "#D64545";
        if (v > 0.80) return "#ffba3e";
        if (v > 0.30) return "#1C2635";
        return "#151D2A";
      })
    );

    return () => clearInterval(tick);
  }, []);

  return (
    <>
      {/* ── Top Bar ── */}
      <header className="h-16 px-xl flex justify-between items-center border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <div className="flex items-center gap-xl">
          <h1 className="font-display-lg text-display-lg text-primary tracking-tight">NexoriOS</h1>
          <div className="relative flex items-center">
            <Icon name="search" size={16} className="absolute left-3 text-on-surface-variant" />
            <input
              className="bg-surface-container-low border border-border-muted text-on-surface text-body-base px-10 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary min-w-[320px] rounded-none placeholder:text-on-surface-variant"
              placeholder="Search parameters..."
              type="text"
            />
          </div>
        </div>
        <div className="flex items-center gap-lg">
          <div className="flex gap-md border-r border-border-muted pr-lg">
            {["notifications", "settings", "help"].map((icon) => (
              <button key={icon} className="text-on-surface-variant hover:text-primary transition-colors active:scale-95">
                <Icon name={icon} />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-md cursor-pointer">
            <div className="w-8 h-8 bg-border-muted border border-border-muted flex items-center justify-center font-mono-technical text-[10px] text-on-surface">
              MT
            </div>
            <div className="hidden lg:block">
              <p className="font-body-bold text-body-bold text-on-surface">Dir. Marcus Thorne</p>
              <p className="font-mono-technical text-[10px] text-primary">LVL-9 ADMIN</p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Dashboard Canvas ── */}
      <div className="flex-1 overflow-y-auto p-xl custom-scrollbar">
        <div className="max-w-[1440px] mx-auto grid grid-cols-12 gap-lg">

          {/* Left — 8 cols */}
          <div className="col-span-12 lg:col-span-8 grid grid-cols-12 gap-lg">

            {/* Governance Health Score */}
            <div className="col-span-12 md:col-span-7 bg-surface border border-border-muted p-xl flex flex-col justify-between min-h-[160px]">
              <div>
                <div className="flex items-center justify-between mb-lg">
                  <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
                    GOVERNANCE HEALTH SCORE
                  </h3>
                  <Icon name="verified" size={20} fill className="text-primary" />
                </div>
                <div className="flex items-baseline gap-md">
                  <span className="font-display-lg leading-none font-bold text-on-surface" style={{ fontSize: 64 }}>
                    94.2
                  </span>
                  <span className="font-mono-technical text-body-bold text-primary">+1.4% (24H)</span>
                </div>
              </div>
              <div className="mt-xl">
                <div className="w-full h-[3px] bg-surface-container-highest relative">
                  <div className="absolute top-0 left-0 h-full bg-primary" style={{ width: "94.2%" }} />
                </div>
                <div className="flex justify-between mt-sm font-mono-technical text-[10px] text-on-surface-variant">
                  <span>PROTOCOL COMPLIANCE</span>
                  <span>CRITICAL THRESHOLD: 85%</span>
                </div>
              </div>
            </div>

            {/* Operational Status */}
            <div className="col-span-12 md:col-span-5 bg-surface border border-border-muted p-xl">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-lg">
                OPERATIONAL STATUS
              </h3>
              <div className="space-y-md">
                {[
                  { dot: "bg-primary animate-pulse", label: "Core Engines", value: "NOMINAL", valueClass: "text-on-surface" },
                  { dot: "bg-primary", label: "Network Grid", value: "ACTIVE", valueClass: "text-on-surface" },
                  { dot: "bg-tertiary", label: "Latency Layer", value: "WARN 42ms", valueClass: "text-tertiary" },
                ].map((row, i, arr) => (
                  <div key={row.label} className={`flex items-center justify-between py-xs ${i < arr.length - 1 ? "border-b border-border-muted" : ""}`}>
                    <div className="flex items-center gap-md">
                      <div className={`w-2 h-2 rounded-full ${row.dot}`} />
                      <span className="font-body-bold text-body-bold text-on-surface">{row.label}</span>
                    </div>
                    <span className={`font-mono-technical text-[11px] ${row.valueClass}`}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Global Risk Topology — Heatmap */}
            <div className="col-span-12 bg-surface border border-border-muted p-xl">
              <div className="flex items-center justify-between mb-xl">
                <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
                  GLOBAL RISK TOPOLOGY
                </h3>
                <div className="flex gap-md">
                  {[
                    { bg: "bg-surface-container-highest", label: "IDLE" },
                    { bg: "bg-primary", label: "SAFE" },
                    { bg: "bg-tertiary", label: "RISK" },
                    { bg: "bg-critical", label: "CRIT" },
                  ].map(({ bg, label }) => (
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
          </div>

          {/* Right — 4 cols */}
          <div className="col-span-12 lg:col-span-4 space-y-lg">

            {/* Delivery Confidence */}
            <div className="bg-surface border border-border-muted p-xl flex flex-col justify-between" style={{ minHeight: 192 }}>
              <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
                DELIVERY CONFIDENCE
              </h3>
              <div className="flex items-center gap-lg mt-lg">
                <DeliveryGauge pct={87} />
                <div className="flex-1 space-y-sm">
                  <p className="font-mono-technical text-[11px] text-on-surface-variant uppercase">Key Drivers</p>
                  <ul className="space-y-xs">
                    <li className="flex items-center justify-between">
                      <span className="text-[10px] font-mono-technical text-on-surface-variant">RESOURCES</span>
                      <span className="text-primary text-[10px] font-mono-technical">OPTIMAL</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-[10px] font-mono-technical text-on-surface-variant">VELOCITY</span>
                      <span className="text-tertiary text-[10px] font-mono-technical">+2.1%</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* AI Governance Unit */}
            <div className="bg-surface-elevated border border-primary p-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2 opacity-10 pointer-events-none">
                <Icon name="smart_toy" size={80} fill />
              </div>
              <h3 className="font-label-caps text-label-caps text-primary tracking-widest mb-lg">
                AI GOVERNANCE UNIT
              </h3>
              <div className="space-y-md relative z-10">
                <span className="px-2 py-0.5 bg-primary/10 border border-primary text-primary font-mono-technical text-[10px]">
                  AUTH_MODE: STRICT
                </span>
                <p className="font-body-base text-body-base text-on-surface-variant leading-relaxed">
                  Neural weights stabilized at epoch 402. Alignment drift currently within{" "}
                  <span className="text-primary">0.003</span> variance.
                </p>
                <div className="flex items-center justify-between pt-md border-t border-border-muted">
                  <span className="font-mono-technical text-[10px] text-on-surface-variant">SAFETY_LOCK: ENGAGED</span>
                  <Icon name="security" size={16} className="text-primary" />
                </div>
              </div>
            </div>

            {/* Active Escalations */}
            <div className="bg-surface border border-border-muted">
              <div className="p-lg border-b border-border-muted flex items-center justify-between">
                <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
                  ACTIVE ESCALATIONS
                </h3>
                <span className="px-2 py-0.5 bg-critical text-on-error font-mono-technical text-[10px]">
                  03 ACTIVE
                </span>
              </div>
              <div className="divide-y divide-border-muted">
                {ESCALATIONS.map((e) => (
                  <div key={e.title} className="p-lg hover:bg-surface-container-high transition-colors cursor-pointer">
                    <div className="flex justify-between mb-1">
                      <span className="font-body-bold text-body-bold text-on-surface">{e.title}</span>
                      <span className={`font-mono-technical text-[11px] ${e.levelClass}`}>{e.level}</span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant font-mono-technical truncate">{e.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Approval Pipeline — full width */}
          <div className="col-span-12">
            <div className="bg-surface border border-border-muted overflow-hidden">
              <div className="p-xl border-b border-border-muted flex justify-between items-center">
                <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
                  APPROVAL PIPELINE
                </h3>
                <button className="text-primary font-mono-technical text-[11px] hover:underline">
                  VIEW ALL QUEUED REQUESTS (14)
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-surface-container-low border-b border-border-muted">
                    <tr>
                      {["REQUEST_ID", "INITIATOR", "PROTOCOL_TYPE", "URGENCY", "ACTION"].map((h, i) => (
                        <th key={h} className={`px-xl py-md font-label-caps text-label-caps text-on-surface-variant ${i === 4 ? "text-right" : ""}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-muted">
                    {APPROVALS.map((row) => (
                      <tr key={row.id} className="hover:bg-surface-container-highest transition-colors">
                        <td className="px-xl py-md font-mono-technical text-[12px] text-on-surface">{row.id}</td>
                        <td className="px-xl py-md">
                          <div className="flex items-center gap-md">
                            <div className="w-6 h-6 bg-border-muted flex items-center justify-center font-mono-technical text-[10px] text-on-surface">
                              {row.initials}
                            </div>
                            <span className="font-body-base text-body-base text-on-surface">{row.name}</span>
                          </div>
                        </td>
                        <td className="px-xl py-md font-body-base text-body-base text-on-surface">{row.type}</td>
                        <td className="px-xl py-md">
                          <span className={`px-2 py-0.5 border font-mono-technical text-[10px] uppercase ${row.urgencyStyle}`}>
                            {row.urgency}
                          </span>
                        </td>
                        <td className="px-xl py-md text-right">
                          <button className="bg-primary text-on-primary font-label-caps text-label-caps px-4 py-1.5 hover:brightness-110 active:scale-95 transition-all">
                            APPROVE
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Status Bar ── */}
      <footer className="h-8 bg-surface-container-low border-t border-border-muted flex items-center justify-between px-xl font-mono-technical text-[10px] text-on-surface-variant shrink-0">
        <div className="flex items-center gap-xl">
          <div className="flex items-center gap-xs">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span>SYSTEM_ACTIVE</span>
          </div>
          <div className="flex items-center gap-xs">
            <Icon name="database" size={10} />
            <span>DB_CLUSTER_READY: 0.002ms</span>
          </div>
          <div className="flex items-center gap-xs">
            <Icon name="shield" size={10} />
            <span>ENCRYPTION: AES-256-GCM</span>
          </div>
        </div>
        <div className="flex items-center gap-lg">
          <span>{time}</span>
          <span className="font-bold text-on-surface">v0.1.0-MVP</span>
        </div>
      </footer>
    </>
  );
}
