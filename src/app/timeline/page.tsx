export default function Timeline() {
  const events = [
    {
      time: "14:22:05.112",
      severity: "critical",
      title: "Security Breach — Unauthorized AI Access Attempt",
      source: "Node: 746380654 | Data Relay: Target: /VV/time/vault",
      badge: "BREACH",
      badgeClass: "bg-critical text-on-error",
      detail: "Automatic mitigation engaged. IP Blacklisted. Executive alert dispatched.",
    },
    {
      time: "11:05:30.812",
      severity: "info",
      title: "AI Resource Re-allocation",
      source: "Model: NEXORI-LR • Reasoning: Latency optimization for mission-critical subroutines",
      badge: "AI ACTION",
      badgeClass: "bg-primary/20 text-primary border border-primary",
      detail: "Auto Approved by Policy LZ",
    },
    {
      time: "09:15:00.000",
      severity: "warning",
      title: "Policy Update: P-772 (Data Retention)",
      source: "Approved by: J. Miller and S. Chen",
      badge: "POLICY",
      badgeClass: "bg-tertiary/20 text-tertiary border border-tertiary",
      detail: "Extension of cold-storage retention for encrypted telemetry from 90 to 365 days. Compliance alignment with ISO/IEC 43091:2025.",
    },
  ];

  return (
    <>
      <header className="h-16 px-xl flex items-center justify-between border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <div className="flex items-center gap-xl">
          <h1 className="font-headline-md text-headline-md text-on-surface">Flight Recorder</h1>
          <span className="text-on-surface-variant font-body-base text-body-base">Evidence Vault</span>
          <div className="flex gap-xs">
            {["All Events", "Security", "GRC", "Compliance", "AI", "Risk"].map((tab, i) => (
              <button
                key={tab}
                className={`px-3 py-1 font-mono-technical text-[11px] uppercase tracking-widest transition-colors ${
                  i === 0
                    ? "bg-secondary-container text-on-secondary-container"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-lg text-right">
          <div>
            <p className="font-mono-technical text-[10px] text-on-surface-variant">DATA INTEGRITY</p>
            <p className="font-body-bold text-body-bold text-primary">99.099% VERIFIED</p>
          </div>
          <div className="font-mono-technical text-[10px] text-on-surface-variant border border-border-muted px-2 py-1">
            #A9F2-401B
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-xl py-xl">
        <div className="max-w-[900px]">
          {events.map((e, i) => (
            <div key={i} className="mb-0">
              {i === 0 && (
                <div className="font-mono-technical text-[10px] text-on-surface-variant mb-lg uppercase tracking-widest">
                  October 24, 2023 — Operational Cycle 883
                </div>
              )}
              <div className="flex gap-lg mb-lg relative">
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full border-2 mt-1 shrink-0 ${
                    e.severity === "critical" ? "border-critical bg-critical" :
                    e.severity === "warning" ? "border-tertiary bg-tertiary" :
                    "border-primary bg-primary"
                  }`} />
                  {i < events.length - 1 && <div className="flex-1 w-px bg-border-muted mt-1" />}
                </div>
                <div className="flex-1 bg-surface border border-border-muted p-lg mb-lg hover:border-on-surface-variant transition-colors cursor-pointer">
                  <div className="flex items-start justify-between mb-sm">
                    <div className="flex items-center gap-md">
                      <span className={`px-2 py-0.5 font-mono-technical text-[10px] uppercase ${e.badgeClass}`}>
                        {e.badge}
                      </span>
                      <h4 className="font-body-bold text-body-bold text-on-surface">{e.title}</h4>
                    </div>
                    <span className="font-mono-technical text-[11px] text-on-surface-variant shrink-0 ml-md">{e.time}</span>
                  </div>
                  <p className="font-mono-technical text-[11px] text-on-surface-variant mb-sm">{e.source}</p>
                  <p className="font-body-base text-body-base text-on-surface-variant">{e.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <footer className="h-8 bg-surface-container-low border-t border-border-muted flex items-center justify-between px-xl font-mono-technical text-[10px] text-on-surface-variant shrink-0">
        <div className="flex items-center gap-xl">
          <div className="flex items-center gap-xs">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>STREAM STATUS: LIVE RECORDING</span>
          </div>
          <span>STORAGE VOLUME: 42.7TB / IMMUTABLE</span>
        </div>
        <div className="flex items-center gap-md">
          <button className="px-3 py-1 border border-border-muted text-on-surface-variant hover:text-on-surface hover:border-on-surface-variant transition-colors">
            EXPORT AUDIT PACK
          </button>
          <button className="px-3 py-1 bg-primary text-on-primary font-bold hover:brightness-110 transition-all">
            GENERATE REPORT
          </button>
        </div>
      </footer>
    </>
  );
}
