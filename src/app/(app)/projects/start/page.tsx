import prisma from "@/lib/db";
import Link from "next/link";
import StartWizard from "./StartWizard";

export const dynamic = "force-dynamic";

export default async function StartProjectPage() {
  const [connectors, programs] = await Promise.all([
    prisma.sourceConnector.findMany({
      where: { enabled: true },
      select: { id: true, type: true, name: true, baseUrl: true },
      orderBy: { type: "asc" },
    }),
    prisma.program.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <>
      <header className="h-16 px-xl flex items-center justify-between border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <div className="flex items-center gap-xl">
          <Link
            href="/projects"
            className="font-mono-technical text-[10px] text-on-surface-variant hover:text-primary transition-colors flex items-center gap-xs"
          >
            <span className="material-symbols-outlined select-none" style={{ fontSize: 14 }}>arrow_back</span>
            PROJECTS
          </Link>
          <span className="text-border-muted">·</span>
          <h1 className="font-headline-md text-headline-md text-on-surface">Start or Link Project</h1>
        </div>
        <p className="font-mono-technical text-[10px] text-on-surface-variant">
          {connectors.length} CONNECTOR{connectors.length !== 1 ? "S" : ""} AVAILABLE
        </p>
      </header>

      <StartWizard connectors={connectors} programs={programs} />
    </>
  );
}
