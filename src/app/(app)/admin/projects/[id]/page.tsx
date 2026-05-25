import { notFound } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db";
import SyncClient from "./SyncClient";

export const dynamic = "force-dynamic";

export default async function ProjectSyncPage({ params }: { params: { id: string } }) {
  const [project, connectors, boards] = await Promise.all([
    prisma.project.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        key: true,
        name: true,
        status: true,
        regulatoryMappings: { select: { framework: true }, distinct: ["framework"] },
      },
    }),
    prisma.sourceConnector.findMany({
      where: { enabled: true },
      select: { id: true, type: true, name: true, baseUrl: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.projectBoard.findMany({
      where: { projectId: params.id, enabled: true },
      include: { connector: { select: { id: true, type: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!project) notFound();

  const recentSyncs = await prisma.triggerEvaluation
    .findMany({
      where: { caseId: { not: null } },
      orderBy: { evaluatedAt: "desc" },
      take: 5,
      select: { evaluatedAt: true, matched: true, caseId: true, connectorId: true },
    })
    .catch(() => []);

  return (
    <>
      <header className="h-14 px-xl flex items-center justify-between border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <div className="flex items-center gap-md">
          <Link href="/admin/projects" className="text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
          </Link>
          <span className="text-border-muted">|</span>
          <span className="font-mono-technical text-[11px] text-primary">{project.key}</span>
          <span className="text-border-muted">·</span>
          <span className="font-mono-technical text-[11px] text-on-surface-variant">SYNC CONFIGURATION</span>
        </div>
        <span className={`px-2 py-0.5 font-mono-technical text-[10px] border ${project.status === "active" ? "border-primary text-primary" : "border-border-muted text-on-surface-variant"}`}>
          {project.status.toUpperCase()}
        </span>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-xl">
        <div className="max-w-[900px] mx-auto space-y-lg">
          {/* Project info */}
          <div className="bg-surface border border-border-muted p-xl">
            <h1 className="font-headline-md text-headline-md text-on-surface mb-sm">{project.name}</h1>
            <div className="flex flex-wrap gap-md mt-sm">
              {project.regulatoryMappings.map((m) => (
                <span key={String(m.framework)} className="px-2 py-0.5 font-mono-technical text-[10px] border border-primary/40 text-primary">
                  {String(m.framework).replace(/_/g, " ")}
                </span>
              ))}
              {project.regulatoryMappings.length === 0 && (
                <span className="font-mono-technical text-[10px] text-on-surface-variant">No regulatory frameworks configured</span>
              )}
            </div>
          </div>

          <SyncClient
            projectId={project.id}
            projectKey={project.key}
            frameworks={[...new Set(project.regulatoryMappings.map((m) => String(m.framework)))]}
            connectors={connectors}
            linkedBoards={boards.map((b) => ({
              id: b.id,
              boardId: b.boardId,
              boardName: b.boardName,
              boardType: b.boardType,
              connector: b.connector,
            }))}
            recentSyncs={recentSyncs.map((s) => ({
              evaluatedAt: s.evaluatedAt.toISOString(),
              matched: s.matched,
              caseId: s.caseId,
              connectorId: s.connectorId,
            }))}
          />
        </div>
      </div>

      <footer className="h-8 bg-surface-container-low border-t border-border-muted flex items-center px-xl font-mono-technical text-[10px] text-on-surface-variant shrink-0">
        <span>PROJECT: {project.key} · BOARDS: {boards.length} LINKED · SYNC ENGINE: READY</span>
      </footer>
    </>
  );
}
