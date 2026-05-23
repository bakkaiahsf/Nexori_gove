import { NextRequest, NextResponse } from "next/server";
import { ClassificationRequestSchema } from "@/schemas/ai";
import { scoreGovernanceCase } from "@/lib/scoring/engine";
import { compositeToIntensity } from "@/lib/scoring/engine";
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
} from "@/lib/scoring/dimensions";
import prisma from "@/lib/db";

/**
 * Preview classification — scores an epic and returns what pipeline would be composed,
 * without writing anything to the database. Safe for testing and UI previews.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ClassificationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;

  // Build a synthetic GovernanceContext (no DB write)
  const syntheticContext = {
    id: "preview",
    caseId: "preview",
    epicTitle: data.epicTitle,
    epicDescription: data.epicDescription ?? null,
    sourceKey: data.epicKey,
    sourceType: "epic",
    labels: data.labels ?? [],
    components: data.components ?? [],
    environment: data.environment ?? null,
    dataClassification: data.dataClassification ?? null,
    aiSystemInvolved: data.aiSystemInvolved ?? false,
    thirdPartyChanges: data.thirdPartyChanges ?? false,
    infrastructureChange: data.infrastructureChange ?? false,
    linkedSystemIds: data.components ?? [],
    priorIncidents: 0,
    lastDeployDaysAgo: null,
    confluenceRefs: [],
    contextSummary: null,
    enrichedAt: new Date(),
  };

  const regulatoryFrameworks = data.regulatoryFrameworks ?? [];
  const jurisdiction = data.jurisdiction ?? "GLOBAL";

  const input: DimensionInput = {
    context: syntheticContext,
    regulatoryFrameworks,
    jurisdiction,
    openSecurityFindings: 0,
    releaseFrequencyDays: 14,
  };

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

  const compositeScore = Math.round(
    (Object.keys(WEIGHTS) as Array<keyof typeof WEIGHTS>).reduce(
      (sum, k) => sum + dims[k] * WEIGHTS[k],
      0
    )
  );

  const intensity = compositeToIntensity(compositeScore);

  // Preview: what gates WOULD be included (no DB writes)
  const applicableGates = await prisma.gateDefinition.findMany({
    where: { enabled: true, intensityTriggers: { hasSome: [intensity] } },
    select: {
      slug: true,
      name: true,
      category: true,
      defaultSlaHours: true,
      skipConditions: true,
      approverRoles: true,
    },
    orderBy: { defaultSlaHours: "asc" },
  });

  type SkipCondition = { field: string; op: string; value: unknown };
  const contextMap: Record<string, unknown> = {
    environment: data.environment,
    dataClassification: data.dataClassification,
    aiSystemInvolved: data.aiSystemInvolved ?? false,
    thirdPartyChanges: data.thirdPartyChanges ?? false,
    infrastructureChange: data.infrastructureChange ?? false,
    regulatoryScope: regulatoryFrameworks,
  };

  const gatesWouldInclude: string[] = [];
  const gatesWouldSkip: Array<{ slug: string; skipReason: string }> = [];

  for (const gate of applicableGates) {
    const conditions = (gate.skipConditions ?? []) as SkipCondition[];
    const skipReason = conditions.find((c) => {
      const v = contextMap[c.field];
      if (c.op === "eq") return v === c.value;
      if (c.op === "neq") return v !== c.value;
      if (c.op === "notContains")
        return Array.isArray(v) ? !v.includes(c.value) : !String(v ?? "").includes(String(c.value));
      if (c.op === "notIn") return !(c.value as unknown[]).includes(v);
      return false;
    });

    if (skipReason) {
      gatesWouldSkip.push({
        slug: gate.slug,
        skipReason: `Skip condition: ${skipReason.field} ${skipReason.op} ${JSON.stringify(skipReason.value)}`,
      });
    } else {
      gatesWouldInclude.push(gate.slug);
    }
  }

  return NextResponse.json({
    preview: true,
    epicKey: data.epicKey,
    epicTitle: data.epicTitle,
    compositeScore,
    intensity,
    dimensions: dims,
    regulatoryFrameworks,
    jurisdiction,
    pipeline: {
      wouldInclude: gatesWouldInclude,
      wouldSkip: gatesWouldSkip,
      totalBaseline: applicableGates.length,
      totalActive: gatesWouldInclude.length,
      reducedFromBaseline: gatesWouldSkip.length,
    },
  });
}
