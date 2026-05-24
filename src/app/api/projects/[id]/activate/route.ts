/**
 * Activate governance for a project by creating a GovernanceCase.
 *
 * Called after project creation when a Jira epic is imported.
 * Creates: GovernanceCase + GovernanceGates (from gate library) + EpicSnapshot + GovernanceEvents.
 *
 * The gate pipeline is dynamically composed — nothing hardcoded.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { GovernanceEventType } from "@prisma/client";

const ActivateSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(2000).optional(),
  phase: z.string().min(1).default("initiation"),
  epicKey: z.string().optional(),
  epicConnectorId: z.string().optional(),
  templateId: z.string().optional(),
  composedGateSlugs: z.array(z.string()).default([]),
  activatedBy: z.string().email().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, key: true, name: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ActivateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const {
    title,
    description,
    phase,
    epicKey,
    epicConnectorId,
    templateId,
    composedGateSlugs,
    activatedBy,
  } = parsed.data;

  const actorEmail = activatedBy ?? "governance@nexori.system";

  // Resolve gate definitions for the composed pipeline
  let gateDefinitions: {
    id: string;
    slug: string;
    name: string;
    category: string;
    approverRoles: string[];
    defaultSlaHours: number;
  }[] = [];

  if (composedGateSlugs.length > 0) {
    gateDefinitions = await prisma.gateDefinition.findMany({
      where: { slug: { in: composedGateSlugs }, enabled: true },
      select: {
        id: true,
        slug: true,
        name: true,
        category: true,
        approverRoles: true,
        defaultSlaHours: true,
      },
    });
  }

  // If no gates were composed, use the template's gate hints to pick defaults
  if (gateDefinitions.length === 0 && templateId) {
    const template = await prisma.governanceTemplate.findUnique({
      where: { id: templateId },
      select: { stages: true },
    });
    if (template) {
      const stages = template.stages as {
        gateHints?: string[];
        gateCategories?: string[];
      }[];
      const hints = stages.flatMap((s) => s.gateHints ?? []);
      if (hints.length > 0) {
        gateDefinitions = await prisma.gateDefinition.findMany({
          where: { slug: { in: hints }, enabled: true },
          select: {
            id: true,
            slug: true,
            name: true,
            category: true,
            approverRoles: true,
            defaultSlaHours: true,
          },
        });
      }
    }
  }

  // Create everything in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create the governance case
    const govCase = await tx.governanceCase.create({
      data: {
        projectId: project.id,
        title,
        description: description ?? null,
        phase,
        status: "active",
        ownedBy: actorEmail,
        sourceConnectorId: epicConnectorId ?? null,
        sourceEpicKey: epicKey ?? null,
      },
    });

    // 2. Create GovernanceGates for each composed gate
    const gates = await Promise.all(
      gateDefinitions.map((gate, index) =>
        tx.governanceGate.create({
          data: {
            caseId: govCase.id,
            definitionSlug: gate.slug,
            name: gate.name,
            status: "PENDING",
            order: index + 1,
          },
        })
      )
    );

    // 3. Emit CASE_CREATED event
    await tx.governanceEvent.create({
      data: {
        projectId: project.id,
        type: GovernanceEventType.CASE_CREATED,
        resourceType: "case",
        resourceId: govCase.id,
        actorEmail,
        payload: {
          title,
          phase,
          epicKey: epicKey ?? null,
          templateId: templateId ?? null,
          gateCount: gates.length,
          gateSlugs: gateDefinitions.map((g) => g.slug),
          source: "project-import",
        },
      },
    });

    // 4. Emit TRIGGER_MATCHED event if from Jira import
    if (epicKey) {
      await tx.governanceEvent.create({
        data: {
          projectId: project.id,
          type: GovernanceEventType.TRIGGER_MATCHED,
          resourceType: "case",
          resourceId: govCase.id,
          actorEmail,
          payload: {
            source: "jira",
            epicKey,
            connectorId: epicConnectorId ?? null,
            action: "FULL_PIPELINE",
            triggeredBy: "project-import-wizard",
          },
        },
      });
    }

    return { govCase, gates };
  });

  return NextResponse.json(
    {
      caseId: result.govCase.id,
      title: result.govCase.title,
      gateCount: result.gates.length,
      projectKey: project.key,
    },
    { status: 201 }
  );
}
