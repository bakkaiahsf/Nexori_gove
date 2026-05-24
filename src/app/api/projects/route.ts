import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { AIControlMode, GovernanceEventType, RegulatoryFramework } from "@prisma/client";

const CreateProjectSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(30)
    .regex(/^[A-Z0-9-]+$/, "Key must be uppercase letters, numbers, and hyphens only"),
  name: z.string().min(3).max(200),
  description: z.string().max(2000).optional(),
  domain: z.string().optional(), // "banking"|"insurance"|"fintech"|"healthcare"
  classification: z.enum(["public", "internal", "confidential", "restricted"]).optional(),
  ownerEmail: z.string().email(),
  type: z.enum(["project", "program"]).default("project"),
  frameworks: z.array(z.nativeEnum(RegulatoryFramework)).default([]),
  jiraConnectorId: z.string().optional(),
  aiMode: z.nativeEnum(AIControlMode).default(AIControlMode.AI_ASSIST),
  createdBy: z.string().email().optional(),
});

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      domain: true,
      classification: true,
      ownerEmail: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          governanceCases: true,
          evidenceItems: true,
          triggerRules: true,
        },
      },
      aiControlSetting: {
        select: { mode: true, setAt: true },
      },
      governanceCases: {
        where: { status: "active" },
        select: {
          id: true,
          status: true,
          governanceGates: {
            select: { status: true },
          },
        },
        take: 100,
      },
    },
  });

  const enriched = projects.map((p) => {
    const allGates = p.governanceCases.flatMap((c) => c.governanceGates);
    const blocked = allGates.filter((g) => g.status === "REJECTED").length;
    const pending = allGates.filter((g) => g.status === "PENDING" || g.status === "OPEN").length;
    const readiness =
      blocked > 0 ? "NO_GO" : pending > 0 ? "CONDITIONAL" : allGates.length > 0 ? "GO" : "SETUP";

    return {
      id: p.id,
      key: p.key,
      name: p.name,
      description: p.description,
      domain: p.domain,
      classification: p.classification,
      ownerEmail: p.ownerEmail,
      status: p.status,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      aiMode: p.aiControlSetting?.mode ?? AIControlMode.AI_ASSIST,
      activeCases: p._count.governanceCases,
      evidenceItems: p._count.evidenceItems,
      triggerRules: p._count.triggerRules,
      blockedGates: blocked,
      pendingGates: pending,
      readiness,
    };
  });

  return NextResponse.json({ projects: enriched });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { key, name, description, domain, classification, ownerEmail, aiMode, createdBy } =
    parsed.data;

  const existing = await prisma.project.findUnique({ where: { key } });
  if (existing) {
    return NextResponse.json({ error: `Project key "${key}" already exists` }, { status: 409 });
  }

  const project = await prisma.$transaction(async (tx) => {
    const p = await tx.project.create({
      data: {
        key,
        name,
        description: description ?? null,
        domain: domain ?? null,
        classification: classification ?? "internal",
        ownerEmail,
        status: "active",
      },
    });

    // Bootstrap AI control setting
    await tx.aIControlSetting.create({
      data: {
        projectId: p.id,
        mode: aiMode,
        setBy: createdBy ?? ownerEmail,
        reason: "Initial project setup",
      },
    });

    // Flight recorder: project created
    await tx.governanceEvent.create({
      data: {
        projectId: p.id,
        type: GovernanceEventType.PROJECT_CREATED,
        resourceType: "project",
        resourceId: p.id,
        actorEmail: createdBy ?? ownerEmail,
        payload: { key, name, domain, classification, aiMode, source: "admin-ui" },
      },
    });

    return p;
  });

  return NextResponse.json(
    {
      projectId: project.id,
      key: project.key,
      name: project.name,
    },
    { status: 201 }
  );
}
