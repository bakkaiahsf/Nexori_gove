import prisma from "@/lib/db";
import ProgramsClient from "./ProgramsClient";

export const dynamic = "force-dynamic";

export default async function ProgramsPage() {
  try {
    const [programs, allProjects] = await Promise.all([
      prisma.program.findMany({
        orderBy: { name: "asc" },
        include: {
          projects: {
            select: { id: true, key: true, name: true, status: true, domain: true },
          },
        },
      }),
      prisma.project.findMany({
        select: { id: true, key: true, name: true, programId: true, status: true },
        orderBy: { name: "asc" },
      }),
    ]);
    return <ProgramsClient programs={programs} allProjects={allProjects} />;
  } catch {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="font-mono-technical text-[11px] text-on-surface-variant">
          PROGRAMS_UNAVAILABLE — Database connectivity issue. Check /api/health.
        </p>
      </div>
    );
  }
}
