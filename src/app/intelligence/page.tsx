const REG_PACKS = [
  { icon: "G", label: "General Data Protection Regulation (GDPR)", sub: "GLOBAL DATA PRIVACY — OPERATIONAL", status: "STABLE", statusClass: "text-primary" },
  { icon: "A", label: "EU AI Act (AI Act [Proposed/Draft])", sub: "MODEL GOVERNANCE — EMERGING", status: "GAP DETECTED", statusClass: "text-tertiary" },
  { icon: "D", label: "Digital Operational Resilience Act (DORA)", sub: "FINANCIAL SECTOR — OPERATIONAL", status: "STABLE", statusClass: "text-primary" },
];

const CONTROLS = [
  { id: "RC-01", control: "Encryption at Rest (AES-256)", regGroup: "GDPR Art. 32", owner: "Infra Lead", status: "COMPLIANT", evidence: "Verified 2h ago" },
  { id: "RC-02", control: "Automated Anomaly Detection", regGroup: "DORA Sec. 12", owner: "SecOps", status: "COMPLIANT", evidence: "Active Pulse" },
  { id: "RC-03", control: "Cross-Border Residency Check", regGroup: "GDPR Art. 44", owner: "ML Engine", status: "PENDING", evidence: "Missing Data Logs" },
  { id: "RC-04", control: "AI Model Knowledge Audit", regGroup: "EU AI Act", owner: "ML Engine", status: "COMPLIANT", evidence: "Annual Review Q1" },
  { id: "RC-05", control: "Multi-Factor Authentication Enforced", regGroup: "ISO 27001", owner: "IAM Admin", status: "COMPLIANT", evidence: "Verified 5m ago" },
];

const GAPS = [
  {
    title: "Model Drifting Attestation Timeout",
    severity: "HIGH RISK",
    severityClass: "text-critical",
    detail: "EU AI Act Article 14 requires human-in-the-loop oversight. Last oversight: 14 days overnight. Escalation required.",
    action: "ASSIGN REVIEWER",
  },
  {
    title: "Missing Data Locality Certificate",
    severity: "MEDIUM RISK",
    severityClass: "text-tertiary",
    detail: "GDPR Compliance: AWS Frankfurt module-16 lacks updated missing locality certification for Q4.",
    action: "REQUEST CERT",
  },
];

