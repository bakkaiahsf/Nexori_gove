import prisma from "@/lib/db";
import { computeDrift } from "@/lib/governance/drift";
import IntelligenceQueryPanel from "@/components/governance/IntelligenceQueryPanel";
import GuardrailsPushPanel from "./GuardrailsPushPanel";

export const dynamic = "force-dynamic";

const FRAMEWORK_META: Record<
  string,
  { full: string; sector: string; region: string; color: string }
> = {
  DORA: {
    full: "Digital Operational Resilience Act",
    sector: "Financial Services",
    region: "EU",
    color: "text-primary border-primary bg-primary/10",
  },
  EU_AI_ACT: {
    full: "EU Artificial Intelligence Act",
    sector: "AI / Model Governance",
    region: "EU",
    color: "text-tertiary border-tertiary bg-tertiary/10",
  },
  SOC2: {
    full: "SOC 2 Type II",
    sector: "Data Security",
    region: "US/Global",
    color: "text-primary border-primary bg-primary/10",
  },
  ISO_27001: {
    full: "ISO/IEC 27001:2022",
    sector: "Information Security",
    region: "Global",
    color: "text-primary border-primary bg-primary/10",
  },
  PCI_DSS: {
    full: "PCI-DSS v4.0",
    sector: "Payment Security",
    region: "Global",
    color: "text-tertiary border-tertiary bg-tertiary/10",
  },
  GDPR: {
    full: "General Data Protection Regulation",
    sector: "Data Privacy",
    region: "EU/UK",
    color: "text-primary border-primary bg-primary/10",
  },
};

const FRAMEWORK_ORDER = ["DORA", "EU_AI_ACT", "SOC2", "ISO_27001", "PCI_DSS", "GDPR"];

