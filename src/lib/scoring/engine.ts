import prisma from "@/lib/db";
import { routeAI } from "@/lib/ai/router";
import { retrieveRelevantChunks } from "@/lib/rag/retriever";
import { GovernanceEventType } from "@prisma/client";
import type { GovernanceContext } from "@prisma/client";
import {
  scoreRegulatoryExposure,
  scoreProductionImpact,
  scoreAIInvolvement,
  scoreCustomerImpact,
  scoreDataExposure,
  scoreBlastRadius,
  scoreSecuritySensitivity,
  scoreDeploymentCriticality,
  scoreInfrastructureImpact,
  scoreThirdPartyRisk,
  scoreIncidentHistory,
  type DimensionInput,
} from "./dimensions";

// ── Weights — must sum to 100 ─────────────────────────────────────────────────
const WEIGHTS = {
  regulatoryExp: 20,
  productionImpact: 15,
  aiInvolvement: 15,
  customerImpact: 10,
  dataExposure: 10,
  blastRadius: 8,
  securitySens: 8,
  deploymentCrit: 5,
  infraImpact: 4,
  thirdPartyRisk: 3,
  incidentHistory: 2,
} as const;

// ── Intensity thresholds ──────────────────────────────────────────────────────
export type IntensityLevel = "minimal" | "standard" | "regulated" | "enhanced";

export function compositeToIntensity(score: number): IntensityLevel {
  if (score < 25) return "minimal";
  if (score < 50) return "standard";
  if (score < 75) return "regulated";
  return "enhanced";
}

export function intensityToAIMode(intensity: IntensityLevel): string {
  switch (intensity) {
    case "minimal":
      return "AI_ASSIST";
    case "standard":
      return "AI_ASSIST";
    case "regulated":
      return "AI_REVIEW";
    case "enhanced":
      return "AI_GOVERNED";
  }
}

export interface RiskScoreResult {
  riskScoreId: string;
  caseId: string;
  compositeScore: number;
  intensity: IntensityLevel;
  aiModeRecommended: string;
  reasoning: string;
  dimensions: Record<keyof typeof WEIGHTS, number>;
  retrievedPolicyIds: string[];
}

export async function scoreGovernanceCase(
  caseId: string,
  context: GovernanceContext,
  projectId: string,
  opts: {
    regulatoryFrameworks?: string[];
    jurisdiction?: string;
    openSecurityFindings?: number;
    releaseFrequencyDays?: number;
    tenantId?: string;
  } = {}
): Promise<RiskScoreResult> {
  const regulatoryFrameworks = opts.regulatoryFrameworks ?? [];
  const jurisdiction = opts.jurisdiction ?? "GLOBAL";
  const openSecurityFindings = opts.openSecurityFindings ?? 0;
  const releaseFrequencyDays = opts.releaseFrequencyDays ?? 14;

  const input: DimensionInput = {
    context,
    regulatoryFrameworks,
    jurisdiction,
    openSecurityFindings,
    releaseFrequencyDays,
  };

  // Score all 11 dimensions
  const dims = {
    regulatoryExp: scoreRegulatoryExposure(input),
    productionImpact: scoreProductionImpact(input),
    aiInvolvement: scoreAIInvolvement(input),
    customerImpact: scoreCustomerImpact(input),
    dataExposure: scoreDataExposure(input),
    blastRadius: scoreBlastRadius(input),
    securitySens: scoreSecuritySensitivity(input),
    deploymentCrit: scoreDeploymentCriticality(input),
    infraImpact: scoreInfrastructureImpact(input),
    thirdPartyRisk: scoreThirdPartyRisk(input),
    incidentHistory: scoreIncidentHistory(input),
  };

  // Weighted composite (0–100)
  const compositeScore = Math.round(
    (Object.keys(WEIGHTS) as Array<keyof typeof WEIGHTS>).reduce(
      (sum, key) => sum + dims[key] * WEIGHTS[key],
      0
    )
  );

  const intensity = compositeToIntensity(compositeScore);
  const aiModeRecommended = intensityToAIMode(intensity);
  const scoringConfidence = regulatoryFrameworks.length > 0 ? 0.9 : 0.7;

  // RAG: retrieve policy chunks relevant to the risk profile
  const ragQuery = [
    context.epicTitle,
    `${intensity} intensity governance`,
    regulatoryFrameworks.join(" "),
    context.aiSystemInvolved ? "AI governance EU AI Act" : "",
    context.thirdPartyChanges ? "DORA third-party risk" : "",
  ]
    .filter(Boolean)
    .join(". ");

  let retrievedChunks: Awaited<ReturnType<typeof retrieveRelevantChunks>> = [];
  try {
    retrievedChunks = await retrieveRelevantChunks(ragQuery, opts.tenantId, 5);
  } catch {
    // Best-effort — no policy corpus yet is valid
  }

  // AI narrative reasoning
  let reasoning = "";
  let usageEventId = "";

  const dimensionSummary = Object.entries(dims)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${(v * 100).toFixed(0)}%`)
    .join(", ");

  try {
    const aiResult = await routeAI({
      projectId,
      action: "risk-scoring",
      messages: [
        {
          role: "system",
          content:
            "You are a governance risk scoring analyst for a regulated financial organisation. " +
            "Provide a concise 2–3 sentence explanation of why this delivery scored at the given intensity level. " +
            "Reference the top risk drivers. Only use the provided data.",
        },
        {
          role: "user",
          content: [
            `Epic: ${context.epicTitle}`,
            `Composite Score: ${compositeScore}/100 → ${intensity.toUpperCase()}`,
            `Top drivers: ${dimensionSummary}`,
            `Environment: ${context.environment ?? "unknown"}`,
            `Data: ${context.dataClassification ?? "unclassified"}`,
            `AI Involved: ${context.aiSystemInvolved}`,
            `3rd Party: ${context.thirdPartyChanges}`,
            `Frameworks: ${regulatoryFrameworks.join(", ") || "none"}`,
            `Prior Incidents: ${context.priorIncidents}`,
          ].join("\n"),
        },
      ],
      maxTokens: 256,
    });
    reasoning = aiResult.content;
    usageEventId = aiResult.usageEventId;
  } catch {
    reasoning = `Score ${compositeScore}/100 (${intensity}). Top drivers: ${dimensionSummary}.`;
  }

  // Persist risk score + emit GovernanceEvent
  const riskScore = await prisma.$transaction(async (tx) => {
    const score = await tx.governanceRiskScore.upsert({
      where: { caseId },
      update: {
        ...dims,
        compositeScore,
        intensity,
        scoringConfidence,
        aiModeRecommended,
        reasoning,
        retrievedPolicyIds: retrievedChunks.map((c) => c.id),
        scoredAt: new Date(),
      },
      create: {
        caseId,
        ...dims,
        compositeScore,
        intensity,
        scoringConfidence,
        aiModeRecommended,
        reasoning,
        retrievedPolicyIds: retrievedChunks.map((c) => c.id),
      },
    });

    await tx.governanceEvent.create({
      data: {
        projectId,
        type: GovernanceEventType.RISK_SCORED,
        resourceType: "governance-risk-score",
        resourceId: score.id,
        payload: {
          caseId,
          compositeScore,
          intensity,
          aiModeRecommended,
          usageEventId,
          policyChunksCited: retrievedChunks.length,
        },
      },
    });

    return score;
  });

  return {
    riskScoreId: riskScore.id,
    caseId,
    compositeScore,
    intensity,
    aiModeRecommended,
    reasoning,
    dimensions: dims,
    retrievedPolicyIds: retrievedChunks.map((c) => c.id),
  };
}
