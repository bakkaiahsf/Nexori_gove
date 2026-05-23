import prisma from "@/lib/db";
import { GovernanceEventType } from "@prisma/client";
import type { JiraConnector } from "./jira";
import type { PipelineResult } from "@/lib/pipeline/composer";

const NEXORI_APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://nexori.app";

/**
 * Writes the governance pipeline back to Jira as a linked [GOV] epic + gate stories.
 * Pattern: originating epic → linked [GOV] epic → per-gate stories.
 */
export async function writeGovernancePipelineToJira(
  caseId: string,
  pipeline: PipelineResult,
  connector: JiraConnector,
  projectId: string
): Promise<void> {
  const governanceCase = await prisma.governanceCase.findUniqueOrThrow({
    where: { id: caseId },
    include: {
      riskScore: true,
      context: true,
      governanceGates: {
        where: { skipped: false },
        orderBy: { order: "asc" },
      },
    },
  });

  const riskScore = governanceCase.riskScore;
  const context = governanceCase.context;
  const sourceEpicKey = governanceCase.sourceEpicKey;

  if (!sourceEpicKey) {
    // No source epic to write back to
    return;
  }

  const intensity = riskScore?.intensity ?? "standard";
  const compositeScore = riskScore?.compositeScore ?? 0;
  const nexoriCaseUrl = `${NEXORI_APP_URL}/governance/cases/${caseId}`;

  // 1. Create [GOV] epic in Jira
  const govEpicTitle = `[GOV] ${governanceCase.title}`;
  const govEpicDescription = [
    `NexoriOS Governance Intelligence — ${intensity.toUpperCase()} intensity`,
    `Risk Score: ${compositeScore}/100`,
    `Gates Required: ${pipeline.totalGateCount} (${pipeline.reducedFromBaseline} saved vs baseline)`,
    `Gates Skipped: ${pipeline.gatesSkipped.length} | Inherited: ${pipeline.inheritedApprovals.length}`,
    ``,
    `View in NexoriOS: ${nexoriCaseUrl}`,
    `Regulatory Frameworks: ${context?.labels?.join(", ") || "see NexoriOS"}`,
  ].join("\n");

  const govEpicKey = await connector.createEpic({
    title: govEpicTitle,
    description: govEpicDescription,
    labels: [
      `nexori-${intensity}`,
      "nexori-governance",
      ...buildFrameworkLabels(riskScore?.retrievedPolicyIds ?? []),
    ],
  });

  // 2. Link [GOV] epic to originating epic
  try {
    await connector.linkIssues(govEpicKey, sourceEpicKey, "is governed by");
  } catch {
    // Link type may not exist in all Jira configs — non-fatal
    await connector.addComment(
      sourceEpicKey,
      `Governance epic: ${govEpicKey} (NexoriOS link: ${nexoriCaseUrl})`
    );
  }

  // 3. Create Jira stories for each active (non-inherited, non-skipped) gate
  for (const gate of governanceCase.governanceGates) {
    if (gate.inheritedFrom || gate.skipped) continue;

    const storyTitle = `[GATE] ${gate.name}`;
    const storyDescription = [
      gate.description ?? "",
      ``,
      `Governance Gate ${gate.order}/${pipeline.totalGateCount}`,
      `Status: ${gate.status}`,
      `Approve in NexoriOS: ${nexoriCaseUrl}`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const storyKey = await connector.createStory({
        epicKey: govEpicKey,
        title: storyTitle,
        description: storyDescription,
        labels: ["nexori-gate-pending"],
      });

      // Store Jira story key on the gate record
      await prisma.governanceGate.update({
        where: { id: gate.id },
        data: { sourceStoryKey: storyKey },
      });
    } catch {
      // Non-fatal — gate record remains in NexoriOS
    }
  }

  // 4. Add structured governance comment to originating epic
  const savedText =
    pipeline.reducedFromBaseline > 0
      ? ` — saved ${pipeline.reducedFromBaseline} gate(s) vs standard baseline`
      : "";

  await connector.addComment(
    sourceEpicKey,
    [
      `⚙ NexoriOS Governance Intelligence Applied`,
      `Risk Score: ${compositeScore}/100 · Intensity: ${intensity.toUpperCase()}`,
      `Gates Required: ${pipeline.totalGateCount}${savedText}`,
      `Governance Epic: ${govEpicKey}`,
      `NexoriOS: ${nexoriCaseUrl}`,
    ].join("\n")
  );

  // 5. Persist [GOV] epic key + emit event
  await prisma.$transaction(async (tx) => {
    await tx.governanceCase.update({
      where: { id: caseId },
      data: { sourceGovEpicKey: govEpicKey },
    });

    await tx.governanceEvent.create({
      data: {
        projectId,
        type: GovernanceEventType.JIRA_WRITEBACK_COMPLETE,
        resourceType: "governance-case",
        resourceId: caseId,
        payload: {
          sourceEpicKey,
          govEpicKey,
          storiesCreated: governanceCase.governanceGates.filter(
            (g) => !g.inheritedFrom && !g.skipped
          ).length,
          totalGateCount: pipeline.totalGateCount,
          reducedFromBaseline: pipeline.reducedFromBaseline,
        },
      },
    });
  });
}

function buildFrameworkLabels(policyIds: string[]): string[] {
  // Minimal label enrichment — refined once RAG returns document metadata
  return policyIds.length > 0 ? ["nexori-rag-cited"] : [];
}

/**
 * Called after a gate is approved — updates the Jira story to Done.
 */
export async function syncGateApprovalToJira(
  gateId: string,
  connector: JiraConnector,
  approvedBy: string
): Promise<void> {
  const gate = await prisma.governanceGate.findUnique({
    where: { id: gateId },
    select: { sourceStoryKey: true, name: true, approvedAt: true },
  });

  if (!gate?.sourceStoryKey) return;

  try {
    await connector.updateIssueStatus(gate.sourceStoryKey, "Done");
    await connector.addComment(
      gate.sourceStoryKey,
      `Approved by ${approvedBy} in NexoriOS · ${new Date().toISOString()}`
    );
  } catch {
    // Best-effort — Jira sync failure must not block governance
  }
}
