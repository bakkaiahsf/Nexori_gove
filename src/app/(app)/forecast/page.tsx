import prisma from "@/lib/db";
import { DEMO_PROJECT_KEY } from "@/lib/governance";
import ForecastClient from "./ForecastClient";

export const dynamic = "force-dynamic";

export default async function ForecastPage() {
  const project = await prisma.project.findUnique({
    where: { key: DEMO_PROJECT_KEY },
    select: { id: true, name: true },
  });

  const gateDefinitions = await prisma.gateDefinition.findMany({
    select: { slug: true, name: true, category: true, intensityTriggers: true },
    orderBy: { name: "asc" },
  });

  return (
    <ForecastClient
      projectId={project?.id ?? ""}
      projectName={project?.name ?? ""}
      gateDefinitions={gateDefinitions}
    />
  );
}
