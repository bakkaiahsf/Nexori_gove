import { notFound } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db";
import ProjectHubClient from "./ProjectHubClient";

export const dynamic = "force-dynamic";

export default async function ProjectHubPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      program: { select: { id: true, name: true } },
      regulatoryMappings: { select: { framework: true }, distinct: ["framework"] },
    },
  });
  if (!project) notFound();

  const [boards, activeCases, allCases, aiSetting, triggerRules, recentEvents, guardrailPushes] =
    await Promise.all([
      prisma.projectBoard.findMany({
        where: { projectId: params.id },
        include: { connector: { select: { id: true, type: true, name: true, baseUrl: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.governanceCase.findMany({
        where: { projectId: params.id, status: "active" },
        include: {
          governanceGates: { select: { status: true, skipped: true } },
          riskScore: { select: { compositeScore: true, intensity: true } },
          adaptivePipeline: { select: { totalGateCount: true, reducedFromBaseline: true } },
          _count: { select: { comments: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.governanceCase.count({ where: { projectId: params.id } }),
      prisma.aIControlSetting.findUnique({ where: { projectId: params.id } }).catch(() => null),
      prisma.governanceTriggerRule.findMany({
        where: { projectId: params.id },
        orderBy: { priority: "desc" },
      }),
      prisma.governanceEvent.findMany({
        where: { projectId: params.id },
        orderBy: { timestamp: "desc" },
        take: 10,
        select: { id: true, type: true, actorEmail: true, timestamp: true, resourceType: true },
      }),
      prisma.guardrailPush
        .findMany({
          where: { projectId: params.id },
          orderBy: { generatedAt: "desc" },
          take: 5,
          select: { id: true, framework: true, status: true, prUrl: true, generatedAt: true },
        })
        .catch(() => []),
    ]);

  const frameworks = [...new Set(project.regulatoryMappings.map((m) => String(m.framework)))];

  const pendingChecks = activeCases.reduce(
    (acc, c) =>
      acc + c.governanceGates.filter((g) => !g.skipped && g.status === "PENDING").length,
    0
  );

  return (
    <>
      <header className="border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        {/* Top row */}
        <div className="h-14 px-xl flex items-center justify-between">
          <div className="flex items-center gap-md">
            <Link href="/projects" className="text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
            </Link>
            <span className="text-border-muted">|</span>
            <div>
              <div className="flex items-center gap-md">
                <span className="font-mono-technical text-[10px] text-primary">{project.key}</span>
                {project.program && (
                  <Link
                    href={`/admin/programs`}
                    className="font-mono-technical text-[10px] text-on-surface-variant hover:text-primary transition-colors"
                  >
                    {project.program.name}
                  </Link>
                )}
                {aiSetting && (
                  <span className={`font-mono-technical text-[9px] border px-1.5 py-0.5 ${
                    aiSetting.mode === "EMERGENCY_LOCK" ? "text-critical border-critical" :
                    aiSetting.mode === "AI_REVIEW" ? "text-primary border-primary" :
                    aiSetting.mode === "HUMAN_ONLY" ? "text-on-surface-variant border-border-muted" :
                    "text-primary border-primary/40"
                  }`}>
                    {aiSetting.mode === "AI_REVIEW" ? "REGULATED" :
                     aiSetting.mode === "AI_ASSIST" ? "AGILE" :
                     aiSetting.mode === "HUMAN_ONLY" ? "MANUAL" :
                     aiSetting.mode === "EMERGENCY_LOCK" ? "LOCKED" :
                     aiSetting.mode.replace(/_/g, " ")}
                  </span>
                )}
                {pendingChecks > 0 && (
                  <span className="font-mono-technical text-[9px] border border-tertiary text-tertiary px-1.5 py-0.5">
                    {pendingChecks} PENDING
                  </span>
                )}
              </div>
              <h1 className="font-body-bold text-body-bold text-on-surface text-[14px] leading-tight">{project.name}</h1>
            </div>
          </div>
          {/* Primary actions */}
          <div className="flex items-center gap-sm">
            <Link
              href={`/release-readiness?projectId=${project.id}`}
              className="px-md py-xs border border-border-muted text-on-surface-variant font-mono-technical text-[10px] hover:border-primary hover:text-primary transition-colors"
            >
              READINESS →
            </Link>
            <Link
              href={`/cases?projectId=${project.id}`}
              className="px-md py-xs border border-border-muted text-on-surface-variant font-mono-technical text-[10px] hover:border-primary hover:text-primary transition-colors"
            >
              ASSURANCE ITEMS →
            </Link>
            <Link
              href={`/admin/trigger-rules?project=${project.id}`}
              className="px-md py-xs border border-border-muted text-on-surface-variant font-mono-technical text-[10px] hover:border-primary hover:text-primary transition-colors"
            >
              CONFIGURE →
            </Link>
          </div>
        </div>
      </header>

      <ProjectHubClient
        projectId={project.id}
        projectKey={project.key}
        projectName={project.name}
        programName={project.program?.name ?? null}
        frameworks={frameworks}
        boards={boards.map((b) => ({
          id: b.id,
          boardId: b.boardId,
          boardName: b.boardName,
          boardType: b.boardType,
          enabled: b.enabled,
          connector: {
            id: b.connector.id,
            type: b.connector.type,
            name: b.connector.name,
            baseUrl: b.connector.baseUrl,
          },
        }))}
        activeCases={activeCases.map((c) => ({
          id: c.id,
          title: c.title,
          phase: c.phase,
          status: c.status,
          ownedBy: c.ownedBy,
          sourceEpicKey: c.sourceEpicKey,
          createdAt: c.createdAt.toISOString(),
          approvedGates: c.governanceGates.filter((g) => !g.skipped && g.status === "APPROVED").length,
          totalGates: c.governanceGates.filter((g) => !g.skipped).length,
          commentCount: c._count.comments,
          riskScore: c.riskScore
            ? { compositeScore: c.riskScore.compositeScore, intensity: c.riskScore.intensity }
            : null,
          reducedFromBaseline: c.adaptivePipeline?.reducedFromBaseline ?? 0,
        }))}
        totalCases={allCases}
        aiSetting={
          aiSetting
            ? {
                mode: aiSetting.mode,
                setBy: aiSetting.setBy,
                setAt: aiSetting.setAt.toISOString(),
                reason: aiSetting.reason,
              }
            : null
        }
        triggerRules={triggerRules.map((r) => ({
          id: r.id,
          name: r.name,
          source: r.source,
          eventType: r.eventType,
          action: r.action,
          enabled: r.enabled,
          sourceProjectRef: r.sourceProjectRef,
          lastRunAt: r.lastRunAt?.toISOString() ?? null,
          lastRunResult: r.lastRunResult,
        }))}
        recentEvents={recentEvents.map((e) => ({
          id: e.id,
          type: e.type,
          actorEmail: e.actorEmail,
          timestamp: e.timestamp.toISOString(),
          resourceType: e.resourceType,
        }))}
        guardrailPushes={guardrailPushes.map((g) => ({
          id: g.id,
          framework: g.framework,
          status: g.status,
          prUrl: g.prUrl,
          generatedAt: g.generatedAt.toISOString(),
        }))}
      />

      <footer className="h-8 bg-surface-container-low border-t border-border-muted flex items-center justify-between px-xl font-mono-technical text-[10px] text-on-surface-variant shrink-0">
        <span>
          PROJECT: {project.key} · {activeCases.length} ACTIVE ITEMS · {boards.length} SOURCES
        </span>
        <span>DELIVERY CONFIDENCE OPERATING PLATFORM</span>
      </footer>
    </>
  );
}
