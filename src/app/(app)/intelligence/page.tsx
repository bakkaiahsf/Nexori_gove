import prisma from "@/lib/db";
import { getRegulatoryData, getProjectSummary, DEMO_PROJECT_KEY } from "@/lib/governance";
import { RegulatoryFramework } from "@prisma/client";
import IntelligenceQueryPanel from "@/components/governance/IntelligenceQueryPanel";
import Link from "next/link";

export const dynamic = "force-dynamic";

const FRAMEWORK_META: Record<RegulatoryFramework, { full: string; sector: string; region: string; color: string }> = {
  DORA:      { full: "Digital Operational Resilience Act",    sector: "Financial Services",   region: "EU",     color: "text-primary border-primary bg-primary/10" },
  EU_AI_ACT: { full: "EU Artificial Intelligence Act",       sector: "AI / Model Governance", region: "EU",     color: "text-tertiary border-tertiary bg-tertiary/10" },
  SOC2:      { full: "SOC 2 Type II",                        sector: "Data Security",         region: "US/Global", color: "text-primary border-primary bg-primary/10" },
  ISO_27001: { full: "ISO/IEC 27001:2022",                   sector: "Information Security",  region: "Global", color: "text-primary border-primary bg-primary/10" },
  PCI_DSS:   { full: "PCI-DSS v4.0",                        sector: "Payment Security",      region: "Global", color: "text-tertiary border-tertiary bg-tertiary/10" },
  GDPR:      { full: "General Data Protection Regulation",   sector: "Data Privacy",          region: "EU/UK",  color: "text-primary border-primary bg-primary/10" },
};

const FRAMEWORK_ORDER: RegulatoryFramework[] = ["DORA","EU_AI_ACT","SOC2","ISO_27001","PCI_DSS","GDPR"];

