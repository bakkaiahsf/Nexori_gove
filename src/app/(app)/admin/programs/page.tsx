import prisma from "@/lib/db";
import ProgramsClient from "./ProgramsClient";

export const dynamic = "force-dynamic";

export default async function ProgramsPage() {
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
}