export default async function ComplianceIntelligencePage() {
  let projects: Array<{ id: string; key: string; name: string }> = [];
  let coverageRaw: Array<{ framework: string; _count: { id: number } }> = [];
  let verifiedRaw: Array<{ framework: string; _count: { id: number } }> = [];
  let policyDocs: Array<{
    id: string;
    title: string;
    type: string;
    uploadedAt: Date;
    indexedAt: Date | null;
    _count: { chunks: number };
  }> = [];
  let connectors: Array<{ id: string; type: string; name: string }> = [];
  let guardrailPushes: Array<{
    id: string;
    projectId: string;
    framework: string;
    repoPath: string;
    prUrl: string | null;
    status: string;
    generatedAt: Date;
    mergedAt: Date | null;
  }> = [];
  let firstProject: { id: string; key: string; name: string } | undefined;
  let aiSetting: { mode: string } | null = null;
  let drift: Awaited<ReturnType<typeof computeDrift>> | null = null;
  let dbError = false;

  try {
    [projects, coverageRaw, verifiedRaw, policyDocs, connectors, guardrailPushes] =
      await Promise.all([
        prisma.project.findMany({
          select: { id: true, key: true, name: true },
          orderBy: { name: "asc" },
        }),
        prisma.regulatoryMapping.groupBy({
          by: ["framework"],
          _count: { id: true },
        }),
        prisma.regulatoryMapping.groupBy({
          by: ["framework"],
          where: { verifiedAt: { not: null } },
          _count: { id: true },
        }),
        prisma.policyDocument.findMany({
          select: {
            id: true,
            title: true,
            type: true,
            uploadedAt: true,
            indexedAt: true,
            _count: { select: { chunks: true } },
          },
          orderBy: { uploadedAt: "desc" },
          take: 8,
        }),
        prisma.sourceConnector.findMany({
          where: { enabled: true },
          select: { id: true, type: true, name: true },
        }),
        prisma.guardrailPush.findMany({
          orderBy: { generatedAt: "desc" },
          take: 20,
          select: {
            id: true,
            projectId: true,
            framework: true,
            repoPath: true,
            prUrl: true,
            status: true,
            generatedAt: true,
            mergedAt: true,
          },
        }),
      ]);

    firstProject = projects[0];
    const projectIds = projects.map((p) => p.id);
    [aiSetting, drift] = await Promise.all([
      firstProject
        ? prisma.aIControlSetting.findUnique({
            where: { projectId: firstProject.id },
            select: { mode: true },
          })
        : Promise.resolve(null),
      projectIds.length > 0 ? computeDrift(projectIds) : Promise.resolve(null),
    ]);
  } catch {
    dbError = true;
  }

  if (dbError) {
    return (
      <>
        <header className="h-16 px-xl flex items-center border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
          <h1 className="font-headline-md text-headline-md text-on-surface">
            Compliance Intelligence
          </h1>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <p className="font-mono-technical text-[11px] text-on-surface-variant">
            INTELLIGENCE_DATA_UNAVAILABLE — Database connectivity issue. Check /api/health.
          </p>
        </div>
      </>
    );
  }

  const coverageMap = Object.fromEntries(
    FRAMEWORK_ORDER.map((fw) => {
      const total = coverageRaw.find((r) => r.framework === fw)?._count.id ?? 0;
      const verified = verifiedRaw.find((r) => r.framework === fw)?._count.id ?? 0;
      return [fw, { total, verified, pct: total > 0 ? Math.round((verified / total) * 100) : 0 }];
    })
  ) as Record<string, { total: number; verified: number; pct: number }>;

  const totalMappings = coverageRaw.reduce((s, r) => s + r._count.id, 0);
  const avgCoverage =
    FRAMEWORK_ORDER.filter((fw) => coverageMap[fw].total > 0).length > 0
      ? Math.round(
          FRAMEWORK_ORDER.filter((fw) => coverageMap[fw].total > 0).reduce(
            (s, fw) => s + coverageMap[fw].pct,
            0
          ) / FRAMEWORK_ORDER.filter((fw) => coverageMap[fw].total > 0).length
        )
      : 0;

  const projectMap = new Map(projects.map((p) => [p.id, p]));

  return (
    <>
      <header className="h-16 px-xl flex items-center justify-between border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <div className="flex items-center gap-xl">
          <h1 className="font-headline-md text-headline-md text-on-surface">
            Compliance Intelligence
          </h1>
          <span className="font-body-base text-body-base text-on-surface-variant text-[12px]">
            {projects.length} projects · {totalMappings} regulatory mappings
          </span>
        </div>
        <div className="flex items-center gap-md font-mono-technical text-[10px]">
          <span className="text-primary">{avgCoverage}% AVG COVERAGE</span>
          <span className="text-on-surface-variant">·</span>
          <span className="text-tertiary">{policyDocs.length} POLICY DOCS</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-xl">
        <div className="max-w-[1100px] mx-auto space-y-lg">
          {/* Framework Posture Grid */}
          <div className="bg-surface border border-border-muted">
            <div className="px-xl py-lg border-b border-border-muted">
              <h2 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest text-[10px]">
                REGULATORY FRAMEWORK POSTURE — ENTERPRISE-WIDE
              </h2>
            </div>
            <div className="grid grid-cols-3 divide-x divide-y divide-border-muted">
              {FRAMEWORK_ORDER.map((fw) => {
                const meta = FRAMEWORK_META[fw];
                const cov = coverageMap[fw];
                return (
                  <div key={fw} className="px-lg py-lg space-y-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <span
                          className={`px-2 py-0.5 font-mono-technical text-[9px] border ${meta.color}`}
                        >
                          {fw.replace("_", " ")}
                        </span>
                        <p className="font-body-bold text-body-bold text-on-surface text-[12px] mt-xs">
                          {meta.full}
                        </p>
                        <p className="font-mono-technical text-[10px] text-on-surface-variant">
                          {meta.sector} · {meta.region}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-xs">
                      <div className="flex justify-between font-mono-technical text-[10px]">
                        <span className="text-on-surface-variant">EVIDENCE COVERAGE</span>
                        <span
                          className={
                            cov.pct >= 70
                              ? "text-primary"
                              : cov.pct >= 40
                                ? "text-tertiary"
                                : "text-critical"
                          }
                        >
                          {cov.pct}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-surface-container-high w-full">
                        <div
                          className={`h-full ${cov.pct >= 70 ? "bg-primary" : cov.pct >= 40 ? "bg-tertiary" : "bg-critical"}`}
                          style={{ width: `${cov.pct}%` }}
                        />
                      </div>
                      <p className="font-mono-technical text-[10px] text-on-surface-variant">
                        {cov.verified} verified / {cov.total} total mappings
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Guardrails-as-Code Panel */}
          <GuardrailsPushPanel
            projects={projects}
            connectors={connectors}
            recentPushes={guardrailPushes.map((p) => ({
              ...p,
              projectName: projectMap.get(p.projectId)?.name ?? p.projectId,
              generatedAt: p.generatedAt.toISOString(),
              mergedAt: p.mergedAt?.toISOString() ?? null,
            }))}
          />

          {/* Governance Health Monitor */}
          {drift && (
            <div className="bg-surface border border-border-muted">
              <div className="px-xl py-lg border-b border-border-muted flex items-center justify-between">
                <h2 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest text-[10px]">
                  GOVERNANCE HEALTH MONITOR
                </h2>
                <div className="flex items-center gap-md font-mono-technical text-[10px]">
                  {drift.highCount > 0 && (
                    <span className="text-critical">{drift.highCount} HIGH</span>
                  )}
                  {drift.mediumCount > 0 && (
                    <span className="text-tertiary">{drift.mediumCount} MEDIUM</span>
                  )}
                  {drift.lowCount > 0 && (
                    <span className="text-on-surface-variant">{drift.lowCount} LOW</span>
                  )}
                  {drift.isClean && (
                    <span className="text-primary">ALL CLEAR</span>
                  )}
                </div>
              </div>
              {drift.isClean ? (
                <div className="px-xl py-lg">
                  <p className="font-mono-technical text-[11px] text-primary">
                    No governance drift detected. All evidence, approvals, and waivers are current.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border-muted">
                  {drift.signals.map((signal, i) => {
                    const sevCls =
                      signal.severity === "HIGH"
                        ? "text-critical border-critical"
                        : signal.severity === "MEDIUM"
                          ? "text-tertiary border-tertiary"
                          : "text-on-surface-variant border-border-muted";
                    return (
                      <div key={i} className="px-xl py-md flex items-start gap-md">
                        <span className={`mt-px font-mono-technical text-[9px] border px-1.5 py-0.5 shrink-0 ${sevCls}`}>
                          {signal.severity}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-body-bold text-body-bold text-on-surface text-[12px]">
                            {signal.message}
                          </p>
                          {signal.caseTitle && (
                            <p className="font-mono-technical text-[10px] text-on-surface-variant mt-xs">
                              CASE: {signal.caseTitle}
                              {signal.daysSince !== undefined && ` · ${signal.daysSince} days ago`}
                            </p>
                          )}
                        </div>
                        <span className="font-mono-technical text-[9px] text-on-surface-variant shrink-0">
                          {signal.type.replace(/_/g, " ")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Policy Document Corpus */}
          <div className="bg-surface border border-border-muted">
            <div className="px-xl py-lg border-b border-border-muted">
              <h2 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest text-[10px]">
                POLICY CORPUS ({policyDocs.length} DOCUMENTS)
              </h2>
            </div>
            {policyDocs.length === 0 ? (
              <div className="px-xl py-lg text-center">
                <p className="font-mono-technical text-[11px] text-on-surface-variant">
                  No policy documents indexed yet. Upload documents via Admin → Policy Corpus.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border-muted">
                {policyDocs.map((doc) => (
                  <div key={doc.id} className="px-xl py-md flex items-center justify-between">
                    <div>
                      <p className="font-body-bold text-body-bold text-on-surface text-[13px]">
                        {doc.title}
                      </p>
                      <p className="font-mono-technical text-[10px] text-on-surface-variant">
                        {doc.type} · {doc._count.chunks} chunks ·{" "}
                        {doc.indexedAt ? "INDEXED" : "PENDING INDEX"}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 font-mono-technical text-[9px] border ${doc.indexedAt ? "text-primary border-primary" : "text-on-surface-variant border-border-muted"}`}
                    >
                      {doc.indexedAt ? "READY" : "INDEXING"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Policy RAG Query Panel */}
          {firstProject && (
            <IntelligenceQueryPanel
              projectId={firstProject.id}
              aiMode={aiSetting?.mode ?? "AI_ASSIST"}
            />
          )}
        </div>
      </div>

      <footer className="h-8 bg-surface-container-low border-t border-border-muted flex items-center px-xl font-mono-technical text-[10px] text-on-surface-variant shrink-0">
        <span>
          FRAMEWORKS: {FRAMEWORK_ORDER.length} · MAPPINGS: {totalMappings} · GUARDRAILS_PUSHED:{" "}
          {guardrailPushes.filter((p) => p.status === "MERGED").length} MERGED
        </span>
      </footer>
    </>
  );
}
