import { Prisma, GovernanceEventType } from "@prisma/client";
import prisma from "@/lib/db";
import { enrichGovernanceContext } from "@/lib/intelligence/context";
import { scoreGovernanceCase } from "@/lib/scoring/engine";
import { composeAdaptivePipeline } from "@/lib/pipeline/composer";
import type { EpicData, SourceConnector } from "@/lib/connectors/index";

export interface OrchestrateInput {
  projectId: string;
  epicData: EpicData;
  sourceKey: string;
  sourceConnectorId?: string;
  phase?: string;
  regulatoryFrameworks?: string[];
  jurisdiction?: string;
  /** Optional snapshot fields for the EpicSnapshot upsert */
  snapshotOverrides?: {
    sourceType?: string;
  };
}

export interface OrchestrateResult {
  caseId: string;
  contextId: string;
  intensity: string;
  compositeScore: number;
  totalGateCount: number;
  reducedFromBaseline: number;
  created: boolean;
}

/**
 * Shared governance orchestration pipeline called by all source connectors.
 * Flow: upsert EpicSnapshot → find/create GovernanceCase → enrich context →
 * score risk → compose adaptive pipeline.
 * Write-back to source tool (Jira/GitHub/GitLab) is the caller's responsibility.
 */
export async function orchestrateGovernanceCase(
  input: OrchestrateInput,
  connector?: SourceConnector
): Promise<OrchestrateResult> {
  const {
    projectId,
    epicData,
    sourceKey,
    sourceConnectorId,
    phase = "change-delivery",
    regulatoryFrameworks = [],
    jurisdiction = "GLOBAL",
    snapshotOverrides,
  } = input;

  // Upsert an immutable snapshot of the source event
  if (sourceConnectorId) {
    await prisma.epicSnapshot.upsert({
      where: { id: `${sourceConnectorId}:${sourceKey}` },
      update: {
        title: epicData.title,
        description: epicData.description,
        labels: epicData.labels,
        components: epicData.components,
        customFields: epicData.customFields as unknown as Prisma.InputJsonValue,
        timeline: epicData.timeline
          ? (epicData.timeline as unknown as Prisma.InputJsonValue)
          : undefined,
        snapshotAt: new Date(),
      },
      create: {
        id: `${sourceConnectorId}:${sourceKey}`,
        connectorId: sourceConnectorId,
        sourceKey,
        sourceType: snapshotOverrides?.sourceType ?? "epic",
        title: epicData.title,
        description: epicData.description,
        labels: epicData.labels,
        components: epicData.components,
        customFields: epicData.customFields as unknown as Prisma.InputJsonValue,
        timeline: epicData.timeline
          ? (epicData.timeline as unknown as Prisma.InputJsonValue)
          : undefined,
      },
    });
  }

  // Find or create the GovernanceCase
  let governanceCase = await prisma.governanceCase.findFirst({
    where: { projectId, sourceEpicKey: sourceKey },
  });

  const created = !governanceCase;

  if (!governanceCase) {
    governanceCase = await prisma.governanceCase.create({
      data: {
        projectId,
        title: epicData.title,
        description: epicData.description,
        phase,
        status: "active",
        ownedBy: "governance@nexori.system",
        sourceEpicKey: sourceKey,
        sourceConnectorId,
      },
    });

    await prisma.governanceEvent.create({
      data: {
        projectId,
        type: GovernanceEventType.GATE_CREATED,
        resourceType: "governance-case",
        resourceId: governanceCase.id,
        payload: {
          sourceEpicKey: sourceKey,
          triggeredBy: sourceConnectorId ? "connector-webhook" : "manual",
        } as unknown as Prisma.InputJsonValue,
      },
    });
  }

  // Intelligence pipeline: enrich → score → compose
  const enriched = await enrichGovernanceContext(
    governanceCase.id,
    epicData,
    connector ?? null,
    projectId
  );

  const riskScore = await scoreGovernanceCase(
    governanceCase.id,
    await prisma.governanceContext.findUniqueOrThrow({ where: { caseId: governanceCase.id } }),
    projectId,
    { regulatoryFrameworks, jurisdiction }
  );

  const pipeline = await composeAdaptivePipeline(
    governanceCase.id,
    await prisma.governanceRiskScore.findUniqueOrThrow({ where: { caseId: governanceCase.id } }),
    await prisma.governanceContext.findUniqueOrThrow({ where: { caseId: governanceCase.id } }),
    projectId,
    { regulatoryFrameworks, jurisdiction, phase }
  );

  return {
    caseId: governanceCase.id,
    contextId: enriched.contextId,
    intensity: riskScore.intensity,
    compositeScore: riskScore.compositeScore,
    totalGateCount: pipeline.totalGateCount,
    reducedFromBaseline: pipeline.reducedFromBaseline,
    created,
  };
}
