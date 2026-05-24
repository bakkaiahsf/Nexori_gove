import prisma from "@/lib/db";
import { routeAI } from "@/lib/ai/router";
import { retrieveRelevantChunks } from "@/lib/rag/retriever";
import { GovernanceEventType } from "@prisma/client";
import type { SourceConnector, EpicData } from "@/lib/connectors/index";

export interface EnrichedContext {
  contextId: string;
  caseId: string;
  contextSummary: string;
  aiSystemInvolved: boolean;
  thirdPartyChanges: boolean;
  infrastructureChange: boolean;
  dataClassification: string | null;
  environment: string | null;
  priorIncidents: number;
  retrievedPolicyChunkIds: string[];
}

/**
 * Enriches a GovernanceCase with multi-source context intelligence.
 * Sources: Jira epic signals + Confluence page text + prior case history + AI synthesis.
 * Emits GovernanceEvent(CONTEXT_ENRICHED) and writes GovernanceContext record.
 */
export async function enrichGovernanceContext(
  caseId: string,
  epicData: EpicData,
  connector: SourceConnector | null | undefined,
  projectId: string,
  tenantId?: string
): Promise<EnrichedContext> {
  // 1. Fetch Confluence page summaries (best-effort)
  const confluenceSummaries: string[] = [];
  if (connector?.fetchConfluencePage) {
    for (const url of epicData.confluencePageUrls.slice(0, 3)) {
      try {
        const text = await connector.fetchConfluencePage(url);
        if (text.length > 50) confluenceSummaries.push(text.slice(0, 1200));
      } catch {
        // Best-effort
      }
    }
  }

  // 2. Prior incident count for same project
  const priorIncidents = await prisma.riskItem.count({
    where: {
      projectId,
      status: { in: ["OPEN", "MITIGATING"] },
    },
  });

  // 3. Prior cases for same source epic key (for inheritance context)
  const priorCases = epicData.key
    ? await prisma.governanceCase.findMany({
        where: { projectId, sourceEpicKey: epicData.key, id: { not: caseId } },
        select: { id: true, title: true, status: true },
        take: 5,
        orderBy: { createdAt: "desc" },
      })
    : [];

  // 4. RAG: retrieve relevant policy chunks for this epic's domain
  const ragQuery = [
    epicData.title,
    epicData.description?.slice(0, 300),
    epicData.regulatoryDomain,
    epicData.jurisdiction,
  ]
    .filter(Boolean)
    .join(". ");

  let retrievedChunks: Awaited<ReturnType<typeof retrieveRelevantChunks>> = [];
  try {
    retrievedChunks = await retrieveRelevantChunks(ragQuery, tenantId, 5);
  } catch {
    // RAG is best-effort — no policy documents indexed yet is a valid state
  }

  const policyContext = retrievedChunks
    .map((c, i) => `[POLICY-${i + 1}] ${c.text.slice(0, 400)}`)
    .join("\n\n");

  // 5. AI synthesis — build governance context summary
  let contextSummary = "";
  let usageEventId = "";

  const contextPrompt = [
    `Epic: ${epicData.title}`,
    epicData.description ? `Description: ${epicData.description.slice(0, 600)}` : "",
    `Labels: ${epicData.labels.join(", ") || "none"}`,
    `Components: ${epicData.components.join(", ") || "none"}`,
    `Environment: ${epicData.environment ?? "unknown"}`,
    `Data Classification: ${epicData.dataClassification ?? "not specified"}`,
    `AI System Involved: ${epicData.aiSystemInvolved}`,
    `Infrastructure Change: ${epicData.infrastructureChange}`,
    `Third-Party Changes: ${epicData.thirdPartyChanges}`,
    `Regulatory Domain: ${epicData.regulatoryDomain ?? "not specified"}`,
    `Jurisdiction: ${epicData.jurisdiction ?? "not specified"}`,
    priorCases.length > 0
      ? `Prior governance cases for this epic: ${priorCases.map((c) => c.title).join(", ")}`
      : "",
    confluenceSummaries.length > 0
      ? `\nConfluence context:\n${confluenceSummaries.join("\n---\n")}`
      : "",
    policyContext ? `\nRelevant internal policy:\n${policyContext}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const aiResult = await routeAI({
      projectId,
      action: "context-enrichment",
      messages: [
        {
          role: "system",
          content:
            "You are a governance context analyst for a regulated financial organisation. " +
            "Summarise the governance context of this delivery epic in 3–5 sentences. " +
            "Identify: regulatory scope, data sensitivity, AI involvement, third-party risk, and delivery risk level. " +
            "Be specific. Only reference information present in the input. Cite policy IDs if present.",
        },
        { role: "user", content: contextPrompt },
      ],
      maxTokens: 512,
    });
    contextSummary = aiResult.content;
    usageEventId = aiResult.usageEventId;
  } catch {
    contextSummary = `Automated context enrichment for: ${epicData.title}. Manual review required.`;
  }

  // 6. Persist GovernanceContext + emit GovernanceEvent in a transaction
  const contextRecord = await prisma.$transaction(async (tx) => {
    const ctx = await tx.governanceContext.upsert({
      where: { caseId },
      update: {
        epicTitle: epicData.title,
        epicDescription: epicData.description,
        sourceKey: epicData.key,
        sourceType: "epic",
        labels: epicData.labels,
        components: epicData.components,
        environment: epicData.environment,
        dataClassification: epicData.dataClassification,
        aiSystemInvolved: epicData.aiSystemInvolved,
        thirdPartyChanges: epicData.thirdPartyChanges,
        infrastructureChange: epicData.infrastructureChange,
        linkedSystemIds: epicData.components,
        priorIncidents,
        confluenceRefs: epicData.confluencePageUrls,
        contextSummary,
        enrichedAt: new Date(),
      },
      create: {
        caseId,
        epicTitle: epicData.title,
        epicDescription: epicData.description,
        sourceKey: epicData.key,
        sourceType: "epic",
        labels: epicData.labels,
        components: epicData.components,
        environment: epicData.environment,
        dataClassification: epicData.dataClassification,
        aiSystemInvolved: epicData.aiSystemInvolved,
        thirdPartyChanges: epicData.thirdPartyChanges,
        infrastructureChange: epicData.infrastructureChange,
        linkedSystemIds: epicData.components,
        priorIncidents,
        confluenceRefs: epicData.confluencePageUrls,
        contextSummary,
        enrichedAt: new Date(),
      },
    });

    await tx.governanceEvent.create({
      data: {
        projectId,
        type: GovernanceEventType.CONTEXT_ENRICHED,
        resourceType: "governance-context",
        resourceId: ctx.id,
        payload: {
          caseId,
          epicKey: epicData.key,
          aiSystemInvolved: epicData.aiSystemInvolved,
          thirdPartyChanges: epicData.thirdPartyChanges,
          infrastructureChange: epicData.infrastructureChange,
          priorIncidents,
          policyChunksRetrieved: retrievedChunks.length,
          usageEventId,
        },
      },
    });

    return ctx;
  });

  return {
    contextId: contextRecord.id,
    caseId,
    contextSummary,
    aiSystemInvolved: epicData.aiSystemInvolved,
    thirdPartyChanges: epicData.thirdPartyChanges,
    infrastructureChange: epicData.infrastructureChange,
    dataClassification: epicData.dataClassification ?? null,
    environment: epicData.environment ?? null,
    priorIncidents,
    retrievedPolicyChunkIds: retrievedChunks.map((c) => c.id),
  };
}
