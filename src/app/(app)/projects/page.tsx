import prisma from "@/lib/db";
import Link from "next/link";
import ProjectsGridClient from "./ProjectsGridClient";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const rawProjects = await prisma.project.findMany({
    where: { status: { not: "archived" } },
    include: {
      program: { select: { name: true } },
      boards: {
        include: { connector: { select: { type: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { governanceCases: { where: { status: "active" } } } },
    },
    orderBy: { name: "asc" },
  });

  const projects = rawProjects.map((p) => ({
    id: p.id,
    key: p.key,
    name: p.name,
    status: p.status,
    ownerEmail: p.ownerEmail,
    governanceProfile: p.governanceProfile,
    program: p.program,
    boards: p.boards.map((b) => ({
      id: b.id,
      boardId: b.boardId,
      boardName: b.boardName,
      connector: { type: b.connector.type, name: b.connector.name },
    })),
    activeCases: p._count.governanceCases,
  }));

  return (
    <>
      <header className="h-14 px-xl flex items-center justify-between border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <div className="flex items-center gap-md">
          <h1 className="font-headline-md text-headline-md text-on-surface">Projects</h1>
          <span className="text-border-muted">·</span>
          <span className="font-mono-technical text-[11px] text-on-surface-variant">
            {projects.length} project{projects.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-sm">
          <Link
            href="/projects/start"
            className="px-lg py-xs bg-primary text-on-primary font-mono-technical text-[10px] hover:brightness-110 transition-all tracking-widest"
          >
            + START OR LINK PROJECT
          </Link>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-xl">
        <div className="max-w-[1400px] mx-auto">
          <ProjectsGridClient projects={projects} />
        </div>
      </div>

      <footer className="h-8 bg-surface-container-low border-t border-border-muted flex items-center px-xl font-mono-technical text-[10px] text-on-surface-variant shrink-0">
        <span>PROJECT HUB · {projects.length} PROJECTS · ENTERPRISE DELIVERY CONFIDENCE</span>
      </footer>
    </>
  );
}
