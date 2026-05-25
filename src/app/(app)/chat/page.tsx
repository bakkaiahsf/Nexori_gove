import prisma from "@/lib/db";
import { getAIControlSetting } from "@/lib/governance";
import { AIControlMode } from "@prisma/client";
import GovernanceChatClient from "./GovernanceChatClient";

export const dynamic = "force-dynamic";

export default async function GovernanceChatPage({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  const project = searchParams.projectId
    ? await prisma.project.findUnique({ where: { id: searchParams.projectId }, select: { id: true, name: true } })
    : await prisma.project.findFirst({ where: { status: "active" }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } });

  const [aiSetting, recentCases, activePolicies] = await Promise.all([
    project ? getAIControlSetting(project.id) : Promise.resolve(null),
    project
      ? prisma.governanceCase.findMany({
          where: { projectId: project.id },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, title: true, phase: true, status: true },
        })
      : Promise.resolve([]),
    prisma.policyDocument.findMany({
      orderBy: { uploadedAt: "desc" },
      take: 8,
      select: { id: true, title: true, type: true },
    }),
  ]);

  const currentMode = aiSetting?.mode ?? AIControlMode.AI_ASSIST;
  const isLocked =
    currentMode === AIControlMode.EMERGENCY_LOCK || currentMode === AIControlMode.HUMAN_ONLY;

  return (
    <GovernanceChatClient
      projectId={project?.id ?? null}
      projectName={project?.name ?? "NexoriOS"}
      currentMode={currentMode}
      isLocked={isLocked}
      recentCases={recentCases}
      activePolicies={activePolicies}
    />
  );
}
