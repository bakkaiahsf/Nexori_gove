import prisma from "@/lib/db";
import { DEMO_PROJECT_KEY } from "@/lib/governance";
import Link from "next/link";

export const dynamic = "force-dynamic";

function Icon({
  name,
  size = 16,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`material-symbols-outlined select-none leading-none ${className}`}
      style={{ fontSize: size }}
    >
      {name}
    </span>
  );
}

type ReadinessStatus = "GO" | "NO_GO" | "CONDITIONAL";

function computeReadiness(
  gates: Array<{ status: string; skipped: boolean; required: boolean }>
): ReadinessStatus {
  const active = gates.filter((g) => !g.skipped);
  const blocked = active.some((g) => g.status === "REJECTED");
  const pendingRequired = active.some(
    (g) => g.required && (g.status === "PENDING" || g.status === "OPEN")
  );
  const pendingOptional = active.some(
    (g) => !g.required && (g.status === "PENDING" || g.status === "OPEN")
  );

  if (blocked) return "NO_GO";
  if (pendingRequired) return "NO_GO";
  if (pendingOptional) return "CONDITIONAL";
  return "GO";
}

const STATUS_CONFIG: Record<
  ReadinessStatus,
  { label: string; icon: string; cls: string; bg: string }
> = {
  GO: {
    label: "GO",
    icon: "check_circle",
    cls: "text-primary border-primary",
    bg: "bg-primary/10",
  },
  NO_GO: {
    label: "NO GO",
    icon: "cancel",
    cls: "text-critical border-critical",
    bg: "bg-critical/10",
  },
  CONDITIONAL: {
    label: "CONDITIONAL",
    icon: "warning",
    cls: "text-tertiary border-tertiary",
    bg: "bg-tertiary/10",
  },
};

