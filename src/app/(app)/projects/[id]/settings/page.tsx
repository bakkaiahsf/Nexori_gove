import { notFound } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db";
import ProjectSettingsClient from "./ProjectSettingsClient";

export const dynamic = "force-dynamic";

export default async function ProjectSettingsPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      program: { select: { id: true, name: true } },
      boards: {
        include: { connector: { select: { id: true, type: true, name: true, baseUrl: true } } },
        orderBy: { createdAt: "asc" },
      },
      ragSources: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!project) notFound();

  const [connectors, programs] = await Promise.all([
    prisma.sourceConnector.findMany({
      where: { enabled: true },
      select: { id: true, type: true, name: true, baseUrl: true },
      orderBy: { name: "asc" },
    }),
    prisma.program.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <header className="border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <div className="h-14 px-xl flex items-center justify-between">
          <div className="flex items-center gap-md">
            <Link href={`/projects/${project.id}`} className="text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
            </Link>
            <span className="text-border-muted">|</span>
            <div>
              <p className="font-mono-technical text-[10px] text-on-surface-variant">
                <Link href={`/projects/${project.id}`} className="hover:text-primary transition-colors">{project.name}</Link>
                {" "}→ Settings
              </p>
              <p className="font-mono-technical text-[11px] text-on-surface">{project.key} · {project.governanceProfile.toUpperCase().replace("_", " ")} profile</p>
            </div>
          </div>
          <div className="flex items-center gap-md">
            <Link
              href={`/admin/trigger-rules?project=${project.id}`}
              className="px-md py-xs border border-border-muted text-on-surface-variant font-mono-technical text-[10px] hover:border-primary hover:text-primary transition-colors"
            >
              MONITORING RULES →
            </Link>
            <Link
              href={`/projects/${project.id}`}
              className="px-md py-xs border border-primary text-primary font-mono-technical text-[10px] hover:bg-primary/10 transition-colors"
            >
              PROJECT HUB →
            </Link>
          </div>
        </div>
      </header>

      <ProjectSettingsClient
        project={{
          id: project.id,
          key: project.key,
          name: project.name,
          description: project.description ?? "",
          ownerEmail: project.ownerEmail,
          status: project.status,
          governanceProfile: project.governanceProfile,
          programId: project.programId ?? null,
          programName: project.program?.name ?? null,
        }}
        boards={project.boards.map((b) => ({
          id: b.id,
          boardId: b.boardId,
          boardName: b.boardName,
          boardType: b.boardType,
          enabled: b.enabled,
          labelTag: b.labelTag ?? "",
          riskOverride: b.riskOverride ?? "",
          connector: { id: b.connector.id, type: b.connector.type, name: b.connector.name, baseUrl: b.connector.baseUrl },
        }))}
        ragSources={project.ragSources.map((s) => ({
          id: s.id,
          type: s.type,
          name: s.name,
          config: s.config as Record<string, string>,
          enabled: s.enabled,
          lastIndexedAt: s.lastIndexedAt?.toISOString() ?? null,
        }))}
        connectors={connectors}
        programs={programs}
      />

      <footer className="h-8 bg-surface-container-low border-t border-border-muted flex items-center justify-between px-xl font-mono-technical text-[10px] text-on-surface-variant shrink-0">
        <span>PROJECT: {project.key} · SETTINGS</span>
        <span>NEXORI GOVERNANCE PLATFORM</span>
      </footer>
    </>
  );
}
