import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { EvidenceType, GovernanceEventType } from "@prisma/client";

export const dynamic = "force-dynamic";

const SubmitSchema = z.object({
  projectId: z.string().optional(),
  caseId: z.string().optional(),
  type: z.nativeEnum(EvidenceType),
  title: z.string().min(1),
  description: z.string().optional(),
  submittedBy: z.string().min(1),
  externalRef: z.string().optional(),
  content: z.string().optional(),
});

const RequestSchema = z.object({
  projectId: z.string().optional(),
  caseId: z.string().optional(),
  description: z.string().min(1),
  requestedBy: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "submit";

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (action === "request") {
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }
    const { projectId: reqProjectId, caseId, description, requestedBy } = parsed.data;

    const project = reqProjectId
      ? await prisma.project.findUnique({ where: { id: reqProjectId }, select: { id: true } })
      : await prisma.project.findFirst({ where: { status: "active" }, orderBy: { createdAt: "asc" }, select: { id: true } });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await prisma.governanceEvent.create({
      data: {
        projectId: project.id,
        resourceType: caseId ? "case" : null,
        resourceId: caseId ?? null,
        type: GovernanceEventType.EVIDENCE_REQUESTED,
        actorEmail: requestedBy,
        payload: { description: description.slice(0, 200) },
      },
    });

    return NextResponse.json({ ok: true });
  }

  // Default: submit
  const parsed = SubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }
  const { projectId: reqProjectId, caseId, type, title, description, submittedBy, externalRef, content } = parsed.data;

  const project = reqProjectId
    ? await prisma.project.findUnique({ where: { id: reqProjectId }, select: { id: true } })
    : await prisma.project.findFirst({ where: { status: "active" }, orderBy: { createdAt: "asc" }, select: { id: true } });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const [evidenceItem] = await prisma.$transaction([
    prisma.evidenceItem.create({
      data: {
        projectId: project.id,
        caseId: caseId ?? null,
        type,
        title,
        description: description ?? null,
        submittedBy,
        externalRef: externalRef ?? null,
        content: content ?? null,
      },
    }),
    prisma.governanceEvent.create({
      data: {
        projectId: project.id,
        resourceType: caseId ? "case" : "evidence",
        resourceId: caseId ?? null,
        type: GovernanceEventType.EVIDENCE_SUBMITTED,
        actorEmail: submittedBy,
        payload: { title },
      },
    }),
  ]);

  return NextResponse.json(evidenceItem, { status: 201 });
}
