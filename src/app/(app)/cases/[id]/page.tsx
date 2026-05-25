import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { GateStatus } from "@prisma/client";
import GateActions from "@/components/governance/GateActions";
import { computeDeliveryConfidence } from "@/lib/governance/confidence";
import AiReviewPanel from "@/components/governance/AiReviewPanel";
import CaseCommentBox from "@/components/governance/CaseCommentBox";

export const dynamic = "force-dynamic";

const DIMENSION_CONFIG: Array<{ key: string; label: string; weight: number }> = [
  { key: "regulatoryExp", label: "Regulatory Exposure", weight: 20 },
  { key: "productionImpact", label: "Production Impact", weight: 15 },
  { key: "aiInvolvement", label: "AI Involvement", weight: 15 },
  { key: "customerImpact", label: "Customer Impact", weight: 10 },
  { key: "dataExposure", label: "Data Exposure", weight: 10 },
  { key: "blastRadius", label: "Blast Radius", weight: 8 },
  { key: "securitySens", label: "Security Sensitivity", weight: 8 },
  { key: "deploymentCrit", label: "Deployment Criticality", weight: 5 },
  { key: "infraImpact", label: "Infrastructure Impact", weight: 4 },
  { key: "thirdPartyRisk", label: "Third-Party Risk", weight: 3 },
  { key: "incidentHistory", label: "Incident History", weight: 2 },
];

const INTENSITY_CLS: Record<string, string> = {
  enhanced: "text-critical border-critical bg-critical/10",
  regulated: "text-tertiary border-tertiary bg-tertiary/10",
  standard: "text-primary border-primary bg-primary/10",
  minimal: "text-on-surface-variant border-border-muted",
};

const GATE_STATUS_CLS: Record<string, string> = {
  APPROVED: "text-primary border-primary bg-primary/10",
  REJECTED: "text-critical border-critical bg-critical/10",
  OPEN: "text-tertiary border-tertiary bg-tertiary/10",
  PENDING: "text-on-surface-variant border-border-muted",
  BYPASSED_WITH_EXCEPTION: "text-tertiary border-tertiary/50",
};

