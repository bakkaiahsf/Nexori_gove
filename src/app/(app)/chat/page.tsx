import prisma from "@/lib/db";
import { DEMO_PROJECT_KEY, getAIControlSetting } from "@/lib/governance";
import { AIControlMode } from "@prisma/client";
import GovernanceChatClient from "./GovernanceChatClient";

export const dynamic = "force-dynamic";

export default async function GovernanceChatPage() {
  const project = await prisma.project.findUnique({
    where: { key: DEMO_PROJECT_KEY },
    select: { id: true, name: true },
  });

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
