import prisma from "@/lib/db";
import Link from "next/link";
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
      <header className="border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <div className="h-14 px-xl flex items-center justify-between">
          <div className="flex items-center gap-md">
            <Link href={`/projects/${activeProject.id}`} className="text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
            </Link>
            <span className="text-border-muted">|</span>
            <div>
              <p className="font-mono-technical text-[10px] text-on-surface-variant">
                <Link href={`/projects/${activeProject.id}`} className="hover:text-primary transition-colors">{activeProject.name}</Link>
                {" "}→ Monitoring Rules
              </p>
              <p className="font-mono-technical text-[11px] text-on-surface">
                {rules.filter((r) => r.enabled).length} active · {matchedCount} matched · {skippedCount} skipped
              </p>
            </div>
          </div>
          <div className="flex items-center gap-md font-mono-technical text-[10px]">
            <Link
              href={`/projects/${activeProject.id}`}
              className="px-md py-xs border border-border-muted text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
            >
              PROJECT HUB →
            </Link>
          </div>
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
