const MODES = [
  {
    id: "strict",
    label: "Strict Compliance",
    desc: "Maximum oversight. Human approval required for all AI actions.",
    active: true,
  },
  {
    id: "balanced",
    label: "Balanced Growth",
    desc: "Automated thresholds. Exceptions routed to human review.",
    active: false,
  },
  {
    id: "unrestricted",
    label: "Unrestricted Discovery",
    desc: "Minimal guardrails. Within policy bounds.",
    active: false,
  },
];

const MODELS = [
  { id: "nexori-large-3.1", arch: "Transformer (MoE)", status: "ACTIVE", safety: 98, latency: "112ms" },
  { id: "aura-vision-beta", arch: "Vision Encoder", status: "RESTRICTED", safety: 74, latency: "438ms" },
];

const APPROVALS = [
  { id: "MWU-07", label: "Model Weight Update", urgency: "CRITICAL", urgencyClass: "text-critical" },
  { id: "PO-412", label: "Policy Override", urgency: "ADVISORY", urgencyClass: "text-tertiary" },
];

export default function AIControl() {
  return (
    <>
      <header className="h-16 px-xl flex items-center justify-between border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <h1 className="font-headline-md text-headline-md text-on-surface">AI Control Center</h1>
        <div className="flex items-center gap-md">
          <span className="px-2 py-1 bg-primary/10 border border-primary text-primary font-mono-technical text-[10px]">
            SYSTEM ARMED — STRICT GOVERNANCE
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-xl">
        <div className="max-w-[1440px] mx-auto grid grid-cols-12 gap-lg">

          {/* Emergency Protocol */}
          <div className="col-span-12 md:col-span-4 bg-surface-elevated border border-critical p-xl">
            <h3 className="font-label-caps text-label-caps text-critical tracking-widest mb-sm">EMERGENCY PROTOCOL</h3>
            <p className="font-mono-technical text-[11px] text-on-surface-variant mb-lg">
              Master Kill Switch
            </p>
            <p className="font-body-base text-body-base text-on-surface-variant mb-xl">
              Requires Executive multi-sig authorization to engage.
            </p>
            <button className="w-full bg-critical text-on-error font-label-caps text-label-caps py-md hover:brightness-110 active:scale-95 transition-all uppercase tracking-widest">
              Initiate Shutdown
            </button>
          </div>

          {/* Governance Mode */}
          <div className="col-span-12 md:col-span-4 bg-surface border border-border-muted p-xl">
            <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-lg">GOVERNANCE MODE</h3>
            <div className="space-y-sm">
              {MODES.map((m) => (
                <div
                  key={m.id}
                  className={`p-md border cursor-pointer transition-colors ${
                    m.active
                      ? "border-primary bg-primary/5 text-on-surface"
                      : "border-border-muted text-on-surface-variant hover:border-on-surface-variant"
                  }`}
                >
                  <div className="flex items-center justify-between mb-xs">
                    <span className="font-body-bold text-body-bold">{m.label}</span>
                    {m.active && <span className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <p className="font-mono-technical text-[11px] opacity-70">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Human-in-Loop Approvals */}
          <div className="col-span-12 md:col-span-4 bg-surface border border-border-muted">
            <div className="p-lg border-b border-border-muted flex items-center justify-between">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">HUMAN-IN-THE-LOOP</h3>
              <span className="px-2 py-0.5 bg-tertiary/20 text-tertiary font-mono-technical text-[10px] border border-tertiary">
                {APPROVALS.length} PENDING
              </span>
            </div>
            <div className="divide-y divide-border-muted">
              {APPROVALS.map((a) => (
                <div key={a.id} className="p-lg hover:bg-surface-container-high transition-colors">
                  <div className="flex items-center justify-between mb-sm">
                    <span className="font-mono-technical text-[11px] text-on-surface-variant">{a.id}</span>
                    <span className={`font-mono-technical text-[10px] ${a.urgencyClass}`}>{a.urgency}</span>
                  </div>
                  <p className="font-body-bold text-body-bold text-on-surface mb-md">{a.label}</p>
                  <div className="flex gap-sm">
                    <button className="flex-1 bg-primary text-on-primary font-label-caps text-label-caps py-xs hover:brightness-110 active:scale-95 transition-all">
                      APPROVE
                    </button>
                    <button className="flex-1 border border-border-muted text-on-surface-variant font-label-caps text-label-caps py-xs hover:border-on-surface-variant transition-colors">
                      REJECT
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Model Registry */}
          <div className="col-span-12 bg-surface border border-border-muted">
            <div className="p-xl border-b border-border-muted flex items-center justify-between">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">MODEL REGISTRY</h3>
              <div className="flex items-center gap-md">
                <span className="font-mono-technical text-[11px] text-on-surface-variant">
                  {MODELS.filter((m) => m.status === "ACTIVE").length} Active · {MODELS.length} Total
                </span>
                <button className="px-3 py-1 bg-primary text-on-primary font-label-caps text-label-caps text-[10px] hover:brightness-110 transition-all">
                  Deploy New Model
                </button>
              </div>
            </div>
            <table className="w-full text-left">
              <thead className="bg-surface-container-low border-b border-border-muted">
                <tr>
                  {["ID / ALIAS", "ARCHITECTURE", "STATUS", "SAFETY RATING", "LATENCY (P99)", "ACTIONS"].map((h) => (
                    <th key={h} className="px-xl py-md font-label-caps text-label-caps text-on-surface-variant">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-muted">
                {MODELS.map((m) => (
                  <tr key={m.id} className="hover:bg-surface-container-highest transition-colors">
                    <td className="px-xl py-md font-mono-technical text-[12px] text-on-surface">{m.id}</td>
                    <td className="px-xl py-md font-body-base text-body-base text-on-surface-variant">{m.arch}</td>
                    <td className="px-xl py-md">
                      <span className={`px-2 py-0.5 font-mono-technical text-[10px] uppercase ${
                        m.status === "ACTIVE" ? "bg-primary/10 text-primary border border-primary" : "bg-critical/10 text-critical border border-critical"
                      }`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="px-xl py-md">
                      <div className="w-full h-1 bg-surface-container-highest relative max-w-[120px]">
                        <div className="absolute top-0 left-0 h-full bg-primary" style={{ width: `${m.safety}%` }} />
                      </div>
                      <span className="font-mono-technical text-[10px] text-on-surface-variant mt-1 block">{m.safety}%</span>
                    </td>
                    <td className="px-xl py-md font-mono-technical text-[12px] text-on-surface">{m.latency}</td>
                    <td className="px-xl py-md">
                      <button className="text-on-surface-variant hover:text-primary transition-colors">
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>more_vert</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <footer className="h-8 bg-surface-container-low border-t border-border-muted flex items-center justify-between px-xl font-mono-technical text-[10px] text-on-surface-variant shrink-0">
        <div className="flex items-center gap-xl">
          <div className="flex items-center gap-xs">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>AI_GOVERNANCE: OPERATIONAL</span>
          </div>
          <span>MODELS_ACTIVE: {MODELS.filter((m) => m.status === "ACTIVE").length} / {MODELS.length}</span>
          <span>POLICY_VERSION: v3.1.4-DORA</span>
        </div>
        <span className="font-bold text-on-surface">v0.1.0-MVP</span>
      </footer>
    </>
  );
}
