import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { AIControlMode } from "@prisma/client";

const SourceSchema = z.object({
  connectorId: z.string(),
  boardId: z.string(),
  boardName: z.string(),
  boardType: z.string().default("scrum"),
});

const StartSchema = z.object({
  projectName: z.string().min(1),
  projectKey: z.string().min(1).max(16).regex(/^[A-Z0-9_-]+$/),
  ownerEmail: z.string().email().optional().default("admin@nexori.io"),
  programId: z.string().optional(),
  sources: z.array(SourceSchema).min(0),
  governanceProfile: z.enum(["agile", "regulated", "ai_sensitive", "critical", "third_party", "custom"]),
  monitoringLevel: z.enum(["manual", "scheduled", "active", "full_assisted"]),
  notificationPrefs: z.array(z.string()).optional().default([]),
});

const PROFILE_TO_AI_MODE: Record<string, AIControlMode> = {
  agile: AIControlMode.AI_ASSIST,
  regulated: AIControlMode.AI_REVIEW,
  ai_sensitive: AIControlMode.AI_REVIEW,
  critical: AIControlMode.AI_REVIEW,
  third_party: AIControlMode.AI_REVIEW,
  custom: AIControlMode.AI_ASSIST,
};

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = StartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const data = parsed.data;

  // Check for duplicate project key
  const existing = await prisma.project.findUnique({ where: { key: data.projectKey } });
  if (existing) {
    return NextResponse.json({ error: `Project key ${data.projectKey} already exists` }, { status: 409 });
  }

  const aiMode = PROFILE_TO_AI_MODE[data.governanceProfile];

  try {
    const project = await prisma.$transaction(async (tx) => {
      // Create project
      const proj = await tx.project.create({
        data: {
          key: data.projectKey,
          name: data.projectName,
          ownerEmail: data.ownerEmail,
          status: "active",
          domain: "delivery",
          classification: "internal",
          ...(data.programId ? { programId: data.programId } : {}),
        },
      });

      // Create AI control setting
      await tx.aIControlSetting.create({
        data: {
          projectId: proj.id,
          mode: aiMode,
          setBy: data.ownerEmail,
          reason: `Governance profile: ${data.governanceProfile} — set during project activation`,
        },
      });

      // Create project boards for each linked source
      for (const source of data.sources) {
        await tx.projectBoard.create({
          data: {
            projectId: proj.id,
            connectorId: source.connectorId,
            boardId: source.boardId,
            boardName: source.boardName,
            boardType: source.boardType,
            enabled: true,
          },
        });

        await tx.governanceEvent.create({
          data: {
            type: "BOARD_ADDED",
            projectId: proj.id,
            actorEmail: data.ownerEmail,
            resourceType: "ProjectBoard",
            resourceId: proj.id,
            payload: {
              boardId: source.boardId,
              boardName: source.boardName,
              connectorId: source.connectorId,
            },
          },
        });
      }

      // Create default monitoring rules if active or full_assisted
      if (data.monitoringLevel === "active" || data.monitoringLevel === "full_assisted") {
        await tx.governanceTriggerRule.createMany({
          data: [
            {
              projectId: proj.id,
              name: "High-risk epic created",
              description: "When a high-risk Jira epic is created, create assurance item and notify project manager",
              source: "jira",
              eventType: "epic.created",
              conditions: [],
              action: "FULL_PIPELINE" as const,
              enabled: true,
              priority: 8,
              createdBy: data.ownerEmail,
            },
            {
              projectId: proj.id,
              name: "PR touches sensitive paths",
              description: "When a PR touches payment or auth files, create a readiness check",
              source: "github",
              eventType: "pull_request.opened",
              conditions: [{ field: "changed_files", op: "contains", value: "payment" }],
              action: "CLASSIFY_ONLY" as const,
              enabled: true,
              priority: 7,
              createdBy: data.ownerEmail,
            },
          ],
        });
      }

      // Emit PROJECT_CREATED event
      await tx.governanceEvent.create({
        data: {
          type: "PROJECT_CREATED",
          projectId: proj.id,
          actorEmail: data.ownerEmail,
          resourceType: "Project",
          resourceId: proj.id,
          payload: {
            projectName: data.projectName,
            governanceProfile: data.governanceProfile,
            monitoringLevel: data.monitoringLevel,
            sourcesCount: data.sources.length,
            notificationPrefs: data.notificationPrefs,
          },
        },
      });

      return proj;
    });

    return NextResponse.json({ id: project.id, key: project.key, name: project.name });
  } catch (err) {
    console.error("project start error", err);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
