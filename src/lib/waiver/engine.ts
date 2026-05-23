import prisma from "@/lib/db";
import { routeAI } from "@/lib/ai/router";
import { GovernanceEventType } from "@prisma/client";

export type WaiverType = "emergency" | "time-limited" | "risk-accepted" | "expedited-path";

export interface WaiverRequest {
  projectId: string;
  caseId?: string;
  gateId?: string;
  requestedBy: string;
  waiverType: WaiverType;
  reason: string;
}

export interface WaiverResult {
  waiverId: string;
  residualRisk: string;
  compensatingControls: Array<{ control: string; owner: string; dueDate?: string }>;
  status: string;
}

/**
 * Requests a governance waiver.
 * AI computes residual risk and suggests compensating controls.
 * Full audit bundle snapshot is captured at request time.
 */
export async function requestGovernanceWaiver(req: WaiverRequest): Promise<WaiverResult> {
  // Build context snapshot for audit bundle
  const [governanceCase, gate] = await Promise.all([
    req.caseId
      ? prisma.governanceCase.findUnique({
          where: { id: req.caseId },
          include: { riskScore: true, context: true },
        })
      : Promise.resolve(null),
    req.gateId
      ? prisma.governanceGate.findUnique({ where: { id: req.gateId } })
      : Promise.resolve(null),
  ]);

  const contextSummary = [
    governanceCase ? `Case: ${governanceCase.title} (${governanceCase.phase})` : "",
    gate ? `Gate being waived: ${gate.name}` : "",
    `Waiver type: ${req.waiverType}`,
    `Reason: ${req.reason}`,
    governanceCase?.riskScore
      ? `Risk score: ${governanceCase.riskScore.compositeScore}/100 (${governanceCase.riskScore.intensity})`
      : "",
    governanceCase?.context?.contextSummary
      ? `Context: ${governanceCase.context.contextSummary}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  // AI: residual risk + compensating controls
  let residualRisk = "Manual risk assessment required.";
  let compensatingControls: WaiverResult["compensatingControls"] = [];
  let usageEventId = "";

  try {
    const aiResult = await routeAI({
      projectId: req.projectId,
      action: "waiver-analysis",
      messages: [
        {
          role: "system",
          content:
            "You are a governance risk officer for a regulated financial organisation. " +
            "Analyse the governance waiver request. Provide: " +
            "1. A concise residual risk statement (what risks remain if the waiver is granted). " +
            "2. 2-3 specific compensating controls (what should be done instead to mitigate risk). " +
            "Format as JSON: { residualRisk: string, compensatingControls: [{control: string, owner: string, dueDate: string}] }. " +
            "Only use information provided. Never invent governance evidence.",
        },
        { role: "user", content: contextSummary },
      ],
      maxTokens: 512,
    });
    usageEventId = aiResult.usageEventId;

    try {
      const parsed = JSON.parse(aiResult.content) as {
        residualRisk?: string;
        compensatingControls?: WaiverResult["compensatingControls"];
      };
      residualRisk = parsed.residualRisk ?? residualRisk;
      compensatingControls = parsed.compensatingControls ?? [];
    } catch {
      // AI returned prose, not JSON — use as residual risk text
      residualRisk = aiResult.content.slice(0, 500);
    }
  } catch {
    // AI unavailable — waiver proceeds with manual risk note
  }

  // Capture full audit bundle at waiver request time
  const auditBundle = {
    requestedAt: new Date().toISOString(),
    requestedBy: req.requestedBy,
    waiverType: req.waiverType,
    reason: req.reason,
    caseSnapshot: governanceCase
      ? {
          id: governanceCase.id,
          title: governanceCase.title,
          phase: governanceCase.phase,
          status: governanceCase.status,
          riskScore: governanceCase.riskScore?.compositeScore,
          intensity: governanceCase.riskScore?.intensity,
        }
      : null,
    gateSnapshot: gate
      ? { id: gate.id, name: gate.name, status: gate.status }
      : null,
    usageEventId,
  };

  const waiver = await prisma.$transaction(async (tx) => {
    const w = await tx.governanceWaiver.create({
      data: {
        projectId: req.projectId,
        caseId: req.caseId,
        gateId: req.gateId,
        requestedBy: req.requestedBy,
        waiverType: req.waiverType,
        reason: req.reason,
        residualRisk,
        compensatingControls,
        status: "pending",
        auditBundle,
      },
    });

    await tx.governanceEvent.create({
      data: {
        projectId: req.projectId,
        type: GovernanceEventType.WAIVER_REQUESTED,
        actorEmail: req.requestedBy,
        resourceType: "governance-waiver",
        resourceId: w.id,
        payload: {
          waiverType: req.waiverType,
          caseId: req.caseId,
          gateId: req.gateId,
          residualRisk,
        },
      },
    });

    return w;
  });

  return {
    waiverId: waiver.id,
    residualRisk,
    compensatingControls,
    status: waiver.status,
  };
}

/**
 * Approves a governance waiver.
 * Updates linked gate to BYPASSED_WITH_EXCEPTION.
 */
export async function approveGovernanceWaiver(
  waiverId: string,
  approvedBy: string
): Promise<{ success: boolean }> {
  const waiver = await prisma.governanceWaiver.findUniqueOrThrow({
    where: { id: waiverId },
  });

  return prisma.$transaction(async (tx) => {
    await tx.governanceWaiver.update({
      where: { id: waiverId },
      data: { status: "approved", approvedBy, approvedAt: new Date() },
    });

    // If a specific gate was waived — mark it bypassed with exception reference
    if (waiver.gateId) {
      await tx.governanceGate.update({
        where: { id: waiver.gateId },
        data: {
          status: "BYPASSED_WITH_EXCEPTION",
          exceptionRef: waiverId,
        },
      });
    }

    await tx.governanceEvent.create({
      data: {
        projectId: waiver.projectId,
        type: GovernanceEventType.WAIVER_APPROVED,
        actorEmail: approvedBy,
        resourceType: "governance-waiver",
        resourceId: waiverId,
        payload: {
          waiverType: waiver.waiverType,
          caseId: waiver.caseId,
          gateId: waiver.gateId,
          residualRisk: waiver.residualRisk,
          compensatingControls: waiver.compensatingControls,
        },
      },
    });

    return { success: true };
  });
}
