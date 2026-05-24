import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyJiraWebhookSignature, buildJiraConnector } from "@/lib/connectors/jira";
import { writeGovernancePipelineToJira } from "@/lib/connectors/jira-writeback";
import { evaluateTriggerRules } from "@/lib/governance/trigger";
import { orchestrateGovernanceCase } from "@/lib/governance/orchestrate";
import { TriggerAction } from "@prisma/client";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = Buffer.from(await req.arrayBuffer());
  const signatureHeader = req.headers.get("x-hub-signature-256") ?? "";
  const connectorId = req.nextUrl.searchParams.get("connectorId");

  if (!connectorId) {
    return NextResponse.json({ error: "Missing connectorId parameter" }, { status: 400 });
  }

  const connector = await prisma.sourceConnector.findUnique({ where: { id: connectorId } });
  if (!connector?.webhookSecret) {
    return NextResponse.json(
      { error: "Connector not found or no webhook secret" },
      { status: 404 }
    );
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
  const issueFields = issue?.fields as Record<string, unknown> | undefined;
  const issueType = issueFields?.issuetype as Record<string, unknown> | undefined;
  const issueTypeName = String(issueType?.name ?? "").toLowerCase();
  const labels = Array.isArray(issueFields?.labels) ? (issueFields.labels as string[]) : [];
  const components = Array.isArray(issueFields?.components)
    ? (issueFields.components as Array<{ name?: string }>).map((c) => c.name ?? "")
    : [];

  if (!issueKey || !webhookEvent.includes("issue")) {
    return NextResponse.json({ status: "ignored", reason: "not an issue event" });
  }

  // Map to canonical Jira event type
  const eventType = webhookEvent.includes("created")
    ? "issue.created"
    : webhookEvent.includes("updated")
      ? "issue.updated"
      : webhookEvent.replace("jira:", "");

  // Find the project linked to this connector
  const project = await prisma.project.findFirst({
    where: { key: { in: connector.projectKeys } },
    select: { id: true, key: true },
  });

  if (!project) {
    return NextResponse.json({ status: "ignored", reason: "no matching project" });
  }

  // Build evaluation payload for trigger rules
  const evaluationPayload = {
    issueKey,
    issueType: issueTypeName,
    webhookEvent,
    labels,
    components,
    environment: issueFields?.environment ?? null,
    summary: issueFields?.summary ?? null,
  };

  const triggerResult = await evaluateTriggerRules({
    sourceType: "jira",
    eventType,
    eventKey: issueKey,
    payload: evaluationPayload as Record<string, unknown>,
    connectorId,
    projectId: project.id,
  });

  // If no trigger rules are configured, fall back to old behaviour (process epics only)
  const hasRules = await prisma.governanceTriggerRule.count({
    where: { projectId: project.id, source: "jira", enabled: true },
  });

  if (hasRules > 0 && (!triggerResult.matched || triggerResult.action === TriggerAction.SKIP)) {
    return NextResponse.json({
      status: "skipped",
      reason: "no trigger rule matched",
      evaluationId: triggerResult.evaluationId,
    });
  }

  // Legacy fallback: only process epics when no rules configured
  if (hasRules === 0) {
    const isEpic = issueTypeName === "epic";
    if (!isEpic) {
      return NextResponse.json({ status: "ignored", reason: "not an epic (legacy mode)" });
    }
  }

  // Run the governance orchestration pipeline
  const jiraConnector = await buildJiraConnector(connectorId);
  const epicData = await jiraConnector.fetchEpic(issueKey);

  const result = await orchestrateGovernanceCase(
    {
      projectId: project.id,
      epicData,
      sourceKey: issueKey,
      sourceConnectorId: connectorId,
      phase: "change-delivery",
      regulatoryFrameworks: epicData.regulatoryDomain ? [epicData.regulatoryDomain] : [],
      jurisdiction: epicData.jurisdiction ?? "GLOBAL",
      snapshotOverrides: { sourceType: issueTypeName === "epic" ? "epic" : "issue" },
    },
    jiraConnector
  );

  // Update the TriggerEvaluation with the resulting case ID
  if (triggerResult.evaluationId) {
    await prisma.triggerEvaluation.update({
      where: { id: triggerResult.evaluationId },
      data: { caseId: result.caseId },
    });
  }

  // Write governance back to Jira (fire-and-forget)
  const pipeline = await prisma.adaptivePipeline.findUnique({ where: { caseId: result.caseId } });
  if (pipeline) {
    const pipelineResult = {
      pipelineId: pipeline.id,
      caseId: pipeline.caseId,
      totalGateCount: pipeline.totalGateCount,
      reducedFromBaseline: pipeline.reducedFromBaseline,
      gatesIncluded: pipeline.gatesIncluded as Array<{
        slug: string;
        gateId: string;
        order: number;
        reason: string;
      }>,
      gatesSkipped: pipeline.gatesSkipped as Array<{ slug: string; skipReason: string }>,
      inheritedApprovals: (pipeline.inheritedApprovals ?? []) as Array<{
        slug: string;
        fromCaseId: string;
        rationale: string;
      }>,
    };
    writeGovernancePipelineToJira(result.caseId, pipelineResult, jiraConnector, project.id).catch(
      () => void 0
    );
  }

  return NextResponse.json({
    status: "processed",
    caseId: result.caseId,
    created: result.created,
    intensity: result.intensity,
    compositeScore: result.compositeScore,
    totalGateCount: result.totalGateCount,
    reducedFromBaseline: result.reducedFromBaseline,
    evaluationId: triggerResult.evaluationId,
    triggerRule: triggerResult.ruleName,
  });
}