function Icon({
  name,
  size = 16,
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

function DimensionBar({ value, weight }: { value: number; weight: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "bg-critical" : pct >= 50 ? "bg-tertiary" : "bg-primary";
  return (
    <div className="flex items-center gap-md">
      <div className="w-[120px] h-1.5 bg-surface-container-highest relative shrink-0">
        <div
          className={`absolute top-0 left-0 h-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`font-mono-technical text-[11px] w-6 ${pct >= 80 ? "text-critical" : pct >= 50 ? "text-tertiary" : "text-primary"}`}
      >
        {pct}
      </span>
      <span className="font-mono-technical text-[10px] text-on-surface-variant">×{weight}%</span>
    </div>
  );
}

export default async function CaseDetail({ params }: { params: { id: string } }) {
  const governanceCase = await prisma.governanceCase.findUnique({
    where: { id: params.id },
    include: {
      project: { select: { id: true, name: true, key: true } },
      context: true,
      riskScore: true,
      adaptivePipeline: true,
      governanceGates: {
        include: { approvalRequests: { orderBy: { requestedAt: "desc" } } },
        orderBy: { order: "asc" },
      },
      evidenceItems: {
        include: { regulatoryMappings: true },
        orderBy: { submittedAt: "desc" },
        take: 10,
      },
      comments: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!governanceCase) notFound();

  const waivers = await prisma.governanceWaiver.findMany({
    where: { caseId: params.id },
    orderBy: { requestedAt: "desc" },
  });

  const { context, riskScore, adaptivePipeline, governanceGates, evidenceItems } = governanceCase;

  const gatesIncluded: Array<{ slug: string; order: number; reason: string }> =
    (adaptivePipeline?.gatesIncluded as unknown as Array<{
      slug: string;
      order: number;
      reason: string;
    }>) ?? [];
  const gatesSkipped: Array<{ slug: string; skipReason: string; conditionMet: string }> =
    (adaptivePipeline?.gatesSkipped as unknown as Array<{
      slug: string;
      skipReason: string;
      conditionMet: string;
    }>) ?? [];
  const inheritedApprovals: Array<{
    gateSlug: string;
    inheritedFromCaseId: string;
    rationale: string;
  }> =
    (adaptivePipeline?.inheritedApprovals as unknown as Array<{
      gateSlug: string;
      inheritedFromCaseId: string;
      rationale: string;
    }>) ?? [];

  const approvedGates = governanceGates.filter((g) => g.status === GateStatus.APPROVED).length;
  const totalActive = governanceGates.filter((g) => !g.skipped).length;
  const criticalRisks = governanceGates.filter((g) => g.status === GateStatus.REJECTED && !g.skipped).length;

  const confidence = computeDeliveryConfidence({
    approvedGates,
    totalGates: totalActive,
    compositeRiskScore: riskScore?.compositeScore ?? 0,
    scoringConfidence: riskScore?.scoringConfidence ?? 0.5,
    reducedFromBaseline: adaptivePipeline?.reducedFromBaseline ?? 0,
    openCriticalRisks: criticalRisks,
    waiverCount: waivers.filter((w) => w.status === "approved").length,
  });

  return (
    <>
      {/* Top bar */}
      <header className="h-14 px-xl flex items-center justify-between border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <div className="flex items-center gap-md">
          <Link
            href="/cases"
            className="text-on-surface-variant hover:text-primary transition-colors"
          >
            <Icon name="arrow_back" size={18} />
          </Link>
          <span className="text-border-muted">|</span>
          <span className="font-mono-technical text-[11px] text-on-surface-variant">
            {governanceCase.project.key}
          </span>
          <span className="text-border-muted">·</span>
          <span className="font-mono-technical text-[11px] text-on-surface-variant">
            #{params.id.slice(-8).toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-md">
          {riskScore && (
            <span
              className={`px-2 py-0.5 font-mono-technical text-[10px] border ${INTENSITY_CLS[riskScore.intensity] ?? ""}`}
            >
              {riskScore.intensity?.toUpperCase()} RISK
            </span>
          )}
          <span
            className={`px-2 py-0.5 font-mono-technical text-[10px] border ${governanceCase.status === "active" ? "text-primary border-primary" : "text-on-surface-variant border-border-muted"}`}
          >
            {governanceCase.status.toUpperCase()}
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-xl">
        <div className="max-w-[1200px] mx-auto space-y-lg">
          {/* ── Delivery Confidence card ── */}
          <div className={`border-2 p-lg flex items-center gap-xl ${confidence.cls}`}>
            <div className={`w-14 h-14 border-2 flex items-center justify-center shrink-0 ${confidence.cls}`}>
              <span className={`font-bold leading-none ${confidence.cls.split(" ")[0]}`} style={{ fontSize: 20 }}>
                {confidence.score}%
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-mono-technical text-[18px] font-bold leading-none ${confidence.cls.split(" ")[0]}`}>
                {confidence.label}
              </p>
              <p className="font-mono-technical text-[11px] text-on-surface-variant mt-xs">
                DELIVERY CONFIDENCE · {approvedGates}/{totalActive} CHECKS CLEARED
                {adaptivePipeline?.reducedFromBaseline ? ` · ${adaptivePipeline.reducedFromBaseline} CHECKS OPTIMIZED BY AI` : ""}
              </p>
            </div>
            <div className="flex gap-md shrink-0">
              {confidence.drivers.map((d) => (
                <div key={d.label} className="text-right">
                  <p className={`font-mono-technical text-[11px] font-bold ${d.positive ? "text-primary" : "text-critical"}`}>
                    {d.value}
                  </p>
                  <p className="font-mono-technical text-[9px] text-on-surface-variant">{d.label.toUpperCase()}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Case title + metadata ── */}
          <div className="bg-surface border border-border-muted p-xl">
            <h1 className="font-headline-md text-headline-md text-on-surface mb-sm">
              {governanceCase.title}
            </h1>
            {governanceCase.description && (
              <p className="font-body-base text-body-base text-on-surface-variant mb-lg">
                {governanceCase.description}
              </p>
            )}
            <div className="flex flex-wrap gap-lg font-mono-technical text-[11px] text-on-surface-variant">
              <span>PHASE: {governanceCase.phase.replace("-", " ").toUpperCase()}</span>
              {governanceCase.ownedBy && <span>OWNER: {governanceCase.ownedBy}</span>}
              {governanceCase.sourceEpicKey && (
                <span className="text-primary">JIRA: {governanceCase.sourceEpicKey}</span>
              )}
              {governanceCase.sourceGovEpicKey && (
                <span className="text-primary">GOV EPIC: {governanceCase.sourceGovEpicKey}</span>
              )}
              <span>
                CREATED:{" "}
                {new Date(governanceCase.createdAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-lg">
            {/* Left column: Context + Risk Score + Pipeline */}
            <div className="col-span-12 lg:col-span-7 space-y-lg">
              {/* ── Governance Context ── */}
              {context && (
                <section className="bg-surface border border-border-muted">
                  <div className="px-xl py-md border-b border-border-muted flex items-center gap-md">
                    <Icon name="hub" size={14} />
                    <span className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">
                      DELIVERY CONTEXT
                    </span>
                    <span className="ml-auto font-mono-technical text-[9px] text-on-surface-variant">
                      ENRICHED {new Date(context.enrichedAt).toLocaleDateString("en-GB")}
                    </span>
                  </div>
                  <div className="p-xl space-y-lg">
                    {context.contextSummary && (
                      <p className="font-body-base text-body-base text-on-surface-variant leading-relaxed border-l-2 border-primary pl-md">
                        {context.contextSummary}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-md">
                      {[
                        { label: "Environment", value: context.environment ?? "—" },
                        { label: "Data Classification", value: context.dataClassification ?? "—" },
                        {
                          label: "AI System Involved",
                          value: context.aiSystemInvolved ? "YES" : "NO",
                          cls: context.aiSystemInvolved ? "text-tertiary" : undefined,
                        },
                        {
                          label: "Third-Party Changes",
                          value: context.thirdPartyChanges ? "YES" : "NO",
                          cls: context.thirdPartyChanges ? "text-tertiary" : undefined,
                        },
                        {
                          label: "Infrastructure",
                          value: context.infrastructureChange ? "YES" : "NO",
                        },
                        {
                          label: "Prior Incidents",
                          value: String(context.priorIncidents),
                          cls: context.priorIncidents > 0 ? "text-critical" : "text-primary",
                        },
                      ].map((r) => (
                        <div
                          key={r.label}
                          className="flex items-center justify-between py-xs border-b border-border-muted last:border-0"
                        >
                          <span className="font-mono-technical text-[10px] text-on-surface-variant">
                            {r.label}
                          </span>
                          <span
                            className={`font-mono-technical text-[11px] ${r.cls ?? "text-on-surface"}`}
                          >
                            {r.value}
                          </span>
                        </div>
                      ))}
                    </div>
                    {context.confluenceRefs.length > 0 && (
                      <div>
                        <p className="font-mono-technical text-[10px] text-on-surface-variant mb-xs">
                          CONFLUENCE REFS
                        </p>
                        <div className="flex flex-wrap gap-xs">
                          {context.confluenceRefs.map((ref) => (
                            <span
                              key={ref}
                              className="px-2 py-0.5 font-mono-technical text-[10px] border border-border-muted text-on-surface-variant"
                            >
                              {ref}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* ── Risk Scoring ── */}
              {riskScore && (
                <section className="bg-surface border border-border-muted">
                  <div className="px-xl py-md border-b border-border-muted flex items-center gap-md">
                    <Icon name="analytics" size={14} />
                    <span className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">
                      RISK ASSESSMENT
                    </span>
                    <span className="ml-auto font-mono-technical text-[10px] text-primary font-bold">
                      {Math.round(riskScore.compositeScore)}/100
                    </span>
                  </div>
                  <div className="p-xl">
                    {/* Composite + intensity */}
                    <div className="flex items-center gap-xl mb-xl">
                      <div>
                        <div className="flex items-baseline gap-sm">
                          <span
                            className="font-bold text-on-surface"
                            style={{ fontSize: 48, lineHeight: 1 }}
                          >
                            {Math.round(riskScore.compositeScore)}
                          </span>
                          <span className="font-mono-technical text-[11px] text-on-surface-variant">
                            /100
                          </span>
                        </div>
                        <div className="flex gap-sm mt-sm">
                          <span
                            className={`px-2 py-0.5 font-mono-technical text-[10px] border ${INTENSITY_CLS[riskScore.intensity] ?? ""}`}
                          >
                            {riskScore.intensity?.toUpperCase()}
                          </span>
                          <span className="px-2 py-0.5 font-mono-technical text-[10px] border border-border-muted text-on-surface-variant">
                            AI MODE: {riskScore.aiModeRecommended.replace("_", " ")}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 h-2 bg-surface-container-highest relative">
                        <div
                          className={`absolute top-0 left-0 h-full transition-all ${
                            riskScore.compositeScore >= 75
                              ? "bg-critical"
                              : riskScore.compositeScore >= 50
                                ? "bg-tertiary"
                                : "bg-primary"
                          }`}
                          style={{ width: `${riskScore.compositeScore}%` }}
                        />
                      </div>
                    </div>

                    {/* 11 dimensions */}
                    <div className="space-y-sm mb-lg">
                      {DIMENSION_CONFIG.map(({ key, label, weight }) => {
                        const val = ((riskScore as Record<string, unknown>)[key] as number) ?? 0;
                        return (
                          <div key={key} className="flex items-center gap-md">
                            <span className="font-mono-technical text-[10px] text-on-surface-variant w-[160px] shrink-0">
                              {label}
                            </span>
                            <DimensionBar value={val} weight={weight} />
                          </div>
                        );
                      })}
                    </div>

                    {/* AI reasoning */}
                    {riskScore.reasoning && (
                      <div className="border-t border-border-muted pt-lg">
                        <p className="font-mono-technical text-[10px] text-on-surface-variant mb-sm">
                          AI SCORING RATIONALE
                        </p>
                        <p className="font-body-base text-body-base text-on-surface-variant leading-relaxed text-[12px]">
                          {riskScore.reasoning}
                        </p>
                        {riskScore.retrievedPolicyIds.length > 0 && (
                          <div className="mt-sm flex flex-wrap gap-xs">
                            <span className="font-mono-technical text-[9px] text-on-surface-variant">
                              CITED:
                            </span>
                            {riskScore.retrievedPolicyIds.map((id) => (
                              <span
                                key={id}
                                className="font-mono-technical text-[9px] text-primary"
                              >
                                [{id.slice(-6)}]
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* ── Adaptive Pipeline Composition ── */}
              {adaptivePipeline && (
                <section className="bg-surface border border-border-muted">
                  <div className="px-xl py-md border-b border-border-muted flex items-center gap-md">
                    <Icon name="account_tree" size={14} />
                    <span className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">
                      PIPELINE OPTIMIZATION
                    </span>
                    {adaptivePipeline.reducedFromBaseline > 0 && (
                      <span className="ml-auto font-mono-technical text-[10px] text-primary">
                        -{adaptivePipeline.reducedFromBaseline} CHECKS OPTIMIZED
                      </span>
                    )}
                  </div>
                  <div className="p-xl space-y-lg">
                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-md">
                      {[
                        { label: "Checks Active", value: String(adaptivePipeline.totalGateCount) },
                        { label: "Checks Optimized", value: String(gatesSkipped.length) },
                        { label: "Approvals Inherited", value: String(inheritedApprovals.length) },
                      ].map((s) => (
                        <div key={s.label} className="text-center border border-border-muted p-md">
                          <p className="font-bold text-primary text-xl leading-none mb-xs">
                            {s.value}
                          </p>
                          <p className="font-mono-technical text-[9px] text-on-surface-variant">
                            {s.label}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Gates included with rationale */}
                    {gatesIncluded.length > 0 && (
                      <div>
                        <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest mb-sm">
                          INCLUDED CHECKS
                        </p>
                        <div className="space-y-xs">
                          {gatesIncluded.map((g) => (
                            <div
                              key={g.slug}
                              className="flex items-start gap-md py-xs border-b border-border-muted last:border-0"
                            >
                              <Icon
                                name="check_circle"
                                size={14}
                                className="text-primary mt-0.5 shrink-0"
                              />
                              <div>
                                <p className="font-mono-technical text-[11px] text-on-surface">
                                  {g.slug}
                                </p>
                                {g.reason && (
                                  <p className="font-mono-technical text-[10px] text-on-surface-variant mt-0.5">
                                    {g.reason}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Gates skipped */}
                    {gatesSkipped.length > 0 && (
                      <div>
                        <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest mb-sm">
                          OPTIMIZED CHECKS
                        </p>
                        <div className="space-y-xs">
                          {gatesSkipped.map((g) => (
                            <div
                              key={g.slug}
                              className="flex items-start gap-md py-xs border-b border-border-muted last:border-0"
                            >
                              <Icon
                                name="remove_circle"
                                size={14}
                                className="text-on-surface-variant mt-0.5 shrink-0"
                              />
                              <div>
                                <p className="font-mono-technical text-[11px] text-on-surface-variant line-through">
                                  {g.slug}
                                </p>
                                <p className="font-mono-technical text-[10px] text-on-surface-variant mt-0.5">
                                  {g.skipReason}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Inherited approvals */}
                    {inheritedApprovals.length > 0 && (
                      <div>
                        <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest mb-sm">
                          INHERITED APPROVALS
                        </p>
                        <div className="space-y-xs">
                          {inheritedApprovals.map((a) => (
                            <div
                              key={a.gateSlug}
                              className="flex items-start gap-md py-xs border-b border-border-muted last:border-0"
                            >
                              <Icon
                                name="link"
                                size={14}
                                className="text-tertiary mt-0.5 shrink-0"
                              />
                              <div>
                                <p className="font-mono-technical text-[11px] text-on-surface">
                                  {a.gateSlug}
                                </p>
                                <p className="font-mono-technical text-[10px] text-tertiary">
                                  Inherited from #{a.inheritedFromCaseId.slice(-8).toUpperCase()}
                                </p>
                                {a.rationale && (
                                  <p className="font-mono-technical text-[10px] text-on-surface-variant mt-0.5">
                                    {a.rationale}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>

            {/* Right column: Savings + Gates + Waivers + Evidence */}
            <div className="col-span-12 lg:col-span-5 space-y-lg">
              {/* ── Governance Savings ── */}
              {(gatesSkipped.length > 0 || inheritedApprovals.length > 0) && (
                <section className="bg-surface border border-primary/30 p-lg">
                  <div className="flex items-center gap-md mb-md">
                    <Icon name="trending_down" size={14} className="text-primary" />
                    <span className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">
                      EFFICIENCY SAVINGS
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-md text-center">
                    <div>
                      <p className="font-bold text-primary leading-none" style={{ fontSize: 28 }}>
                        {gatesSkipped.length + inheritedApprovals.length}
                      </p>
                      <p className="font-mono-technical text-[9px] text-on-surface-variant mt-xs">
                        OVERHEAD REMOVED
                      </p>
                    </div>
                    <div className="border-x border-border-muted">
                      <p className="font-bold text-on-surface leading-none" style={{ fontSize: 28 }}>
                        ≈{(gatesSkipped.length + inheritedApprovals.length) * 2}h
                      </p>
                      <p className="font-mono-technical text-[9px] text-on-surface-variant mt-xs">
                        TIME RETURNED
                      </p>
                    </div>
                    <div>
                      <p className="font-bold text-on-surface leading-none" style={{ fontSize: 28 }}>
                        {inheritedApprovals.length}
                      </p>
                      <p className="font-mono-technical text-[9px] text-on-surface-variant mt-xs">
                        REVIEWS INHERITED
                      </p>
                    </div>
                  </div>
                  {gatesSkipped.length > 0 && (
                    <p className="font-mono-technical text-[10px] text-primary mt-md border-t border-border-muted pt-md">
                      AI REMOVED {gatesSkipped.length} NON-APPLICABLE CHECK{gatesSkipped.length !== 1 ? "S" : ""} FROM READINESS FLOW
                    </p>
                  )}
                </section>
              )}

              {/* ── Readiness Advisor ── */}
              <section className="bg-surface border border-primary/20 p-lg">
                <div className="flex items-center gap-md mb-md">
                  <Icon name="psychology" size={14} className="text-primary" />
                  <span className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">
                    READINESS ADVISOR
                  </span>
                  <span className="ml-auto font-mono-technical text-[9px] text-on-surface-variant">
                    AI · CASE CONTEXT
                  </span>
                </div>
                <AiReviewPanel
                  caseId={params.id}
                  triggerLabel="Analyse readiness — what's missing?"
                />
              </section>

              {/* ── Gate Pipeline ── */}
              <section className="bg-surface border border-border-muted">
                <div className="px-xl py-md border-b border-border-muted flex items-center justify-between">
                  <div className="flex items-center gap-md">
                    <Icon name="checklist" size={14} />
                    <span className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">
                      READINESS FLOW
                    </span>
                  </div>
                  <span className="font-mono-technical text-[10px] text-primary">
                    {approvedGates}/{totalActive} CLEARED
                  </span>
                </div>
                <div className="divide-y divide-border-muted">
                  {governanceGates.length === 0 ? (
                    <p className="p-xl font-mono-technical text-[11px] text-on-surface-variant">
                      No gates configured.
                    </p>
                  ) : (
                    governanceGates.map((gate) => (
                      <div key={gate.id} className={`p-lg ${gate.skipped ? "opacity-50" : ""}`}>
                        <div className="flex items-start justify-between gap-md mb-xs">
                          <div className="flex items-center gap-sm">
                            <span className="font-mono-technical text-[10px] text-on-surface-variant w-4 shrink-0">
                              {gate.order}
                            </span>
                            <div>
                              <p className="font-body-bold text-body-bold text-on-surface text-[12px]">
                                {gate.name}
                              </p>
                              {gate.inheritedFrom && (
                                <p className="font-mono-technical text-[9px] text-tertiary mt-0.5">
                                  INHERITED FROM #{gate.inheritedFrom.slice(-8).toUpperCase()}
                                </p>
                              )}
                            </div>
                          </div>
                          <span
                            className={`px-1.5 py-0.5 font-mono-technical text-[9px] border shrink-0 ${
                              gate.skipped
                                ? "text-on-surface-variant border-border-muted"
                                : (GATE_STATUS_CLS[gate.status] ?? GATE_STATUS_CLS.PENDING)
                            }`}
                          >
                            {gate.skipped ? "SKIPPED" : gate.status}
                          </span>
                        </div>
                        {gate.skipReason && (
                          <p className="font-mono-technical text-[10px] text-on-surface-variant ml-6">
                            Skip: {gate.skipReason}
                          </p>
                        )}
                        {gate.approvedBy && (
                          <p className="font-mono-technical text-[10px] text-primary ml-6">
                            Approved by {gate.approvedBy} ·{" "}
                            {gate.approvedAt
                              ? new Date(gate.approvedAt).toLocaleDateString("en-GB")
                              : ""}
                          </p>
                        )}
                        {gate.rejectedBy && (
                          <p className="font-mono-technical text-[10px] text-critical ml-6">
                            Rejected by {gate.rejectedBy}
                          </p>
                        )}
                        <GateActions
                          gate={{
                            id: gate.id,
                            name: gate.name,
                            status: gate.status,
                            skipped: gate.skipped,
                            pendingApprovalId:
                              gate.approvalRequests.find((r) => r.status === "PENDING")?.id ?? null,
                          }}
                          caseId={params.id}
                          projectId={governanceCase.project.id}
                        />
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* ── Waivers ── */}
              {waivers.length > 0 && (
                <section className="bg-surface border border-border-muted">
                  <div className="px-xl py-md border-b border-border-muted flex items-center gap-md">
                    <Icon name="policy" size={14} />
                    <span className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">
                      RISK ACCEPTANCES
                    </span>
                    <span className="ml-auto font-mono-technical text-[10px] text-tertiary">
                      {waivers.length}
                    </span>
                  </div>
                  <div className="divide-y divide-border-muted">
                    {waivers.map((w) => {
                      const controls =
                        (w.compensatingControls as Array<{
                          control: string;
                          owner: string;
                          dueDate?: string;
                        }>) ?? [];
                      return (
                        <div key={w.id} className="p-lg space-y-sm">
                          <div className="flex items-start justify-between gap-md">
                            <div>
                              <p className="font-body-bold text-body-bold text-on-surface text-[12px]">
                                {w.waiverType.replace("-", " ").toUpperCase()}
                              </p>
                              <p className="font-mono-technical text-[10px] text-on-surface-variant mt-0.5">
                                {w.reason}
                              </p>
                            </div>
                            <span
                              className={`px-1.5 py-0.5 font-mono-technical text-[9px] border shrink-0 ${
                                w.status === "approved"
                                  ? "text-primary border-primary bg-primary/10"
                                  : w.status === "rejected"
                                    ? "text-critical border-critical"
                                    : "text-tertiary border-tertiary"
                              }`}
                            >
                              {w.status.toUpperCase()}
                            </span>
                          </div>
                          {w.residualRisk && (
                            <div className="bg-surface-container-low p-md border-l-2 border-tertiary">
                              <p className="font-mono-technical text-[10px] text-on-surface-variant mb-xs">
                                RESIDUAL RISK
                              </p>
                              <p className="font-mono-technical text-[11px] text-on-surface">
                                {w.residualRisk}
                              </p>
                            </div>
                          )}
                          {controls.length > 0 && (
                            <div>
                              <p className="font-mono-technical text-[10px] text-on-surface-variant mb-xs">
                                COMPENSATING CONTROLS
                              </p>
                              <div className="space-y-xs">
                                {controls.map((ctrl, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center gap-md font-mono-technical text-[10px]"
                                  >
                                    <Icon
                                      name="shield"
                                      size={12}
                                      className="text-primary shrink-0"
                                    />
                                    <span className="text-on-surface flex-1">{ctrl.control}</span>
                                    <span className="text-on-surface-variant">{ctrl.owner}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {w.approvedBy && (
                            <p className="font-mono-technical text-[10px] text-primary">
                              Approved by {w.approvedBy} ·{" "}
                              {w.approvedAt
                                ? new Date(w.approvedAt).toLocaleDateString("en-GB")
                                : ""}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* ── Evidence ── */}
              {evidenceItems.length > 0 && (
                <section className="bg-surface border border-border-muted">
                  <div className="px-xl py-md border-b border-border-muted flex items-center gap-md">
                    <Icon name="inventory_2" size={14} />
                    <span className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">
                      LINKED EVIDENCE
                    </span>
                    <span className="ml-auto font-mono-technical text-[10px] text-on-surface-variant">
                      {evidenceItems.length}
                    </span>
                  </div>
                  <div className="divide-y divide-border-muted">
                    {evidenceItems.map((e) => (
                      <div key={e.id} className="p-lg">
                        <div className="flex items-start justify-between gap-md">
                          <div>
                            <p className="font-body-bold text-body-bold text-on-surface text-[12px]">
                              {e.title}
                            </p>
                            <div className="flex flex-wrap gap-xs mt-xs">
                              <span className="font-mono-technical text-[9px] border border-border-muted px-1.5 py-0.5 text-on-surface-variant">
                                {e.type.replace("_", " ")}
                              </span>
                              {e.regulatoryMappings.map((m) => (
                                <span
                                  key={m.id}
                                  className={`font-mono-technical text-[9px] border px-1.5 py-0.5 ${
                                    m.verifiedAt
                                      ? "border-primary text-primary"
                                      : "border-border-muted text-on-surface-variant"
                                  }`}
                                >
                                  {m.framework} · {m.controlId}
                                </span>
                              ))}
                            </div>
                          </div>
                          {e.hash && (
                            <span className="font-mono-technical text-[9px] text-on-surface-variant shrink-0">
                              {e.hash.slice(0, 8)}…
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
          {/* ── Comments + Lifecycle Actions ── */}
          <CaseCommentBox
            caseId={params.id}
            caseStatus={governanceCase.status}
            ownedBy={governanceCase.ownedBy ?? null}
            comments={governanceCase.comments.map((c) => ({
              id: c.id,
              authorEmail: c.authorEmail,
              body: c.body,
              createdAt: c.createdAt.toISOString(),
            }))}
          />
        </div>
      </div>

      <footer className="h-8 bg-surface-container-low border-t border-border-muted flex items-center justify-between px-xl font-mono-technical text-[10px] text-on-surface-variant shrink-0">
        <div className="flex items-center gap-xl">
          <span>CASE: #{params.id.slice(-8).toUpperCase()}</span>
          {riskScore && (
            <span>
              INTENSITY: {riskScore.intensity?.toUpperCase()} · SCORE:{" "}
              {Math.round(riskScore.compositeScore)}
            </span>
          )}
          {adaptivePipeline && adaptivePipeline.reducedFromBaseline > 0 && (
            <span className="text-primary">
              {adaptivePipeline.reducedFromBaseline} CHECKS OPTIMIZED BY ADAPTIVE ENGINE
            </span>
          )}
        </div>
        <Link href="/timeline" className="text-primary hover:underline">
          FLIGHT RECORDER →
        </Link>
      </footer>
    </>
  );
}
