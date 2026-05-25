import prisma from "@/lib/db";
import { DEMO_PROJECT_KEY } from "@/lib/governance";
import { computeDeliveryConfidence } from "@/lib/governance/confidence";
import { GateStatus } from "@prisma/client";
import Link from "next/link";
import NewCaseButton from "@/components/governance/NewCaseButton";

export const dynamic = "force-dynamic";

const PHASE_META: Record<string, { label: string; cls: string }> = {
  "change-delivery": { label: "Change", cls: "text-primary border-primary bg-primary/10" },
  "ai-deployment": { label: "AI Deploy", cls: "text-tertiary border-tertiary bg-tertiary/10" },
  "third-party-onboarding": {
    label: "3rd Party",
    cls: "text-on-surface-variant border-border-muted",
  },
  incident: { label: "Incident", cls: "text-critical border-critical bg-critical/10" },
};

const STATUS_CLS: Record<string, string> = {
  active: "text-primary border-primary bg-primary/10",
  closed: "text-on-surface-variant border-border-muted",
  archived: "text-on-surface-variant border-border-muted opacity-50",
};

function GateBar({ approved, total }: { approved: number; total: number }) {
  const pct = total > 0 ? Math.round((approved / total) * 100) : 0;
  return (
    <div className="flex items-center gap-md">
      <div className="flex-1 h-1 bg-surface-container-highest relative">
        <div
          className="absolute top-0 left-0 h-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono-technical text-[10px] text-on-surface-variant whitespace-nowrap">
        {approved}/{total}
      </span>
    </div>
  );
}

