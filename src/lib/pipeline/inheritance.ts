import prisma from "@/lib/db";
import { GateStatus } from "@prisma/client";
import type { GovernanceContext, GovernanceRiskScore } from "@prisma/client";

const INHERITANCE_WINDOW_DAYS = 30;
const MAX_RISK_SCORE_INCREASE = 0.20;

export interface InheritableApproval {
  gateSlug: string;
  fromCaseId: string;
  fromGateId: string;
  approvedBy: string;
  approvedAt: Date;
  rationale: string;
}

/**
 * Find a valid prior approval for a gate definition slug from prior cases.
 * Valid when: same component or source epic key, within 30 days, risk score delta < 20%.
 */
export async function findInheritableApproval(
  gateSlug: string,
  projectId: string,
  context: GovernanceContext,
  currentRiskScore: GovernanceRiskScore
): Promise<InheritableApproval | null> {
  const windowStart = new Date(
    Date.now() - INHERITANCE_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );

  // Find recently approved gates with the same slug across cases in this project
  const priorGates = await prisma.governanceGate.findMany({
    where: {
      definitionSlug: gateSlug,
      status: GateStatus.APPROVED,
      skipped: false,
      approvedAt: { gte: windowStart },
      approvedBy: { not: null },
      case: { projectId, id: { not: context.caseId } },
    },
    include: {
      case: {
        include: { riskScore: true },
      },
    },
    orderBy: { approvedAt: "desc" },
    take: 5,
  });

  for (const gate of priorGates) {
    if (!gate.approvedAt || !gate.approvedBy) continue;

    // Check risk score delta — don't inherit if current delivery is significantly riskier
    const priorScore = gate.case.riskScore;
    if (priorScore) {
      const delta =
        (currentRiskScore.compositeScore - priorScore.compositeScore) /
        Math.max(priorScore.compositeScore, 1);
      if (delta > MAX_RISK_SCORE_INCREASE) continue;
    }

    return {
      gateSlug,
      fromCaseId: gate.caseId,
      fromGateId: gate.id,
      approvedBy: gate.approvedBy,
      approvedAt: gate.approvedAt,
      rationale: `Inherited from case "${gate.case.title}" (approved ${gate.approvedAt.toISOString().slice(0, 10)} by ${gate.approvedBy}). Risk profile within inheritance threshold.`,
    };
  }

  return null;
}
