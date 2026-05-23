import type { GovernanceContext } from "@prisma/client";

export interface DimensionInput {
  context: GovernanceContext;
  regulatoryFrameworks: string[]; // e.g. ["DORA", "EU_AI_ACT"]
  jurisdiction: string; // "EU" | "UK" | "US" | "GLOBAL"
  openSecurityFindings: number;
  releaseFrequencyDays: number; // avg days between deploys for this system
}

// ── Scoring helpers ────────────────────────────────────────────────────────────

function clamp(v: number): number {
  return Math.min(1, Math.max(0, v));
}

const EU_HIGH_RISK_FRAMEWORKS = new Set(["EU_AI_ACT", "DORA", "GDPR"]);

// ── 11 dimension scoring functions ────────────────────────────────────────────

export function scoreRegulatoryExposure(input: DimensionInput): number {
  const { regulatoryFrameworks, jurisdiction } = input;
  const highRiskCount = regulatoryFrameworks.filter((f) => EU_HIGH_RISK_FRAMEWORKS.has(f)).length;
  const jurisdictionMultiplier = jurisdiction === "EU" ? 1.2 : jurisdiction === "UK" ? 1.1 : 1.0;
  return clamp((highRiskCount / 3) * jurisdictionMultiplier);
}

export function scoreProductionImpact(input: DimensionInput): number {
  const env = input.context.environment?.toLowerCase() ?? "";
  if (env === "production" || env === "prod") return 0.9;
  if (env === "staging" || env === "uat") return 0.5;
  if (env === "pre-prod" || env === "preprod") return 0.4;
  return 0.2;
}

export function scoreAIInvolvement(input: DimensionInput): number {
  if (!input.context.aiSystemInvolved) return 0;
  const hasEuAiAct = input.regulatoryFrameworks.includes("EU_AI_ACT");
  return hasEuAiAct ? 1.0 : 0.6;
}

export function scoreCustomerImpact(input: DimensionInput): number {
  const dc = input.context.dataClassification?.toLowerCase() ?? "";
  const env = input.context.environment?.toLowerCase() ?? "";
  const isCustomerFacing = env === "production" || env === "prod";
  const hasSensitiveData =
    dc === "personal" || dc === "sensitive" || dc === "special-category" || dc === "restricted";
  if (isCustomerFacing && hasSensitiveData) return 0.9;
  if (isCustomerFacing) return 0.6;
  if (hasSensitiveData) return 0.5;
  return 0.2;
}

export function scoreDataExposure(input: DimensionInput): number {
  const dc = input.context.dataClassification?.toLowerCase() ?? "";
  if (dc === "special-category") return 1.0;
  if (dc === "sensitive") return 0.9;
  if (dc === "personal") return 0.8;
  if (dc === "restricted" || dc === "confidential") return 0.6;
  if (dc === "internal") return 0.3;
  return 0.1;
}

export function scoreBlastRadius(input: DimensionInput): number {
  const linkedCount = input.context.linkedSystemIds.length;
  if (linkedCount >= 6) return 1.0;
  if (linkedCount >= 4) return 0.8;
  if (linkedCount >= 2) return 0.5;
  if (linkedCount === 1) return 0.3;
  return 0.1;
}

export function scoreSecuritySensitivity(input: DimensionInput): number {
  const hasNewThirdParty = input.context.thirdPartyChanges;
  const openFindings = input.openSecurityFindings;
  let score = 0;
  if (hasNewThirdParty) score += 0.4;
  if (openFindings >= 3) score += 0.5;
  else if (openFindings >= 1) score += 0.3;
  return clamp(score);
}

export function scoreDeploymentCriticality(input: DimensionInput): number {
  const { releaseFrequencyDays } = input;
  // Less frequent deploys = higher criticality per deploy (more changes bundled)
  if (releaseFrequencyDays >= 30) return 0.9;
  if (releaseFrequencyDays >= 14) return 0.7;
  if (releaseFrequencyDays >= 7) return 0.5;
  if (releaseFrequencyDays >= 1) return 0.3;
  return 0.1;
}

export function scoreInfrastructureImpact(input: DimensionInput): number {
  return input.context.infrastructureChange ? 0.8 : 0.1;
}

export function scoreThirdPartyRisk(input: DimensionInput): number {
  return input.context.thirdPartyChanges ? 0.7 : 0.0;
}

export function scoreIncidentHistory(input: DimensionInput): number {
  const incidents = input.context.priorIncidents;
  if (incidents >= 5) return 1.0;
  if (incidents >= 3) return 0.7;
  if (incidents >= 1) return 0.4;
  return 0.0;
}
