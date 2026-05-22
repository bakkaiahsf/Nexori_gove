import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AIControlMode } from "@prisma/client";
import { getAIControlSetting, setAIControlMode, DEMO_PROJECT_KEY } from "@/lib/governance";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

async function resolveProjectId(): Promise<string | null> {
  const project = await prisma.project.findUnique({
    where: { key: DEMO_PROJECT_KEY },
    select: { id: true },
  });
  return project?.id ?? null;
}

export async function GET() {
  const projectId = await resolveProjectId();
  if (!projectId) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const setting = await getAIControlSetting(projectId);
  return NextResponse.json(setting ?? { mode: AIControlMode.AI_ASSIST });
}

const ModeUpdateSchema = z.object({
  mode: z.nativeEnum(AIControlMode),
  setBy: z.string().email().optional(),
  reason: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const projectId = await resolveProjectId();
  if (!projectId) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const parsed = ModeUpdateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  const { mode, setBy, reason } = parsed.data;
  const result = await setAIControlMode(projectId, mode, setBy ?? "bakkaiahsf@gmail.com", reason);
  return NextResponse.json({ mode: result.mode, setAt: result.setAt });
}
