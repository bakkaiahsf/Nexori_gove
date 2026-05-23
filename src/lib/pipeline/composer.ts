import prisma from "@/lib/db";
import { GateStatus, GovernanceEventType } from "@prisma/client";
import type { GovernanceContext, GovernanceRiskScore, GateDefinition } from "@prisma/client";
import { findInheritableApproval } from "./inheritance";
import { routeApproval } from "./expert-router";
import type { IntensityLevel } from "@/lib/scoring/engine";

const COMPOSER_VERSION = "1.0";

type SkipCondition = {
  field: string;
  op: "eq" | "neq" | "lt" | "gt" | "notContains" | "notIn";
  value: unknown;
};

/**
 * Evaluates a gate's skip conditions against the current context.
 * Returns the first condition that matched (skip reason) or null if gate should proceed.
 */
function evaluateSkipConditions(
  gate: GateDefinition,
  context: GovernanceContext,
  regulatoryFrameworks: string[]
): string | null {
  if (!gate.skipConditions) return null;

  const conditions = gate.skipConditions as unknown as SkipCondition[];
  if (!Array.isArray(conditions)) return null;

  const contextMap: Record<string, unknown> = {
    environment: context.environment,
    dataClassification: context.dataClassification,
    aiSystemInvolved: context.aiSystemInvolved,
    thirdPartyChanges: context.thirdPartyChanges,
    infrastructureChange: context.infrastructureChange,
    regulatoryScope: regulatoryFrameworks,
  };

  for (const cond of conditions) {
    const actual = contextMap[cond.field];

    let matched = false;
    switch (cond.op) {
      case "eq":
        matched = actual === cond.value;
        break;
      case "neq":
        matched = actual !== cond.value;
        break;
      case "lt":
        matched = typeof actual === "number" && actual < (cond.value as number);
        break;
      case "gt":
        matched = typeof actual === "number" && actual > (cond.value as number);
        break;
      case "notContains":
        matched = Array.isArray(actual)
          ? !actual.includes(cond.value)
          : typeof actual === "string" && !actual.includes(String(cond.value));
        break;
      case "notIn":
        matched = Array.isArray(cond.value) ? !(cond.value as unknown[]).includes(actual) : true;
        break;
    }

    if (matched) {
      return `Skip condition met: ${cond.field} ${cond.op} ${JSON.stringify(cond.value)}`;
    }
  }

  return null;
}

export interface PipelineResult {
  pipelineId: string;
  caseId: string;
  totalGateCount: number;
  reducedFromBaseline: number;
  gatesIncluded: Array<{ slug: string; gateId: string; order: number; reason: string }>;
  gatesSkipped: Array<{ slug: string; skipReason: string }>;
  inheritedApprovals: Array<{ slug: string; fromCaseId: string; rationale: string }>;
}

