import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { DEMO_PROJECT_KEY } from "@/lib/governance";
import { GovernanceEventType } from "@prisma/client";

const CreateCaseSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(2000).optional(),
  phase: z.string().min(1),
  createdBy: z.string().email().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateCaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const project = await prisma.project.findUnique({
    where: { key: DEMO_PROJECT_KEY },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { title, description, phase, createdBy } = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    const govCase = await tx.governanceCase.create({
      data: {
        projectId: project.id,
        title,
        description: description ?? null,
        phase,
        status: "active",
        ownedBy: createdBy ?? "governance@nexori.system",
      },
    });

    await tx.governanceEvent.create({
      data: {
        projectId: project.id,
        type: GovernanceEventType.CASE_CREATED,
        resourceType: "case",
        resourceId: govCase.id,
        actorEmail: createdBy ?? "governance@nexori.system",
        payload: { title, phase, source: "manual-ui" },
      },
    });

    return govCase;
  });

  return NextResponse.json({ caseId: result.id, title: result.title }, { status: 201 });
}