export default function Intelligence() {
  return (
    <>
      <header className="h-16 px-xl flex items-center justify-between border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <div className="flex items-center gap-xl">
          <h1 className="font-headline-md text-headline-md text-on-surface">Intelligence</h1>
          <span className="font-body-base text-body-base text-on-surface-variant">
            Operational mapping of 14 core regulatory frameworks against system-wide controls.
          </span>
        </div>
        <div className="flex items-center gap-md">
          <span className="font-body-bold text-body-bold text-primary">88.4%</span>
          <span className="px-2 py-0.5 bg-critical text-on-error font-mono-technical text-[10px]">12 CRITICAL</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-xl">
        <div className="max-w-[1440px] mx-auto grid grid-cols-12 gap-lg">

          {/* Compliance Heatmap */}
          <div className="col-span-12 lg:col-span-8 bg-surface border border-border-muted p-xl">
            <div className="flex items-center justify-between mb-xl">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
                COMPLIANCE COVERAGE HEATMAP
              </h3>
              <button className="font-mono-technical text-[11px] text-on-surface-variant border border-border-muted px-3 py-1 hover:border-on-surface-variant transition-colors">
                ALL REGIONS
              </button>
            </div>
            <div className="grid grid-cols-[repeat(12,minmax(0,1fr))] gap-1 mb-md">
              {Array.from({ length: 84 }, (_, i) => {
                const v = Math.abs(Math.sin(i * 57.3 + 13.7) * 1000) % 1;
                const bg =
                  v > 0.92 ? "bg-critical" :
                  v > 0.75 ? "bg-tertiary" :
                  v > 0.4 ? "bg-primary" :
                  "bg-surface-container-high";
                return <div key={i} className={`${bg} h-8 cursor-crosshair hover:opacity-80 transition-opacity`} />;
              })}
            </div>
            <div className="flex gap-lg font-mono-technical text-[10px] text-on-surface-variant">
              {[
                { color: "bg-primary", label: "FULL COMPLIANCE" },
                { color: "bg-tertiary", label: "MINOR GAP" },
                { color: "bg-critical", label: "CRITICAL BREACH" },
                { color: "bg-surface-container-high", label: "NO DATA" },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-xs">
                  <div className={`w-2 h-2 ${color}`} />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Evidence Completeness */}
          <div className="col-span-12 lg:col-span-4 bg-surface border border-border-muted p-xl">
            <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-xl">
              EVIDENCE COMPLETENESS
            </h3>
            <div className="space-y-lg">
              {[
                { label: "AUTOMATED ARTIFACTS", pct: 92 },
                { label: "MANUAL ATTESTATIONS", pct: 47 },
                { label: "THIRD-PARTY AUDITS", pct: 68 },
              ].map(({ label, pct }) => (
                <div key={label}>
                  <div className="flex justify-between mb-sm font-mono-technical text-[10px] text-on-surface-variant">
                    <span>{label}</span>
                    <span className="text-on-surface">{pct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-container-highest relative">
                    <div className="absolute top-0 left-0 h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <button className="mt-xl w-full border border-border-muted text-on-surface-variant font-label-caps text-label-caps py-md hover:border-on-surface-variant hover:text-on-surface transition-colors uppercase tracking-widest">
              Request System Attestation
            </button>
          </div>

          {/* Regulatory Packs */}
          <div className="col-span-12 lg:col-span-6 bg-surface border border-border-muted">
            <div className="p-lg border-b border-border-muted flex items-center justify-between">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">ACTIVE REGULATORY PACKS</h3>
              <span className="font-mono-technical text-[11px] text-on-surface-variant">{REG_PACKS.length} TOTAL PACKS</span>
            </div>
            <div className="divide-y divide-border-muted">
              {REG_PACKS.map((p) => (
                <div key={p.label} className="p-lg flex items-center gap-lg hover:bg-surface-container-high transition-colors cursor-pointer">
                  <div className="w-8 h-8 bg-surface-container-high border border-border-muted flex items-center justify-center font-mono-technical text-[11px] text-on-surface shrink-0">
                    {p.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-body-bold text-body-bold text-on-surface truncate">{p.label}</p>
                    <p className="font-mono-technical text-[10px] text-on-surface-variant">{p.sub}</p>
                  </div>
                  <span className={`font-mono-technical text-[10px] shrink-0 ${p.statusClass}`}>{p.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Critical Governance Gaps */}
          <div className="col-span-12 lg:col-span-6 bg-surface border border-border-muted">
            <div className="p-lg border-b border-border-muted flex items-center justify-between">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">CRITICAL GOVERNANCE GAPS</h3>
            </div>
            <div className="divide-y divide-border-muted">
              {GAPS.map((g) => (
                <div key={g.title} className="p-lg">
                  <div className="flex items-center gap-md mb-sm">
                    <span className={`font-mono-technical text-[10px] uppercase ${g.severityClass}`}>{g.severity}</span>
                    <p className="font-body-bold text-body-bold text-on-surface">{g.title}</p>
                  </div>
                  <p className="font-body-base text-body-base text-on-surface-variant mb-md">{g.detail}</p>
                  <button className="px-3 py-1 border border-border-muted text-on-surface-variant font-label-caps text-label-caps text-[10px] hover:border-on-surface-variant hover:text-on-surface transition-colors">
                    {g.action}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Control Mapping Table */}
          <div className="col-span-12 bg-surface border border-border-muted">
            <div className="p-xl border-b border-border-muted flex items-center justify-between">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">DETAILED CONTROL MAPPING</h3>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-2 text-on-surface-variant" style={{ fontSize: 14 }}>search</span>
                <input
                  className="bg-surface-container-low border border-border-muted text-on-surface text-[12px] pl-7 pr-3 py-1 focus:outline-none focus:ring-1 focus:ring-primary rounded-none placeholder:text-on-surface-variant min-w-[200px]"
                  placeholder="Search controls..."
                  type="text"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low border-b border-border-muted">
                  <tr>
                    {["CID", "CONTROL", "REG GROUP", "OWNER", "STATUS", "EVIDENCE"].map((h) => (
                      <th key={h} className="px-xl py-md font-label-caps text-label-caps text-on-surface-variant">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-muted">
                  {CONTROLS.map((c) => (
                    <tr key={c.id} className="hover:bg-surface-container-highest transition-colors">
                      <td className="px-xl py-md font-mono-technical text-[12px] text-on-surface-variant">{c.id}</td>
                      <td className="px-xl py-md font-body-base text-body-base text-on-surface">{c.control}</td>
                      <td className="px-xl py-md font-mono-technical text-[11px] text-on-surface-variant">{c.regGroup}</td>
                      <td className="px-xl py-md font-body-base text-body-base text-on-surface-variant">{c.owner}</td>
                      <td className="px-xl py-md">
                        <span className={`px-2 py-0.5 font-mono-technical text-[10px] uppercase ${
                          c.status === "COMPLIANT"
                            ? "bg-primary/10 text-primary border border-primary"
                            : "bg-tertiary/10 text-tertiary border border-tertiary"
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-xl py-md font-mono-technical text-[11px] text-on-surface-variant">{c.evidence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-xl py-md border-t border-border-muted font-mono-technical text-[10px] text-on-surface-variant">
              DISPLAYING 5 OF 1,344 CONTROLS
            </div>
          </div>
        </div>
      </div>

      <footer className="h-8 bg-surface-container-low border-t border-border-muted flex items-center justify-between px-xl font-mono-technical text-[10px] text-on-surface-variant shrink-0">
        <div className="flex items-center gap-xl">
          <div className="flex items-center gap-xs">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span>REGULATORY_ENGINE: ACTIVE</span>
          </div>
          <span>FRAMEWORKS_TRACKED: 14</span>
          <span>LAST_SYNC: 00:02:41 AGO</span>
        </div>
        <span className="font-bold text-on-surface">v0.1.0-MVP</span>
      </footer>
    </>
  );
}
