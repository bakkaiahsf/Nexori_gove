import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/db";
import {
  getProjectSummary,
  getPendingApprovals,
  getEscalations,
  DEMO_PROJECT_KEY,
} from "@/lib/governance";
import { computeDeliveryConfidence } from "@/lib/governance/confidence";
import HeatmapClient from "@/components/governance/HeatmapClient";
import StatusBarClient from "@/components/governance/StatusBarClient";
import ApproveButton from "@/components/governance/ApproveButton";
import SearchBar from "@/components/governance/SearchBar";

// Server Component — fetches directly from Prisma, no API overhead
export const dynamic = "force-dynamic";

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

const R = 44;
const CIRC = 2 * Math.PI * R;

const VERDICT_STROKE: Record<string, string> = {
  READY: "#50dbcb",
  CONDITIONAL: "#f59e0b",
  BLOCKED: "#ef4444",
};

function DeliveryGauge({ score, verdict }: { score: number; verdict: string }) {
  const offset = CIRC * (1 - score / 100);
  const stroke = VERDICT_STROKE[verdict] ?? "#50dbcb";
  return (
    <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={R} fill="transparent" stroke="#2B3648" strokeWidth="4" />
        <circle
          cx="48"
          cy="48"
          r={R}
          fill="transparent"
          stroke={stroke}
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          strokeWidth="4"
        />
      </svg>
      <span className="absolute font-stat-lg text-stat-lg text-on-surface">{score}%</span>
    </div>
  );
}

function phaseLabel(phase: string): string {
  const map: Record<string, string> = {
    "change-delivery": "Change",
    "ai-deployment": "AI Deploy",
    "third-party-onboarding": "3rd Party",
    incident: "Incident",
  };
  return map[phase] ?? phase;
}