export default async function Intelligence() {
  const project = await prisma.project.findUnique({
    where: { key: DEMO_PROJECT_KEY },
    select: { id: true, name: true },
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

  const [{ mappings, frameworks, thirdParties }, summary, coverageRaw, verifiedRaw, triggerStats, policyDocs] = await Promise.all([
    getRegulatoryData(project.id),
    getProjectSummary(project.id),
    prisma.regulatoryMapping.groupBy({
      by: ["framework"],
      where: { projectId: project.id },
      _count: { id: true },
    }),
    prisma.regulatoryMapping.groupBy({
      by: ["framework"],
      where: { projectId: project.id, verifiedAt: { not: null } },
      _count: { id: true },
    }),
    prisma.triggerEvaluation.groupBy({
      by: ["matched"],
      where: { projectId: project.id },
      _count: { id: true },
    }),
    prisma.policyDocument.findMany({
      where: { tenantId: null },
      select: { id: true, title: true, type: true, uploadedAt: true, indexedAt: true, _count: { select: { chunks: true } } },
      orderBy: { uploadedAt: "desc" },
      take: 5,
    }),
  ]);

  const coverageMap = Object.fromEntries(
    FRAMEWORK_ORDER.map((fw) => {
      const total = coverageRaw.find((r) => r.framework === fw)?._count.id ?? 0;
      const verified = verifiedRaw.find((r) => r.framework === fw)?._count.id ?? 0;
      return [fw, { total, verified, pct: total > 0 ? Math.round((verified / total) * 100) : 0 }];
    })
  ) as Record<RegulatoryFramework, { total: number; verified: number; pct: number }>;

  const totalMappings = mappings.length;
  const frameworkCount = frameworks.length;
  const evidencePct = summary.totalEvidence > 0 ? Math.round((summary.evidenceMapped / summary.totalEvidence) * 100) : 0;
  const triggerMatchCount = triggerStats.find((t) => t.matched)?._count.id ?? 0;
  const triggerSkipCount = triggerStats.find((t) => !t.matched)?._count.id ?? 0;
  const aiMode = summary.aiMode ?? "AI_ASSIST";

  return (
    <>
      <header className="h-16 px-xl flex items-center justify-between border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <div className="flex items-center gap-xl">
          <h1 className="font-headline-md text-headline-md text-on-surface">Governance Intelligence</h1>
          <span className="font-body-base text-body-base text-on-surface-variant">
            {frameworkCount} frameworks · {totalMappings} controls mapped · RAG-powered
          </span>
        </div>
        <div className="flex items-center gap-md">
          <Link
            href="/admin/frameworks"
            className="px-lg py-sm border border-border-muted font-mono-technical text-[10px] text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
          >
            CONFIGURE FRAMEWORKS →
          </Link>
          <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary font-mono-technical text-[10px]">
            {aiMode.replace(/_/g, " ")}
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-xl">
        <div className="max-w-[1440px] mx-auto space-y-lg">

          {/* ── AI Intelligence Query Panel ── */}
          <div className="grid grid-cols-12 gap-lg">
            <IntelligenceQueryPanel projectId={project.id} aiMode={aiMode} />
          </div>

          {/* ── Compliance Framework Health ── */}
          <div className="grid grid-cols-12 gap-lg">
            <div className="col-span-12 bg-surface border border-border-muted">
              <div className="px-xl py-lg border-b border-border-muted flex items-center justify-between">
                <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
                  COMPLIANCE FRAMEWORK HEALTH
                </h3>
                <Link
                  href="/admin/frameworks"
                  className="font-mono-technical text-[10px] text-primary hover:underline"
                >
                  + ADD FRAMEWORK
                </Link>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 divide-x divide-y divide-border-muted">
                {FRAMEWORK_ORDER.map((fw) => {
                  const meta = FRAMEWORK_META[fw];
                  const cov = coverageMap[fw];
                  const hasData = frameworks.some((f) => f.framework === fw);
                  return (
                    <div key={fw} className="p-lg hover:bg-surface-container-low transition-colors">
                      <div className="flex items-start justify-between mb-md">
                        <div>
                          <span className={`px-2 py-0.5 font-mono-technical text-[10px] border ${meta.color}`}>
                            {fw.replace(/_/g, " ")}
                          </span>
                          <p className="font-mono-technical text-[9px] text-on-surface-variant mt-xs">
                            {meta.region}
                          </p>
                        </div>
                        <span className={`font-mono-technical text-[10px] ${hasData ? "text-primary" : "text-on-surface-variant"}`}>
                          {hasData ? `${cov.pct}%` : "NOT SET"}
                        </span>
                      </div>
                      <p className="font-body-base text-body-base text-on-surface text-[11px] mb-sm leading-snug">
                        {meta.full}
                      </p>
                      <p className="font-mono-technical text-[9px] text-on-surface-variant mb-md">{meta.sector}</p>
                      {hasData ? (
                        <>
                          <div className="w-full h-1 bg-surface-container-highest relative">
                            <div
                              className="absolute top-0 left-0 h-full bg-primary transition-all"
                              style={{ width: `${cov.pct}%` }}
                            />
                          </div>
                          <p className="font-mono-technical text-[9px] text-on-surface-variant mt-xs">
                            {cov.verified}/{cov.total} controls verified
                          </p>
                        </>
                      ) : (
                        <p className="font-mono-technical text-[9px] text-on-surface-variant/50">
                          Not configured for this project
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Metrics row ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-lg">
            {[
              { label: "EVIDENCE MAPPED", value: `${evidencePct}%`, sub: `${summary.evidenceMapped} of ${summary.totalEvidence} items`, color: "text-primary" },
              { label: "GATES CLEARED",   value: `${summary.totalGates > 0 ? Math.round((summary.approvedGates / summary.totalGates) * 100) : 0}%`, sub: `${summary.approvedGates} of ${summary.totalGates} gates`, color: "text-primary" },
              { label: "TRIGGERS MATCHED", value: String(triggerMatchCount), sub: `${triggerSkipCount} skipped (no rule)`, color: "text-tertiary" },
              { label: "THIRD-PARTY ICIS", value: String(thirdParties.length), sub: "DORA Art. 28 register", color: "text-on-surface" },
            ].map((m) => (
              <div key={m.label} className="bg-surface border border-border-muted p-lg">
                <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest mb-sm">{m.label}</p>
                <p className={`font-stat-lg text-stat-lg ${m.color}`} style={{ fontSize: 32, lineHeight: 1 }}>{m.value}</p>
                <p className="font-mono-technical text-[10px] text-on-surface-variant mt-sm">{m.sub}</p>
              </div>
            ))}
          </div>

          {/* ── Policy Corpus + Third-party side by side ── */}
          <div className="grid grid-cols-12 gap-lg">
            {/* Policy document corpus */}
            <div className="col-span-12 lg:col-span-6 bg-surface border border-border-muted">
              <div className="px-xl py-lg border-b border-border-muted flex items-center justify-between">
                <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
                  POLICY CORPUS
                </h3>
                <span className="font-mono-technical text-[10px] text-on-surface-variant">
                  {policyDocs.length} DOCUMENTS
                </span>
              </div>
              <div className="divide-y divide-border-muted">
                {policyDocs.length === 0 ? (
                  <div className="p-xl text-center">
                    <p className="font-mono-technical text-[11px] text-on-surface-variant mb-md">No policy documents indexed yet.</p>
                    <Link
                      href="/admin/frameworks"
                      className="px-lg py-sm border border-primary text-primary font-mono-technical text-[10px] hover:bg-primary/10 transition-colors"
                    >
                      UPLOAD POLICY DOCUMENT
                    </Link>
                  </div>
                ) : (
                  policyDocs.map((doc) => (
                    <div key={doc.id} className="p-lg flex items-start justify-between gap-md hover:bg-surface-container-low transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="font-body-bold text-body-bold text-on-surface truncate">{doc.title}</p>
                        <p className="font-mono-technical text-[10px] text-on-surface-variant">
                          {doc.type.toUpperCase().replace(/-/g, " ")} · {doc._count.chunks} chunks
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 font-mono-technical text-[10px] border shrink-0 ${doc.indexedAt ? "text-primary border-primary bg-primary/10" : "text-tertiary border-tertiary"}`}>
                        {doc.indexedAt ? "INDEXED" : "PENDING"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Third-party exposure */}
            <div className="col-span-12 lg:col-span-6 bg-surface border border-border-muted">
              <div className="px-xl py-lg border-b border-border-muted flex items-center justify-between">
                <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
                  THIRD-PARTY ICT REGISTER
                </h3>
                <span className="font-mono-technical text-[10px] text-on-surface-variant">DORA ART. 28</span>
              </div>
              <div className="divide-y divide-border-muted">
                {thirdParties.length === 0 ? (
                  <div className="p-lg">
                    <p className="font-mono-technical text-[11px] text-on-surface-variant">No third-party dependencies registered.</p>
                  </div>
                ) : (
                  thirdParties.map((t) => (
                    <div key={t.id} className="p-lg flex items-center gap-lg hover:bg-surface-container-high transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="font-body-bold text-body-bold text-on-surface">{t.vendorName}</p>
                        <p className="font-mono-technical text-[10px] text-on-surface-variant">
                          {t.serviceType.toUpperCase()} · {t.regionOfHosting ?? "REGION N/A"}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 font-mono-technical text-[10px] uppercase shrink-0 border ${
                        t.criticality === "critical"
                          ? "bg-critical/10 text-critical border-critical"
                          : t.criticality === "important"
                            ? "bg-tertiary/20 text-tertiary border-tertiary"
                            : "bg-primary/10 text-primary border-primary"
                      }`}>
                        {t.criticality}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ── Control mapping table ── */}
          <div className="bg-surface border border-border-muted">
            <div className="px-xl py-lg border-b border-border-muted flex items-center justify-between">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
                REGULATORY CONTROL MAPPING
              </h3>
              <span className="font-mono-technical text-[11px] text-on-surface-variant">
                {totalMappings} CONTROL{totalMappings !== 1 ? "S" : ""}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low border-b border-border-muted">
                  <tr>
                    {["FRAMEWORK","CONTROL ID","CONTROL NAME","EVIDENCE","MAPPED BY","STATUS"].map((h) => (
                      <th key={h} className="px-xl py-md font-label-caps text-label-caps text-on-surface-variant text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-muted">
                  {mappings.map((m) => (
                    <tr key={m.id} className="hover:bg-surface-container-highest transition-colors">
                      <td className="px-xl py-md">
                        <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary font-mono-technical text-[10px]">
                          {m.framework.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-xl py-md font-mono-technical text-[12px] text-on-surface-variant">{m.controlId}</td>
                      <td className="px-xl py-md font-body-base text-body-base text-on-surface max-w-[200px] truncate text-[12px]">
                        {m.controlName ?? m.description ?? "—"}
                      </td>
                      <td className="px-xl py-md font-mono-technical text-[11px] text-on-surface-variant truncate max-w-[160px]">
                        {m.evidence.title}
                      </td>
                      <td className="px-xl py-md font-mono-technical text-[11px] text-on-surface-variant">{m.mappedBy}</td>
                      <td className="px-xl py-md">
                        <span className={`px-2 py-0.5 font-mono-technical text-[10px] border ${m.verifiedAt ? "bg-primary/10 text-primary border-primary" : "bg-tertiary/20 text-tertiary border-tertiary"}`}>
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
          </div>
        </div>
      </div>

      <footer className="h-8 bg-surface-container-low border-t border-border-muted flex items-center justify-between px-xl font-mono-technical text-[10px] text-on-surface-variant shrink-0">
        <div className="flex items-center gap-xl">
          <div className="flex items-center gap-xs"><span className="w-2 h-2 rounded-full bg-primary" /><span>INTELLIGENCE_ENGINE: ACTIVE</span></div>
          <span>FRAMEWORKS: {frameworkCount} · MAPPINGS: {totalMappings}</span>
        </div>
        <span>RAG_MODE: HYBRID_SEMANTIC_KEYWORD</span>
      </footer>
    </>
  );
}
