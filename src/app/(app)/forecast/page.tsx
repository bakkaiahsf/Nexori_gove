import prisma from "@/lib/db";
import ForecastClient from "./ForecastClient";

export const dynamic = "force-dynamic";

export default async function ForecastPage({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  const project = searchParams.projectId
    ? await prisma.project.findUnique({ where: { id: searchParams.projectId }, select: { id: true, name: true } })
    : await prisma.project.findFirst({ where: { status: "active" }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } });

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
