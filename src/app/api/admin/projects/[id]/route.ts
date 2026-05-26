import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  ownerEmail: z.string().email().optional(),
  status: z.enum(["active", "archived", "paused"]).optional(),
  governanceProfile: z.enum(["agile", "regulated", "ai_sensitive", "critical", "third_party", "custom"]).optional(),
  programId: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const project = await prisma.project.update({
    where: { id: params.id },
    data: parsed.data,
    select: { id: true, name: true, status: true, governanceProfile: true },
  });

  return NextResponse.json(project);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, key: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Soft-delete: archive keeps full audit trail (GovernanceEvent, EvidenceItem all immutable)
  await prisma.$transaction([
    prisma.project.update({
      where: { id: params.id },
      data: { status: "archived" },
    }),
    prisma.governanceEvent.create({
      data: {
        projectId: params.id,
        type: "PROJECT_CREATED", // reuse closest event type — no PROJECT_ARCHIVED enum yet
        actorEmail: "admin",
        resourceType: "project",
        resourceId: params.id,
        payload: { action: "archived", projectKey: project.key, projectName: project.name },
      },
    }),
  ]);

  return NextResponse.json({ ok: true, archived: true, id: params.id });
}
