import prisma from "@/lib/db";
import Link from "next/link";
import ProjectsClient from "./ProjectsClient";
import { AIControlMode, RegulatoryFramework } from "@prisma/client";
import type { ProjectSummary } from "./constants";
export type { ProjectSummary } from "./constants";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const [projects, connectors, totalCases, totalGates] = await Promise.all([
    prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        domain: true,
        classification: true,
        ownerEmail: true,
        status: true,
        createdAt: true,
        aiControlSetting: { select: { mode: true } },
        governanceCases: {
          select: {
            id: true,
            status: true,
            governanceGates: { select: { status: true } },
          },
        },
        triggerRules: {
          select: { id: true, source: true, enabled: true },
          where: { enabled: true },
        },
        regulatoryMappings: { select: { framework: true } },
        _count: { select: { governanceCases: true } },
      },
    }),
    prisma.sourceConnector.findMany({
      select: { id: true, type: true, name: true },
    }),
    prisma.governanceCase.count(),
    prisma.governanceGate.count(),
  ]);

  const summaries: ProjectSummary[] = projects.map((p) => {
    const allGates = p.governanceCases.flatMap((c) => c.governanceGates);
    const blocked = allGates.filter((g) => g.status === "REJECTED").length;
    const pending = allGates.filter((g) => g.status === "PENDING" || g.status === "OPEN").length;
    const readiness: ProjectSummary["readiness"] =
      blocked > 0 ? "NO_GO" : pending > 0 ? "CONDITIONAL" : allGates.length > 0 ? "GO" : "SETUP";

    const projectConnectors = connectors
      .filter((c) => p.triggerRules.some((r) => r.source === c.type))
      .map((c) => c.type);

    const frameworks = [
      ...new Set(p.regulatoryMappings.map((r) => r.framework)),
    ] as RegulatoryFramework[];

    return {
      id: p.id,
      key: p.key,
      name: p.name,
      description: p.description,
      domain: p.domain,
      classification: p.classification,
      ownerEmail: p.ownerEmail,
      status: p.status,
      createdAt: p.createdAt,
      aiMode: p.aiControlSetting?.mode ?? AIControlMode.AI_ASSIST,
      activeCases: p._count.governanceCases,
      triggerRules: p.triggerRules.filter((r) => r.enabled).length,
      blockedGates: blocked,
      pendingGates: pending,
      readiness,
      connectors: [...new Set(projectConnectors)],
      frameworks,
    };
  });

  const stats = {
    total: projects.length,
    active: projects.filter((p) => p.status === "active").length,
    totalCases,
    totalGates,
  };

  return (
    <>
      <header className="h-16 px-xl flex items-center justify-between border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <div className="flex items-center gap-lg">
          <Link
            href="/admin"
            className="text-on-surface-variant hover:text-on-surface font-mono-technical text-[11px]"
          >
            ← ADMIN
          </Link>
          <h1 className="font-headline-md text-headline-md text-on-surface">
            Project &amp; Program Registry
          </h1>
        </div>
        <div className="flex items-center gap-md font-mono-technical text-[10px]">
          <span className="px-2 py-1 bg-primary/10 border border-primary text-primary">
            {stats.active} ACTIVE
          </span>
          <span className="px-2 py-1 border border-border-muted text-on-surface-variant">
            {stats.totalCases} CASES
          </span>
          <span className="px-2 py-1 border border-border-muted text-on-surface-variant">
            {stats.totalGates} GATES
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-xl">
        <div className="max-w-[1400px] mx-auto space-y-xl">
          <ProjectsClient projects={summaries} />
        </div>
      </div>
    </>
  );
}
