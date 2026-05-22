import prisma from "@/lib/db";
import { getRegulatoryData, getProjectSummary, DEMO_PROJECT_KEY } from "@/lib/governance";
import { RegulatoryFramework } from "@prisma/client";

export const dynamic = "force-dynamic";

const FRAMEWORK_META: Record<RegulatoryFramework, { full: string; sector: string; icon: string }> = {
  DORA:      { full: "Digital Operational Resilience Act",        sector: "FINANCIAL SECTOR",     icon: "D" },
  EU_AI_ACT: { full: "EU Artificial Intelligence Act",            sector: "MODEL GOVERNANCE",     icon: "A" },
  SOC2:      { full: "SOC 2 Type II",                             sector: "DATA SECURITY",        icon: "S" },
  ISO_27001: { full: "ISO/IEC 27001:2022",                        sector: "INFORMATION SECURITY", icon: "I" },
  PCI_DSS:   { full: "PCI-DSS v4.0",                             sector: "PAYMENT SECURITY",     icon: "P" },
  GDPR:      { full: "General Data Protection Regulation",        sector: "DATA PRIVACY",         icon: "G" },
};

// Deterministic heatmap cell colour (no hydration mismatch)
function heatCell(i: number, criticalPct: number): string {
  const v = Math.abs(Math.sin(i * 57.3 + 13.7) * 1000) % 1;
  if (v > 1 - criticalPct * 0.15) return "#D64545";
  if (v > 0.82) return "#ffba3e";
  if (v > 0.4)  return "#50dbcb33";
  return "#1C2635";
}