export async function composeAdaptivePipeline(
  caseId: string,
  riskScore: GovernanceRiskScore,
  context: GovernanceContext,
  projectId: string,
  opts: {
    regulatoryFrameworks?: string[];
    jurisdiction?: string;
  } = {}
): Promise<PipelineResult> {
  const intensity = riskScore.intensity as IntensityLevel;
  const regulatoryFrameworks = opts.regulatoryFrameworks ?? [];
  const jurisdiction = opts.jurisdiction ?? "GLOBAL";

  // 1. Load gate definitions applicable to this intensity level
  const allGates = await prisma.gateDefinition.findMany({
    where: {
      enabled: true,
      intensityTriggers: { hasSome: [intensity] },
    },
    orderBy: { defaultSlaHours: "asc" },
  });

  // Baseline = all applicable gates before skipping/inheritance
  const baseline = allGates.length;

  const gatesIncluded: PipelineResult["gatesIncluded"] = [];
  const gatesSkipped: PipelineResult["gatesSkipped"] = [];
  const inheritedApprovals: PipelineResult["inheritedApprovals"] = [];

  // Created gate DB records to track
  const gateDbIds: string[] = [];

  let order = 1;

  for (const gateDef of allGates) {
    // 2. Check skip conditions
    const skipReason = evaluateSkipConditions(gateDef, context, regulatoryFrameworks);
    if (skipReason) {
      gatesSkipped.push({ slug: gateDef.slug, skipReason });
      continue;
    }

    // 3. Check inheritance
    const inherited = await findInheritableApproval(gateDef.slug, projectId, context, riskScore);

    if (inherited) {
      // Create gate record pre-approved (inherited)
      const gate = await prisma.governanceGate.create({
        data: {
          caseId,
          name: gateDef.name,
          description: gateDef.description,
          order,
          required: true,
          status: GateStatus.APPROVED,
          approvedAt: inherited.approvedAt,
          approvedBy: inherited.approvedBy,
          definitionSlug: gateDef.slug,
          inheritedFrom: inherited.fromCaseId,
        },
      });

      await prisma.governanceEvent.create({
        data: {
          projectId,
          type: GovernanceEventType.APPROVAL_INHERITED,
          resourceType: "governance-gate",
          resourceId: gate.id,
          payload: {
            caseId,
            gateSlug: gateDef.slug,
            gateName: gateDef.name,
            fromCaseId: inherited.fromCaseId,
            rationale: inherited.rationale,
          },
        },
      });

      gatesIncluded.push({
        slug: gateDef.slug,
        gateId: gate.id,
        order,
        reason: `INHERITED: ${inherited.rationale}`,
      });
      inheritedApprovals.push({
        slug: gateDef.slug,
        fromCaseId: inherited.fromCaseId,
        rationale: inherited.rationale,
      });
      gateDbIds.push(gate.id);
      order++;
      continue;
    }

    // 4. Active gate — route to reviewer and create approval request
    const gate = await prisma.governanceGate.create({
      data: {
        caseId,
        name: gateDef.name,
        description: gateDef.description,
        order,
        required: true,
        status: GateStatus.PENDING,
        definitionSlug: gateDef.slug,
      },
    });

    // Route to expert reviewer
    const reviewer = await routeApproval(gateDef, context, jurisdiction);

    await prisma.approvalRequest.create({
      data: {
        gateId: gate.id,
        status: "PENDING",
        notes: reviewer
          ? `Routed to ${reviewer.name ?? reviewer.email} (${reviewer.source})`
          : "Routed to governance team",
      },
    });

    gatesIncluded.push({
      slug: gateDef.slug,
      gateId: gate.id,
      order,
      reason: reviewer ? `Routed to ${reviewer.email}` : "Pending reviewer assignment",
    });
    gateDbIds.push(gate.id);
    order++;
  }

  const totalGateCount = gatesIncluded.length;
  const reducedFromBaseline = baseline - totalGateCount;

  // 5. Persist AdaptivePipeline record + emit PIPELINE_ADAPTED event
  const pipeline = await prisma.$transaction(async (tx) => {
    const pl = await tx.adaptivePipeline.upsert({
      where: { caseId },
      update: {
        riskScoreId: riskScore.id,
        composerVersion: COMPOSER_VERSION,
        gatesIncluded,
        gatesSkipped,
        inheritedApprovals,
        totalGateCount,
        reducedFromBaseline,
        composedAt: new Date(),
      },
      create: {
        caseId,
        riskScoreId: riskScore.id,
        composerVersion: COMPOSER_VERSION,
        gatesIncluded,
        gatesSkipped,
        inheritedApprovals,
        totalGateCount,
        reducedFromBaseline,
      },
    });

    await tx.governanceEvent.create({
      data: {
        projectId,
        type: GovernanceEventType.PIPELINE_ADAPTED,
        resourceType: "adaptive-pipeline",
        resourceId: pl.id,
        payload: {
          caseId,
          intensity,
          baseline,
          totalGateCount,
          reducedFromBaseline,
          skippedCount: gatesSkipped.length,
          inheritedCount: inheritedApprovals.length,
        },
      },
    });

    return pl;
  });

  return {
    pipelineId: pipeline.id,
    caseId,
    totalGateCount,
    reducedFromBaseline,
    gatesIncluded,
    gatesSkipped,
    inheritedApprovals,
  };
}