export default async function ReleaseReadinessPage() {
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
    where: { projectId: project.id, status: "active" },
    include: {
      governanceGates: {
        select: {
          id: true,
          name: true,
          status: true,
          skipped: true,
          required: true,
          approvedBy: true,
          rejectedBy: true,
        },
        orderBy: { order: "asc" },
      },
      riskScore: { select: { compositeScore: true, intensity: true } },
      context: { select: { environment: true, aiSystemInvolved: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const enriched = cases.map((c) => ({
    ...c,
    readiness: computeReadiness(c.governanceGates),
    approvedGates: c.governanceGates.filter((g) => g.status === "APPROVED" && !g.skipped).length,
    totalActive: c.governanceGates.filter((g) => !g.skipped).length,
    blockedGates: c.governanceGates.filter((g) => g.status === "REJECTED" && !g.skipped),
    pendingGates: c.governanceGates.filter(
      (g) => (g.status === "PENDING" || g.status === "OPEN") && !g.skipped
    ),
  }));

  const goCases = enriched.filter((c) => c.readiness === "GO").length;
  const noGoCases = enriched.filter((c) => c.readiness === "NO_GO").length;
  const conditionalCases = enriched.filter((c) => c.readiness === "CONDITIONAL").length;

  const overallReadiness: ReadinessStatus =
    noGoCases > 0 ? "NO_GO" : conditionalCases > 0 ? "CONDITIONAL" : "GO";

  const overall = STATUS_CONFIG[overallReadiness];

  return (
    <>
      <header className="h-16 px-xl flex items-center justify-between border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <div className="flex items-center gap-xl">
          <h1 className="font-headline-md text-headline-md text-on-surface">Release Readiness</h1>
          <span className="font-body-base text-body-base text-on-surface-variant">
            {project.name}
          </span>
        </div>
        <Link
          href="/orchestration"
          className="flex items-center gap-sm font-mono-technical text-[10px] text-primary hover:underline"
        >
          <Icon name="account_tree" size={14} className="text-primary" />
          ORCHESTRATION VIEW →
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-xl">
        <div className="max-w-[1000px] mx-auto space-y-xl">
          {/* Overall verdict */}
          <div className={`border-2 p-xl flex items-center gap-xl ${overall.cls} ${overall.bg}`}>
            <div
              className={`w-16 h-16 border-2 flex items-center justify-center shrink-0 ${overall.cls}`}
            >
              <Icon name={overall.icon} size={32} className={overall.cls.split(" ")[0]} />
            </div>
            <div>
              <p
                className={`font-mono-technical text-[32px] font-bold leading-none ${overall.cls.split(" ")[0]}`}
              >
                {overall.label}
              </p>
              <p className="font-mono-technical text-[12px] text-on-surface-variant mt-xs">
                {overallReadiness === "GO" &&
                  "All active governance gates cleared. Programme may proceed to production."}
                {overallReadiness === "NO_GO" &&
                  `${noGoCases} case${noGoCases !== 1 ? "s" : ""} with blocked or unresolved required gates. Production release is not authorised.`}
                {overallReadiness === "CONDITIONAL" &&
                  `${conditionalCases} case${conditionalCases !== 1 ? "s" : ""} with optional gates pending. Proceed with documented risk acceptance.`}
              </p>
            </div>
            <div className="ml-auto text-right space-y-xs shrink-0">
              <p className="font-mono-technical text-[11px] text-primary">{goCases} CLEARED</p>
              {conditionalCases > 0 && (
                <p className="font-mono-technical text-[11px] text-tertiary">
                  {conditionalCases} CONDITIONAL
                </p>
              )}
              {noGoCases > 0 && (
                <p className="font-mono-technical text-[11px] text-critical">{noGoCases} BLOCKED</p>
              )}
            </div>
          </div>

          {/* Case-by-case readiness */}
          <div className="space-y-md">
            {enriched.length === 0 ? (
              <div className="bg-surface border border-border-muted p-xl text-center">
                <p className="font-mono-technical text-[11px] text-on-surface-variant">
                  No active governance cases found.
                </p>
              </div>
            ) : (
              enriched.map((c) => {
                const cfg = STATUS_CONFIG[c.readiness];
                return (
                  <div key={c.id} className="bg-surface border border-border-muted">
                    {/* Case header */}
                    <div
                      className={`px-xl py-lg border-b border-border-muted flex items-center gap-lg ${cfg.bg}`}
                    >
                      <Icon name={cfg.icon} size={20} className={cfg.cls.split(" ")[0]} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-sm flex-wrap mb-xs">
                          <span
                            className={`px-2 py-0.5 font-mono-technical text-[9px] border font-bold ${cfg.cls}`}
                          >
                            {cfg.label}
                          </span>
                          {c.riskScore && (
                            <span
                              className={`px-2 py-0.5 font-mono-technical text-[9px] border ${
                                c.riskScore.intensity === "enhanced"
                                  ? "text-critical border-critical bg-critical/10"
                                  : c.riskScore.intensity === "regulated"
                                    ? "text-tertiary border-tertiary bg-tertiary/10"
                                    : "text-on-surface-variant border-border-muted"
                              }`}
                            >
                              {c.riskScore.intensity?.toUpperCase()} ·{" "}
                              {Math.round(c.riskScore.compositeScore)}
                            </span>
                          )}
                          {c.context?.aiSystemInvolved && (
                            <span className="px-2 py-0.5 font-mono-technical text-[9px] border border-primary text-primary bg-primary/5">
                              AI SYSTEM
                            </span>
                          )}
                        </div>
                        <Link
                          href={`/cases/${c.id}`}
                          className="font-body-bold text-body-bold text-on-surface text-[14px] hover:text-primary transition-colors"
                        >
                          {c.title}
                        </Link>
                        <p className="font-mono-technical text-[10px] text-on-surface-variant mt-xs">
                          {c.phase.replace(/-/g, " ").toUpperCase()} · ENV:{" "}
                          {c.context?.environment?.toUpperCase() ?? "—"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono-technical text-[20px] font-bold text-on-surface leading-none">
                          {c.approvedGates}/{c.totalActive}
                        </p>
                        <p className="font-mono-technical text-[9px] text-on-surface-variant">
                          GATES
                        </p>
                      </div>
                    </div>

                    {/* Gate details */}
                    <div className="px-xl py-lg">
                      {/* Gate progress bar */}
                      <div className="flex items-center gap-md mb-lg">
                        <div className="flex-1 h-1.5 bg-surface-container-highest relative">
                          <div
                            className={`absolute top-0 left-0 h-full transition-all ${
                              c.readiness === "GO"
                                ? "bg-primary"
                                : c.readiness === "NO_GO"
                                  ? "bg-critical"
                                  : "bg-tertiary"
                            }`}
                            style={{
                              width:
                                c.totalActive > 0
                                  ? `${(c.approvedGates / c.totalActive) * 100}%`
                                  : "0%",
                            }}
                          />
                        </div>
                        <span className="font-mono-technical text-[10px] text-on-surface-variant whitespace-nowrap">
                          {c.totalActive > 0
                            ? Math.round((c.approvedGates / c.totalActive) * 100)
                            : 0}
                          % CLEARED
                        </span>
                      </div>

                      {/* Blocked gates */}
                      {c.blockedGates.length > 0 && (
                        <div className="space-y-xs mb-md">
                          <p className="font-mono-technical text-[9px] text-critical tracking-widest">
                            BLOCKED GATES
                          </p>
                          {c.blockedGates.map((g) => (
                            <div
                              key={g.id}
                              className="flex items-center gap-sm bg-critical/5 border border-critical/20 px-md py-xs"
                            >
                              <Icon name="cancel" size={12} className="text-critical shrink-0" />
                              <span className="font-mono-technical text-[10px] text-on-surface flex-1">
                                {g.name}
                              </span>
                              {g.rejectedBy && (
                                <span className="font-mono-technical text-[9px] text-critical">
                                  Rejected by {g.rejectedBy}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Pending gates */}
                      {c.pendingGates.length > 0 && (
                        <div className="space-y-xs mb-md">
                          <p className="font-mono-technical text-[9px] text-tertiary tracking-widest">
                            PENDING GATES
                          </p>
                          {c.pendingGates.map((g) => (
                            <div
                              key={g.id}
                              className="flex items-center gap-sm bg-tertiary/5 border border-tertiary/20 px-md py-xs"
                            >
                              <Icon name="pending" size={12} className="text-tertiary shrink-0" />
                              <span className="font-mono-technical text-[10px] text-on-surface flex-1">
                                {g.name}
                              </span>
                              <span className="font-mono-technical text-[9px] text-on-surface-variant">
                                {g.required ? "REQUIRED" : "OPTIONAL"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <Link
                        href={`/cases/${c.id}`}
                        className="font-mono-technical text-[10px] text-primary hover:underline flex items-center gap-xs"
                      >
                        <Icon name="open_in_new" size={11} className="text-primary" />
                        MANAGE GATES →
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <footer className="h-8 bg-surface-container-low border-t border-border-muted flex items-center px-xl font-mono-technical text-[10px] text-on-surface-variant shrink-0">
        <span>
          RELEASE READINESS: {overallReadiness.replace("_", " ")} · {goCases} GO · {noGoCases} NO GO
          · {conditionalCases} CONDITIONAL
        </span>
      </footer>
    </>
  );
}