export default async function CommandCenter() {
  const session = await getServerSession(authOptions);
  const project = await prisma.project.findUnique({
    where: { key: DEMO_PROJECT_KEY },
    select: { id: true },
  });

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="font-mono-technical text-on-surface-variant text-[12px]">
          No project data — run: <code className="text-primary">npx prisma db seed</code>
        </p>
      </div>
    );
  }

  const [summary, approvals, escalations, activeCases] = await Promise.all([
    getProjectSummary(project.id),
    getPendingApprovals(project.id),
    getEscalations(project.id),
    prisma.governanceCase.findMany({
      where: { projectId: project.id, status: "active" },
      select: {
        id: true,
        riskScore: { select: { compositeScore: true, scoringConfidence: true } },
        adaptivePipeline: { select: { reducedFromBaseline: true } },
      },
    }),
  ]);

  const activeCaseIds = activeCases.map((c) => c.id);
  const waiverCount =
    activeCaseIds.length > 0
      ? await prisma.governanceWaiver.count({
          where: { caseId: { in: activeCaseIds }, status: "approved" },
        })
      : 0;

  const riskScores = activeCases.map((c) => c.riskScore).filter(Boolean);
  const avgCompositeScore =
    riskScores.length > 0
      ? riskScores.reduce((sum, r) => sum + r!.compositeScore, 0) / riskScores.length
      : 0;
  const avgScoringConfidence =
    riskScores.length > 0
      ? riskScores.reduce((sum, r) => sum + r!.scoringConfidence, 0) / riskScores.length
      : 0.5;
  const totalGatesSaved = activeCases.reduce(
    (sum, c) => sum + (c.adaptivePipeline?.reducedFromBaseline ?? 0),
    0
  );

  const confidence = computeDeliveryConfidence({
    approvedGates: summary.approvedGates,
    totalGates: summary.totalGates,
    compositeRiskScore: avgCompositeScore,
    scoringConfidence: avgScoringConfidence,
    reducedFromBaseline: totalGatesSaved,
    openCriticalRisks: summary.criticalRisks,
    waiverCount,
  });

  return (
    <>
      {/* ── Top Bar ── */}
      <header className="h-16 px-xl flex justify-between items-center border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <div className="flex items-center gap-xl">
          <h1 className="font-display-lg text-display-lg text-primary tracking-tight">NexoriOS</h1>
          <SearchBar />
        </div>
        <div className="flex items-center gap-lg">
          <div className="flex gap-md border-r border-border-muted pr-lg">
            {summary.pendingApprovals > 0 && (
              <span className="flex items-center gap-xs px-2 py-0.5 bg-tertiary/20 text-tertiary border border-tertiary font-mono-technical text-[10px]">
                {summary.pendingApprovals} PENDING
              </span>
            )}
            {["notifications", "settings", "help"].map((icon) => (
              <button
                key={icon}
                className="text-on-surface-variant hover:text-primary transition-colors"
              >
                <Icon name={icon} />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-md">
            <div className="w-8 h-8 bg-primary/10 border border-primary flex items-center justify-center font-mono-technical text-[10px] text-primary">
              {session?.user?.name
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase() ?? "??"}
            </div>
            <div className="hidden lg:block">
              <p className="font-body-bold text-body-bold text-on-surface">
                {session?.user?.name ?? "Guest"}
              </p>
              <p className="font-mono-technical text-[10px] text-primary">
                {(session?.user?.role ?? "viewer").toUpperCase()}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Dashboard Canvas ── */}
      <div className="flex-1 overflow-y-auto p-xl custom-scrollbar">
        <div className="max-w-[1440px] mx-auto grid grid-cols-12 gap-lg">
          {/* Left 8 cols */}
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
                  <span
                    className="font-display-lg leading-none font-bold text-on-surface"
                    style={{ fontSize: 64 }}
                  >
                    {summary.healthScore}
                  </span>
                  <span className="font-mono-technical text-body-bold text-primary">
                    {summary.approvedGates}/{summary.totalGates} GATES
                  </span>
                </div>
              </div>
              <div className="mt-xl">
                <div className="w-full h-[3px] bg-surface-container-highest relative">
                  <div
                    className="absolute top-0 left-0 h-full bg-primary transition-all"
                    style={{ width: `${summary.healthScore}%` }}
                  />
                </div>
                <div className="flex justify-between mt-sm font-mono-technical text-[10px] text-on-surface-variant">
                  <span>
                    {summary.activeCases} ACTIVE CASES · {summary.evidenceMapped}/
                    {summary.totalEvidence} EVIDENCE MAPPED
                  </span>
                  <span className={summary.healthScore < 85 ? "text-critical" : "text-primary"}>
                    THRESHOLD: 85%
                  </span>
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
                  {
                    dot: "bg-primary animate-pulse",
                    label: "Core Engines",
                    value: "NOMINAL",
                    vc: "text-on-surface",
                  },
                  {
                    dot: "bg-primary",
                    label: "Governance DB",
                    value: "ACTIVE",
                    vc: "text-on-surface",
                  },
                  {
                    dot: summary.criticalRisks > 0 ? "bg-critical" : "bg-tertiary",
                    label: "Risk Monitor",
                    value:
                      summary.criticalRisks > 0
                        ? `${summary.criticalRisks} CRITICAL`
                        : `${summary.openRisks} OPEN`,
                    vc: summary.criticalRisks > 0 ? "text-critical" : "text-tertiary",
                  },
                ].map((row, i, arr) => (
                  <div
                    key={row.label}
                    className={`flex items-center justify-between py-xs ${i < arr.length - 1 ? "border-b border-border-muted" : ""}`}
                  >
                    <div className="flex items-center gap-md">
                      <div className={`w-2 h-2 rounded-full ${row.dot}`} />
                      <span className="font-body-bold text-body-bold text-on-surface">
                        {row.label}
                      </span>
                    </div>
                    <span className={`font-mono-technical text-[11px] ${row.vc}`}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk Heatmap — Client Island */}
            <HeatmapClient criticalRisks={summary.criticalRisks} openRisks={summary.openRisks} />
          </div>

          {/* Right 4 cols */}
          <div className="col-span-12 lg:col-span-4 space-y-lg">
            {/* Delivery Confidence */}
            <div
              className="bg-surface border border-border-muted p-xl flex flex-col justify-between"
              style={{ minHeight: 192 }}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
                  DELIVERY CONFIDENCE
                </h3>
                <span className={`px-2 py-0.5 font-mono-technical text-[10px] border ${confidence.cls}`}>
                  {confidence.label}
                </span>
              </div>
              <div className="flex items-center gap-lg mt-lg">
                <DeliveryGauge score={confidence.score} verdict={confidence.verdict} />
                <div className="flex-1 space-y-sm">
                  <p className="font-mono-technical text-[11px] text-on-surface-variant uppercase">
                    Key Drivers
                  </p>
                  <ul className="space-y-xs">
                    {confidence.drivers.map((d) => (
                      <li key={d.label} className="flex items-center justify-between">
                        <span className="text-[10px] font-mono-technical text-on-surface-variant">
                          {d.label.toUpperCase()}
                        </span>
                        <span
                          className={`text-[10px] font-mono-technical ${d.positive ? "text-primary" : "text-critical"}`}
                        >
                          {d.value}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Governance Efficiency */}
            {totalGatesSaved > 0 && (
              <div className="bg-surface border border-primary/30 p-xl">
                <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-md">
                  GOVERNANCE EFFICIENCY
                </h3>
                <div className="flex items-end justify-between">
                  <div>
                    <span className="font-bold text-on-surface leading-none" style={{ fontSize: 36 }}>
                      {totalGatesSaved}
                    </span>
                    <p className="font-mono-technical text-[10px] text-primary mt-xs">
                      GATES SAVED BY AI OPTIMISATION
                    </p>
                  </div>
                  <div className="text-right space-y-xs">
                    <p className="font-mono-technical text-[11px] text-on-surface-variant">
                      ≈{totalGatesSaved * 2}h RETURNED
                    </p>
                    <p className="font-mono-technical text-[10px] text-primary">
                      {summary.activeCases} ACTIVE CASES
                    </p>
                  </div>
                </div>
              </div>
            )}

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
                  MODE: {summary.aiMode.replace("_", " ")}
                </span>
                <p className="font-body-base text-body-base text-on-surface-variant leading-relaxed">
                  Governance AI operating under controlled policy. Every invocation logged as{" "}
                  <span className="text-primary">AIUsageEvent</span>. DORA Art. 28 compliant.
                </p>
                <div className="flex items-center justify-between pt-md border-t border-border-muted">
                  <span className="font-mono-technical text-[10px] text-on-surface-variant">
                    SAFETY_LOCK: ENGAGED
                  </span>
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
                <span
                  className={`px-2 py-0.5 font-mono-technical text-[10px] ${
                    escalations.some((e) => e.severity === "CRITICAL")
                      ? "bg-critical text-on-error"
                      : "bg-tertiary/20 text-tertiary border border-tertiary"
                  }`}
                >
                  {String(escalations.length).padStart(2, "0")} ACTIVE
                </span>
              </div>
              <div className="divide-y divide-border-muted">
                {escalations.length === 0 ? (
                  <div className="p-lg">
                    <p className="font-mono-technical text-[11px] text-primary">
                      No active escalations.
                    </p>
                  </div>
                ) : (
                  escalations.map((e) => (
                    <div
                      key={e.id}
                      className="p-lg hover:bg-surface-container-high transition-colors cursor-pointer"
                    >
                      <div className="flex justify-between mb-1">
                        <span className="font-body-bold text-body-bold text-on-surface truncate pr-2">
                          {e.title}
                        </span>
                        <span
                          className={`font-mono-technical text-[11px] shrink-0 ${e.severity === "CRITICAL" ? "text-critical" : "text-tertiary"}`}
                        >
                          {e.severity}
                        </span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant font-mono-technical truncate">
                        {e.description}
                      </p>
                    </div>
                  ))
                )}
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
                <span className="text-primary font-mono-technical text-[11px]">
                  {approvals.length} QUEUED REQUEST{approvals.length !== 1 ? "S" : ""}
                </span>
              </div>
              {approvals.length === 0 ? (
                <div className="p-xl">
                  <p className="font-mono-technical text-[11px] text-primary">
                    All approvals complete.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-surface-container-low border-b border-border-muted">
                      <tr>
                        {["REQUEST_ID", "GATE", "CASE", "URGENCY", "EXPIRES", "ACTION"].map(
                          (h, i) => (
                            <th
                              key={h}
                              className={`px-xl py-md font-label-caps text-label-caps text-on-surface-variant ${i === 5 ? "text-right" : ""}`}
                            >
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-muted">
                      {approvals.map((a) => (
                        <tr
                          key={a.id}
                          className="hover:bg-surface-container-highest transition-colors"
                        >
                          <td className="px-xl py-md font-mono-technical text-[12px] text-on-surface-variant">
                            #{a.id.slice(-6).toUpperCase()}
                          </td>
                          <td className="px-xl py-md font-body-base text-body-base text-on-surface">
                            {a.gate.name}
                          </td>
                          <td className="px-xl py-md font-mono-technical text-[11px] text-on-surface-variant">
                            {phaseLabel(a.gate.case.phase)}
                          </td>
                          <td className="px-xl py-md">
                            <span className="px-2 py-0.5 border border-tertiary/30 text-tertiary font-mono-technical text-[10px]">
                              PENDING
                            </span>
                          </td>
                          <td className="px-xl py-md font-mono-technical text-[11px] text-on-surface-variant">
                            {a.expiresAt ? new Date(a.expiresAt).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-xl py-md text-right">
                            <ApproveButton approvalId={a.id} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <StatusBarClient />
    </>
  );
}