export default async function Intelligence() {
  const project = await prisma.project.findUnique({
    where: { key: DEMO_PROJECT_KEY },
    select: { id: true },
  });

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="font-mono-technical text-on-surface-variant text-[12px]">
          No project — run: <code className="text-primary">npx prisma db seed</code>
        </p>
      </div>
    );
  }

  const [{ mappings, frameworks, thirdParties }, summary] = await Promise.all([
    getRegulatoryData(project.id),
    getProjectSummary(project.id),
  ]);

  const frameworkCount = frameworks.length;
  const totalMappings = mappings.length;
  const criticalPct = summary.criticalRisks / Math.max(summary.totalRisks, 1);
  const evidencePct = summary.totalEvidence > 0
    ? Math.round((summary.evidenceMapped / summary.totalEvidence) * 100)
    : 0;

  // Build framework summary for the cards
  const frameworkSummary = frameworks.map((f) => ({
    ...f,
    meta: FRAMEWORK_META[f.framework] ?? { full: f.framework, sector: "REGULATORY", icon: f.framework[0] },
  }));

  return (
    <>
      {/* ── Top Bar ── */}
      <header className="h-16 px-xl flex items-center justify-between border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <div className="flex items-center gap-xl">
          <h1 className="font-headline-md text-headline-md text-on-surface">Intelligence</h1>
          <span className="font-body-base text-body-base text-on-surface-variant">
            {frameworkCount} regulatory framework{frameworkCount !== 1 ? "s" : ""} · {totalMappings} control mapping{totalMappings !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-md">
          <span className="font-body-bold text-body-bold text-primary">{summary.healthScore}%</span>
          {summary.criticalRisks > 0 && (
            <span className="px-2 py-0.5 bg-critical text-on-error font-mono-technical text-[10px]">
              {summary.criticalRisks} CRITICAL
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-xl">
        <div className="max-w-[1440px] mx-auto grid grid-cols-12 gap-lg">

          {/* Compliance Coverage Heatmap */}
          <div className="col-span-12 lg:col-span-8 bg-surface border border-border-muted p-xl">
            <div className="flex items-center justify-between mb-xl">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
                COMPLIANCE COVERAGE HEATMAP
              </h3>
              <span className="font-mono-technical text-[11px] text-on-surface-variant">
                {totalMappings} MAPPINGS · {frameworkCount} FRAMEWORKS
              </span>
            </div>
            <div className="grid grid-cols-[repeat(12,minmax(0,1fr))] gap-1 mb-md">
              {Array.from({ length: 84 }, (_, i) => (
                <div
                  key={i}
                  className="h-8 cursor-crosshair hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: heatCell(i, criticalPct) }}
                />
              ))}
            </div>
            <div className="flex gap-lg font-mono-technical text-[10px] text-on-surface-variant">
              {[
                { color: "#50dbcb33", label: "FULL COMPLIANCE" },
                { color: "#ffba3e",   label: "MINOR GAP" },
                { color: "#D64545",   label: "CRITICAL BREACH" },
                { color: "#1C2635",   label: "NO DATA" },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-xs">
                  <div className="w-2 h-2" style={{ backgroundColor: color }} />
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
                { label: "REGULATORY MAPPINGS",  pct: evidencePct },
                { label: "GATES APPROVED",        pct: summary.totalGates > 0 ? Math.round((summary.approvedGates / summary.totalGates) * 100) : 0 },
                { label: "RISKS MITIGATED",       pct: summary.totalRisks > 0 ? Math.round(((summary.totalRisks - summary.openRisks) / summary.totalRisks) * 100) : 0 },
              ].map(({ label, pct }) => (
                <div key={label}>
                  <div className="flex justify-between mb-sm font-mono-technical text-[10px] text-on-surface-variant">
                    <span>{label}</span>
                    <span className="text-on-surface">{pct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-container-highest relative">
                    <div
                      className="absolute top-0 left-0 h-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-xl pt-lg border-t border-border-muted space-y-sm">
              <div className="flex justify-between font-mono-technical text-[10px]">
                <span className="text-on-surface-variant">EVIDENCE ITEMS</span>
                <span className="text-on-surface">{summary.totalEvidence}</span>
              </div>
              <div className="flex justify-between font-mono-technical text-[10px]">
                <span className="text-on-surface-variant">THIRD-PARTY VENDORS</span>
                <span className="text-on-surface">{thirdParties.length}</span>
              </div>
            </div>
          </div>

          {/* Active Regulatory Packs — real DB data */}
          <div className="col-span-12 lg:col-span-6 bg-surface border border-border-muted">
            <div className="p-lg border-b border-border-muted flex items-center justify-between">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
                ACTIVE REGULATORY PACKS
              </h3>
              <span className="font-mono-technical text-[11px] text-on-surface-variant">
                {frameworkSummary.length} FRAMEWORKS
              </span>
            </div>
            <div className="divide-y divide-border-muted">
              {frameworkSummary.map((f) => (
                <div key={f.framework} className="p-lg flex items-center gap-lg hover:bg-surface-container-high transition-colors cursor-pointer">
                  <div className="w-8 h-8 bg-surface-container-high border border-border-muted flex items-center justify-center font-mono-technical text-[11px] text-on-surface shrink-0">
                    {f.meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-body-bold text-body-bold text-on-surface truncate">{f.meta.full}</p>
                    <p className="font-mono-technical text-[10px] text-on-surface-variant">{f.meta.sector}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono-technical text-[10px] text-primary">STABLE</span>
                    <p className="font-mono-technical text-[10px] text-on-surface-variant">{f._count.id} MAPPINGS</p>
                  </div>
                </div>
              ))}
              {frameworkSummary.length === 0 && (
                <div className="p-lg">
                  <p className="font-mono-technical text-[11px] text-on-surface-variant">No framework mappings yet.</p>
                </div>
              )}
            </div>
          </div>

          {/* Third-Party Dependency Summary */}
          <div className="col-span-12 lg:col-span-6 bg-surface border border-border-muted">
            <div className="p-lg border-b border-border-muted flex items-center justify-between">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
                THIRD-PARTY EXPOSURE
              </h3>
              <span className="font-mono-technical text-[11px] text-on-surface-variant">
                DORA ART. 28
              </span>
            </div>
            <div className="divide-y divide-border-muted">
              {thirdParties.map((t) => (
                <div key={t.id} className="p-lg flex items-center gap-lg hover:bg-surface-container-high transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-body-bold text-body-bold text-on-surface">{t.vendorName}</p>
                    <p className="font-mono-technical text-[10px] text-on-surface-variant">
                      {t.serviceType.toUpperCase()} · {t.regionOfHosting ?? "REGION N/A"}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 font-mono-technical text-[10px] uppercase shrink-0 ${
                    t.criticality === "critical"
                      ? "bg-critical/10 text-critical border border-critical"
                      : t.criticality === "important"
                      ? "bg-tertiary/20 text-tertiary border border-tertiary"
                      : "bg-primary/10 text-primary border border-primary"
                  }`}>
                    {t.criticality}
                  </span>
                </div>
              ))}
              {thirdParties.length === 0 && (
                <div className="p-lg">
                  <p className="font-mono-technical text-[11px] text-on-surface-variant">No third-party dependencies registered.</p>
                </div>
              )}
            </div>
          </div>

          {/* Control Mapping Table — real regulatory mappings */}
          <div className="col-span-12 bg-surface border border-border-muted">
            <div className="p-xl border-b border-border-muted flex items-center justify-between">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
                DETAILED CONTROL MAPPING
              </h3>
              <span className="font-mono-technical text-[11px] text-on-surface-variant">
                {totalMappings} CONTROL{totalMappings !== 1 ? "S" : ""} MAPPED
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low border-b border-border-muted">
                  <tr>
                    {["FRAMEWORK", "CONTROL ID", "CONTROL NAME", "EVIDENCE", "MAPPED BY", "STATUS"].map((h) => (
                      <th key={h} className="px-xl py-md font-label-caps text-label-caps text-on-surface-variant">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-muted">
                  {mappings.map((m) => (
                    <tr key={m.id} className="hover:bg-surface-container-highest transition-colors">
                      <td className="px-xl py-md">
                        <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary font-mono-technical text-[10px]">
                          {m.framework.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-xl py-md font-mono-technical text-[12px] text-on-surface-variant">
                        {m.controlId}
                      </td>
                      <td className="px-xl py-md font-body-base text-body-base text-on-surface max-w-[240px] truncate">
                        {m.controlName ?? m.description ?? "—"}
                      </td>
                      <td className="px-xl py-md font-mono-technical text-[11px] text-on-surface-variant truncate max-w-[180px]">
                        {m.evidence.title}
                      </td>
                      <td className="px-xl py-md font-mono-technical text-[11px] text-on-surface-variant">
                        {m.mappedBy}
                      </td>
                      <td className="px-xl py-md">
                        <span className={`px-2 py-0.5 font-mono-technical text-[10px] uppercase ${
                          m.verifiedAt
                            ? "bg-primary/10 text-primary border border-primary"
                            : "bg-tertiary/20 text-tertiary border border-tertiary"
                        }`}>
                          {m.verifiedAt ? "VERIFIED" : "PENDING"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {mappings.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-xl py-lg font-mono-technical text-[11px] text-on-surface-variant">
                        No control mappings recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-xl py-md border-t border-border-muted font-mono-technical text-[10px] text-on-surface-variant">
              DISPLAYING {totalMappings} OF {totalMappings} CONTROLS
            </div>
          </div>
        </div>
      </div>

      {/* ── Status Footer ── */}
      <footer className="h-8 bg-surface-container-low border-t border-border-muted flex items-center justify-between px-xl font-mono-technical text-[10px] text-on-surface-variant shrink-0">
        <div className="flex items-center gap-xl">
          <div className="flex items-center gap-xs">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span>REGULATORY_ENGINE: ACTIVE</span>
          </div>
          <span>FRAMEWORKS_TRACKED: {frameworkCount}</span>
          <span>MAPPINGS: {totalMappings}</span>
        </div>
        <span className="font-bold text-on-surface">v0.1.0-MVP</span>
      </footer>
    </>
  );
}