export default async function Cases() {
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

  const cases = await prisma.governanceCase.findMany({
    where: { projectId: project.id },
    include: {
      governanceGates: {
        select: { id: true, status: true, name: true, order: true, skipped: true },
        orderBy: { order: "asc" },
      },
      riskScore: { select: { compositeScore: true, intensity: true, scoringConfidence: true } },
      adaptivePipeline: { select: { reducedFromBaseline: true } },
      _count: { select: { evidenceItems: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const totalCases = cases.length;
  const activeCases = cases.filter((c) => c.status === "active").length;
  const totalGates = cases.flatMap((c) => c.governanceGates).length;
  const approvedGates = cases
    .flatMap((c) => c.governanceGates)
    .filter((g) => g.status === GateStatus.APPROVED).length;

  return (
    <>
      <header className="h-16 px-xl flex items-center justify-between border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <div className="flex items-center gap-xl">
          <h1 className="font-headline-md text-headline-md text-on-surface">Governance Cases</h1>
          <span className="font-body-base text-body-base text-on-surface-variant">
            {activeCases} active · {totalCases} total
          </span>
        </div>
        <div className="flex items-center gap-lg">
          <div className="text-right">
            <p className="font-mono-technical text-[10px] text-on-surface-variant">GATES</p>
            <p className="font-body-bold text-body-bold text-primary">
              {approvedGates}/{totalGates} APPROVED
            </p>
          </div>
          <NewCaseButton />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-xl">
        <div className="max-w-[1200px] mx-auto space-y-lg">
          {cases.length === 0 ? (
            <p className="font-mono-technical text-[11px] text-on-surface-variant">
              No governance cases found.
            </p>
          ) : (
            cases.map((c) => {
              const gates = c.governanceGates;
              const approved = gates.filter((g) => g.status === GateStatus.APPROVED).length;
              const rejected = gates.filter((g) => g.status === GateStatus.REJECTED).length;
              const pending = gates.filter((g) => g.status === "PENDING" && !g.skipped).length;
              const skipped = gates.filter((g) => g.skipped).length;
              const totalActive = gates.filter((g) => !g.skipped).length;
              const phase = PHASE_META[c.phase] ?? {
                label: c.phase,
                cls: "text-on-surface-variant border-border-muted",
              };
              const statusCls = STATUS_CLS[c.status] ?? STATUS_CLS.active;
              const conf = computeDeliveryConfidence({
                approvedGates: approved,
                totalGates: totalActive,
                compositeRiskScore: c.riskScore?.compositeScore ?? 0,
                scoringConfidence: c.riskScore?.scoringConfidence ?? 0.5,
                reducedFromBaseline: c.adaptivePipeline?.reducedFromBaseline ?? 0,
                openCriticalRisks: rejected,
                waiverCount: 0,
              });

              return (
                <Link
                  key={c.id}
                  href={`/cases/${c.id}`}
                  className="block bg-surface border border-border-muted hover:border-primary transition-colors cursor-pointer"
                >
                  {/* Case header */}
                  <div className="p-xl border-b border-border-muted flex items-start justify-between gap-lg">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-md mb-sm">
                        <span
                          className={`px-2 py-0.5 font-mono-technical text-[10px] border ${phase.cls}`}
                        >
                          {phase.label}
                        </span>
                        <span
                          className={`px-2 py-0.5 font-mono-technical text-[10px] border ${statusCls}`}
                        >
                          {c.status.toUpperCase()}
                        </span>
                        {c.riskScore && (
                          <span
                            className={`px-2 py-0.5 font-mono-technical text-[10px] border ${
                              c.riskScore.intensity === "enhanced"
                                ? "text-critical border-critical bg-critical/10"
                                : c.riskScore.intensity === "regulated"
                                  ? "text-tertiary border-tertiary bg-tertiary/10"
                                  : "text-primary border-primary bg-primary/10"
                            }`}
                          >
                            {c.riskScore.intensity?.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <h3 className="font-body-bold text-body-bold text-on-surface mb-xs">
                        {c.title}
                      </h3>
                      {c.description && (
                        <p className="font-body-base text-body-base text-on-surface-variant text-[12px] line-clamp-1">
                          {c.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0 space-y-xs">
                      <p className="font-mono-technical text-[10px] text-on-surface-variant">
                        #{c.id.slice(-8).toUpperCase()}
                      </p>
                      <span className={`inline-block px-2 py-0.5 font-mono-technical text-[9px] border ${conf.cls}`}>
                        {conf.score}% {conf.label}
                      </span>
                      <p className="font-mono-technical text-[10px] text-on-surface-variant">
                        {c._count.evidenceItems} evidence item
                        {c._count.evidenceItems !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  {/* Gate pipeline */}
                  <div className="p-xl">
                    <div className="flex items-center justify-between mb-md">
                      <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">
                        GATE PIPELINE
                      </p>
                      <div className="flex gap-md font-mono-technical text-[10px]">
                        {approved > 0 && <span className="text-primary">{approved} APPROVED</span>}
                        {rejected > 0 && <span className="text-critical">{rejected} REJECTED</span>}
                        {pending > 0 && <span className="text-tertiary">{pending} PENDING</span>}
                        {skipped > 0 && (
                          <span className="text-on-surface-variant">{skipped} SKIPPED</span>
                        )}
                      </div>
                    </div>
                    <GateBar approved={approved} total={gates.filter((g) => !g.skipped).length} />
                    <div className="mt-lg flex flex-wrap gap-sm">
                      {gates.map((g) => (
                        <div
                          key={g.id}
                          title={g.name}
                          className={`px-2 py-0.5 font-mono-technical text-[10px] border truncate max-w-[160px] ${
                            g.skipped
                              ? "text-on-surface-variant border-border-muted opacity-50"
                              : g.status === GateStatus.APPROVED
                                ? "text-primary border-primary bg-primary/10"
                                : g.status === GateStatus.REJECTED
                                  ? "text-critical border-critical bg-critical/10"
                                  : g.status === "OPEN"
                                    ? "text-tertiary border-tertiary bg-tertiary/10"
                                    : "text-on-surface-variant border-border-muted"
                          }`}
                        >
                          {g.name}
                        </div>
                      ))}
                    </div>
                    {(c.sourceEpicKey || c.ownedBy) && (
                      <div className="mt-lg flex items-center gap-lg font-mono-technical text-[10px] text-on-surface-variant border-t border-border-muted pt-md">
                        {c.sourceEpicKey && <span>JIRA: {c.sourceEpicKey}</span>}
                        {c.ownedBy && <span>OWNER: {c.ownedBy}</span>}
                        <span>CREATED: {new Date(c.createdAt).toLocaleDateString("en-GB")}</span>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>

      <footer className="h-8 bg-surface-container-low border-t border-border-muted flex items-center justify-between px-xl font-mono-technical text-[10px] text-on-surface-variant shrink-0">
        <div className="flex items-center gap-xl">
          <div className="flex items-center gap-xs">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span>CASE_ENGINE: ACTIVE</span>
          </div>
          <span>
            TOTAL: {totalCases} CASES · {approvedGates}/{totalGates} GATES CLEARED
          </span>
        </div>
        <Link href="/timeline" className="text-primary hover:underline">
          VIEW FLIGHT RECORDER →
        </Link>
      </footer>
    </>
  );
}
