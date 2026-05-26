import prisma from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

const TYPE_ICON: Record<string, string> = { github: "GH", gitlab: "GL", jira: "JI" };

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    include: {
      program: { select: { name: true } },
      boards: { include: { connector: { select: { type: true, name: true } } } },
      _count: { select: { governanceCases: { where: { status: "active" } } } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <header className="h-16 px-xl flex items-center justify-between border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <div className="flex items-center gap-md">
          <h1 className="font-headline-md text-headline-md text-on-surface">Projects</h1>
          <span className="text-border-muted">·</span>
          <span className="font-mono-technical text-[11px] text-on-surface-variant">{projects.length} active</span>
        </div>
        <div className="flex items-center gap-sm">
          <Link
            href="/admin/projects"
            className="px-md py-xs border border-border-muted text-on-surface-variant font-mono-technical text-[10px] hover:border-primary hover:text-primary transition-colors"
          >
            MANAGE →
          </Link>
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
          {projects.length === 0 ? (
            <div className="border border-border-muted p-2xl text-center space-y-lg max-w-[520px] mx-auto mt-2xl">
              <div className="w-16 h-16 bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 32, fontVariationSettings: "'FILL' 1" }}>folder_special</span>
              </div>
              <div>
                <p className="font-body-bold text-body-bold text-on-surface text-[15px] mb-sm">No projects yet</p>
                <p className="font-mono-technical text-[11px] text-on-surface-variant">
                  Connect your first project in one guided flow. NexoriOS monitors delivery, highlights risk, and creates required actions automatically.
                </p>
              </div>
              <Link
                href="/projects/start"
                className="inline-block px-xl py-md bg-primary text-on-primary font-mono-technical text-[11px] hover:brightness-110 transition-all tracking-widest"
              >
                START OR LINK PROJECT →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-lg">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="block border border-border-muted bg-surface hover:border-primary/60 transition-colors p-lg group"
                >
                  <div className="flex items-start justify-between mb-md">
                    <div className="min-w-0">
                      <p className="font-mono-technical text-[10px] text-primary">{p.key}</p>
                      <p className="font-body-bold text-body-bold text-on-surface mt-xs truncate">{p.name}</p>
                      {p.program && (
                        <p className="font-mono-technical text-[9px] text-on-surface-variant mt-xs">
                          {p.program.name}
                        </p>
                      )}
                    </div>
                    <span
                      className={`px-2 py-0.5 font-mono-technical text-[9px] border shrink-0 ${
                        p.status === "active"
                          ? "border-primary text-primary"
                          : "border-border-muted text-on-surface-variant"
                      }`}
                    >
                      {p.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-md pt-md border-t border-border-muted">
                    <div className="flex items-center gap-sm">
                      <span className="font-mono-technical text-[10px] text-primary font-bold">
                        {p._count.governanceCases}
                      </span>
                      <span className="font-mono-technical text-[9px] text-on-surface-variant">
                        ACTIVE ITEMS
                      </span>
                    </div>
                    <div className="flex gap-xs">
                      {p.boards.slice(0, 4).map((b) => (
                        <span
                          key={b.id}
                          className="font-mono-technical text-[9px] border border-border-muted px-1.5 py-0.5 text-on-surface-variant group-hover:border-primary/40 transition-colors"
                          title={`${b.connector.name} — ${b.boardId}`}
                        >
                          {TYPE_ICON[b.connector.type] ?? b.connector.type.slice(0, 2).toUpperCase()}
                        </span>
                      ))}
                      {p.boards.length === 0 && (
                        <span className="font-mono-technical text-[9px] text-on-surface-variant">
                          NO SOURCES
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-sm">
                    <span className="font-mono-technical text-[9px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      OPEN PROJECT HUB →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <footer className="h-8 bg-surface-container-low border-t border-border-muted flex items-center px-xl font-mono-technical text-[10px] text-on-surface-variant shrink-0">
        <span>PROJECT HUB · {projects.length} PROJECTS · ENTERPRISE DELIVERY CONFIDENCE</span>
      </footer>
    </>
  );
}
