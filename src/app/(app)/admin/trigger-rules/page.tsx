import prisma from "@/lib/db";
import { TriggerAction } from "@prisma/client";
import TriggerRulesClient from "./TriggerRulesClient";

export const dynamic = "force-dynamic";

export default async function TriggerRulesPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const sp = await searchParams;

  // Load all projects so the client can switch between them
  const projects = await prisma.project.findMany({
    select: { id: true, key: true, name: true },
    orderBy: { name: "asc" },
  });

  if (projects.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="font-mono-technical text-on-surface-variant text-[12px]">
          No projects found. Onboard a project first.
        </p>
      </div>
    );
  }

  // Active project: from query param, or first project
  const activeProject =
    projects.find((p) => p.id === sp.project || p.key === sp.project) ?? projects[0];

  const [rules, evaluations, connectors] = await Promise.all([
    prisma.governanceTriggerRule.findMany({
      where: { projectId: activeProject.id },
      orderBy: [{ enabled: "desc" }, { priority: "desc" }],
    }),
    prisma.triggerEvaluation.findMany({
      where: { projectId: activeProject.id },
      orderBy: { evaluatedAt: "desc" },
      take: 30,
      select: {
        id: true,
        sourceType: true,
        eventType: true,
        eventKey: true,
        matched: true,
        action: true,
        caseId: true,
        evaluatedAt: true,
        ruleId: true,
      },
    }),
    prisma.sourceConnector.findMany({
      select: { id: true, type: true, name: true, enabled: true },
    }),
  ]);

  const matchedCount = evaluations.filter((e) => e.matched).length;
  const skippedCount = evaluations.filter((e) => !e.matched).length;

  return (
    <>
      <header className="h-16 px-xl flex items-center justify-between border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <div className="flex items-center gap-xl">
          <h1 className="font-headline-md text-headline-md text-on-surface">
            Governance Trigger Rules
          </h1>
          <span className="font-body-base text-body-base text-on-surface-variant text-[12px]">
            Configure which tool events activate governance — per project
          </span>
        </div>
        <div className="flex items-center gap-md font-mono-technical text-[10px]">
          <span className="text-primary">{rules.filter((r) => r.enabled).length} ACTIVE</span>
          <span className="text-on-surface-variant">·</span>
          <span className="text-tertiary">{matchedCount} MATCHED</span>
          <span className="text-on-surface-variant">·</span>
          <span className="text-on-surface-variant">{skippedCount} SKIPPED</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <TriggerRulesClient
          activeProjectId={activeProject.id}
          activeProjectName={activeProject.name}
          projects={projects}
          rules={rules.map((r) => ({
            ...r,
            conditions: r.conditions as Array<{ field: string; op: string; value: string }>,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
            lastRunAt: r.lastRunAt?.toISOString() ?? null,
          }))}
          evaluations={evaluations.map((e) => ({
            ...e,
            action: e.action as TriggerAction | null,
            evaluatedAt: e.evaluatedAt.toISOString(),
          }))}
          connectors={connectors}
        />
      </div>
    </>
  );
}
