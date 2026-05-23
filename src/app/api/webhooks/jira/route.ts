import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { verifyJiraWebhookSignature, buildJiraConnector } from "@/lib/connectors/jira";
import { enrichGovernanceContext } from "@/lib/intelligence/context";
import { scoreGovernanceCase } from "@/lib/scoring/engine";
import { composeAdaptivePipeline } from "@/lib/pipeline/composer";
import { writeGovernancePipelineToJira } from "@/lib/connectors/jira-writeback";
import { GovernanceEventType } from "@prisma/client";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = Buffer.from(await req.arrayBuffer());
  const signatureHeader = req.headers.get("x-hub-signature-256") ?? "";
  const connectorId = req.nextUrl.searchParams.get("connectorId");

  if (!connectorId) {
    return NextResponse.json({ error: "Missing connectorId parameter" }, { status: 400 });
  }

  // Verify HMAC signature
  const connector = await prisma.sourceConnector.findUnique({ where: { id: connectorId } });
  if (!connector?.webhookSecret) {
    return NextResponse.json({ error: "Connector not found or no webhook secret" }, { status: 404 });
  }

  if (
    signatureHeader &&
    !verifyJiraWebhookSignature(rawBody, signatureHeader, connector.webhookSecret)
  ) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody.toString("utf-8")) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const webhookEvent = String(body.webhookEvent ?? "");
  const issue = body.issue as Record<string, unknown> | undefined;
  const issueKey = String(issue?.key ?? "");
  const issueType = (issue?.fields as Record<string, unknown> | undefined)?.issuetype;
  const isEpic =
    typeof issueType === "object" &&
    issueType !== null &&
    (issueType as Record<string, unknown>).name === "Epic";

  // Only process epic created/updated events
  if (!isEpic || !issueKey || !webhookEvent.includes("issue")) {
    return NextResponse.json({ status: "ignored", reason: "not an epic event" });
  }

  // Find the project linked to this connector
  const projectKeys = connector.projectKeys;
  const project = await prisma.project.findFirst({
    where: { key: { in: projectKeys } },
    select: { id: true, key: true },
  });

  if (!project) {
    return NextResponse.json({ status: "ignored", reason: "no matching project" });
  }

  // Snapshot the epic
  const jiraConnector = await buildJiraConnector(connectorId);
  const epicData = await jiraConnector.fetchEpic(issueKey);

  const snapshot = await prisma.epicSnapshot.upsert({
    where: { id: `${connectorId}:${issueKey}` },
    update: {
      title: epicData.title,
      description: epicData.description,
      labels: epicData.labels,
      components: epicData.components,
      customFields: epicData.customFields as unknown as Prisma.InputJsonValue,
      timeline: epicData.timeline ? (epicData.timeline as unknown as Prisma.InputJsonValue) : undefined,
      snapshotAt: new Date(),
    },
    create: {
      id: `${connectorId}:${issueKey}`,
      connectorId,
      sourceKey: issueKey,
      sourceType: "epic",
      title: epicData.title,
      description: epicData.description,
      labels: epicData.labels,
      components: epicData.components,
      customFields: epicData.customFields as unknown as Prisma.InputJsonValue,
      timeline: epicData.timeline ? (epicData.timeline as unknown as Prisma.InputJsonValue) : undefined,
    },
  });

  // Check if a governance case already exists for this epic
  let governanceCase = await prisma.governanceCase.findFirst({
    where: { projectId: project.id, sourceEpicKey: issueKey },
  });

  if (!governanceCase) {
    governanceCase = await prisma.governanceCase.create({
      data: {
        projectId: project.id,
        title: epicData.title,
        description: epicData.description,
        phase: "change-delivery",
        status: "active",
        ownedBy: "governance@nexori.system",
        sourceEpicKey: issueKey,
        sourceConnectorId: connectorId,
      },
    });

    await prisma.governanceEvent.create({
      data: {
        projectId: project.id,
        type: GovernanceEventType.GATE_CREATED,
        resourceType: "governance-case",
        resourceId: governanceCase.id,
        payload: { sourceEpicKey: issueKey, triggeredBy: "jira-webhook", snapshotId: snapshot.id },
      },
    });
  }

  // Run the intelligence pipeline (context → score → compose → write-back)
  const enriched = await enrichGovernanceContext(
    governanceCase.id,
    epicData,
    jiraConnector,
    project.id
  );

  const riskScore = await scoreGovernanceCase(
    governanceCase.id,
    await prisma.governanceContext.findUniqueOrThrow({ where: { caseId: governanceCase.id } }),
    project.id,
    {
      regulatoryFrameworks: epicData.regulatoryDomain ? [epicData.regulatoryDomain] : [],
      jurisdiction: epicData.jurisdiction ?? "GLOBAL",
    }
  );

  const pipeline = await composeAdaptivePipeline(
    governanceCase.id,
    await prisma.governanceRiskScore.findUniqueOrThrow({ where: { caseId: governanceCase.id } }),
    await prisma.governanceContext.findUniqueOrThrow({ where: { caseId: governanceCase.id } }),
    project.id,
    { regulatoryFrameworks: epicData.regulatoryDomain ? [epicData.regulatoryDomain] : [], jurisdiction: epicData.jurisdiction ?? "GLOBAL" }
  );

  // Write governance back to Jira (fire-and-forget)
  writeGovernancePipelineToJira(governanceCase.id, pipeline, jiraConnector, project.id).catch(
    () => void 0
  );

  return NextResponse.json({
    status: "processed",
    caseId: governanceCase.id,
    intensity: riskScore.intensity,
    compositeScore: riskScore.compositeScore,
    totalGateCount: pipeline.totalGateCount,
    reducedFromBaseline: pipeline.reducedFromBaseline,
    contextId: enriched.contextId,
  });
}
