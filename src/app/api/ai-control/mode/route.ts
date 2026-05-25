import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AIControlMode } from "@prisma/client";
import { getAIControlSetting, setAIControlMode } from "@/lib/governance";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

async function resolveProjectId(projectId?: string): Promise<string | null> {
  if (projectId) return projectId;
  const project = await prisma.project.findFirst({
    where: { status: "active" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return project?.id ?? null;
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId") ?? undefined;
  const resolvedId = await resolveProjectId(projectId);
  if (!resolvedId) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const setting = await getAIControlSetting(resolvedId);
  return NextResponse.json(setting ?? { mode: AIControlMode.AI_ASSIST });
}

const ModeUpdateSchema = z.object({
  mode: z.nativeEnum(AIControlMode),
  setBy: z.string().email().optional(),
  reason: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const body: unknown = await req.json().catch(() => ({}));
  const explicitProjectId = (body as Record<string, unknown>).projectId as string | undefined;
  const resolvedId = await resolveProjectId(explicitProjectId);
  if (!resolvedId) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const parsed = ModeUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { mode, setBy, reason } = parsed.data;
  const result = await setAIControlMode(resolvedId, mode, setBy ?? "bakkaiahsf@gmail.com", reason);
  return NextResponse.json({ mode: result.mode, setAt: result.setAt });
}
