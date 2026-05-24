import { NextRequest, NextResponse } from "next/server";
import { TriggerAction } from "@prisma/client";
import prisma from "@/lib/db";
import { verifyGitLabWebhookToken, buildGitLabConnector } from "@/lib/connectors/gitlab";
import { evaluateTriggerRules } from "@/lib/governance/trigger";
import { orchestrateGovernanceCase } from "@/lib/governance/orchestrate";

interface GitLabMREventPayload {
  object_kind: string;
  event_type?: string;
  user?: { username: string };
  object_attributes?: {
    iid: number;
    title: string;
    description?: string | null;
    source_branch: string;
    target_branch: string;
    state: string;
    action?: string;
    url?: string;
    labels?: Array<{ title: string }>;
    merge_status?: string;
    merged_at?: string | null;
  };
  labels?: Array<{ title: string }>;
  project?: {
    id: number;
    name: string;
    path_with_namespace: string;
    web_url: string;
    default_branch: string;
  };
  changes?: {
    labels?: { previous: Array<{ title: string }>; current: Array<{ title: string }> };
  };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = Buffer.from(await req.arrayBuffer());
  const tokenHeader = req.headers.get("x-gitlab-token") ?? "";
  const gitlabEvent = req.headers.get("x-gitlab-event") ?? "";
  const connectorId = req.nextUrl.searchParams.get("connectorId");

  if (!connectorId) {
    return NextResponse.json({ error: "Missing connectorId parameter" }, { status: 400 });
  }

  const connector = await prisma.sourceConnector.findUnique({ where: { id: connectorId } });
  if (!connector?.webhookSecret) {
    return NextResponse.json({ error: "Connector not found or no webhook secret" }, { status: 404 });
  }

  if (!verifyGitLabWebhookToken(tokenHeader, connector.webhookSecret)) {
    return NextResponse.json({ error: "Invalid webhook token" }, { status: 401 });
  }

  let body: GitLabMREventPayload;
  try {
    body = JSON.parse(rawBody.toString("utf-8")) as GitLabMREventPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Only handle Merge Request events
  if (body.object_kind !== "merge_request" && !gitlabEvent.toLowerCase().includes("merge request")) {
    return NextResponse.json({ status: "ignored", reason: "not a merge request event" });
  }

  const mr = body.object_attributes;
  if (!mr) {
    return NextResponse.json({ status: "ignored", reason: "missing object_attributes" });
  }

  const projectPath = body.project?.path_with_namespace ?? "";
  const mrKey = `${projectPath}!${mr.iid}`;
  const mrAction = mr.action ?? "unknown";
  const eventType = `mr.${mrAction}`; // mr.open, mr.merge, mr.close, mr.update, mr.reopen
  const labels = (body.labels ?? []).map((l) => l.title);
  const state = mr.merged_at ? "merged" : mr.state;

  const project = await prisma.project.findFirst({
    where: { key: { in: connector.projectKeys } },
    select: { id: true, key: true },
  });

  if (!project) {
    return NextResponse.json({ status: "ignored", reason: "no matching project" });
  }

  // Persist/upsert PullRequest record (reusing the model for MRs too)
  const prRecord = await prisma.pullRequest.upsert({
    where: { id: `${connectorId}:${projectPath}:${mr.iid}` },
    update: {
      title: mr.title,
      state,
      labels,
      mergedAt: mr.merged_at ? new Date(mr.merged_at) : undefined,
    },
    create: {
      id: `${connectorId}:${projectPath}:${mr.iid}`,
      connectorId,
      prNumber: mr.iid,
      repo: projectPath,
      title: mr.title,
      author: body.user?.username ?? "unknown",
      targetBranch: mr.target_branch,
      sourceBranch: mr.source_branch,
      filesChanged: 0,
      labels,
      state,
      externalUrl: mr.url,
    },
  });

  // Evaluate trigger rules
  const triggerResult = await evaluateTriggerRules({
    sourceType: "gitlab",
    eventType,
    eventKey: mrKey,
    payload: {
      mrIid: mr.iid,
      projectPath,
      action: mrAction,
      targetBranch: mr.target_branch,
      sourceBranch: mr.source_branch,
      author: body.user?.username,
      labels,
      title: mr.title,
      state,
    } as Record<string, unknown>,
    connectorId,
    projectId: project.id,
  });

  if (!triggerResult.matched || triggerResult.action === TriggerAction.SKIP) {
    return NextResponse.json({
      status: "skipped",
      reason: "no trigger rule matched",
      mrKey,
      evaluationId: triggerResult.evaluationId,
    });
  }

  // Build GitLab connector and fetch full MR data for enrichment
  const credentials = connector.credentials as Record<string, unknown>;
  const glConnector = buildGitLabConnector({
    token: String(credentials.token ?? credentials.apiToken ?? ""),
    baseUrl: connector.baseUrl,
    projectId: projectPath || String(body.project?.id ?? ""),
  });

  const epicData = await glConnector.fetchEpic(mrKey);

  const result = await orchestrateGovernanceCase(
    {
      projectId: project.id,
      epicData,
      sourceKey: mrKey,
      sourceConnectorId: connectorId,
      phase: "change-delivery",
      regulatoryFrameworks: epicData.regulatoryDomain ? [epicData.regulatoryDomain] : [],
      jurisdiction: epicData.jurisdiction ?? "GLOBAL",
      snapshotOverrides: { sourceType: "merge-request" },
    },
    glConnector
  );

  await prisma.pullRequest.update({
    where: { id: prRecord.id },
    data: { caseId: result.caseId, governanceStatus: "active" },
  });

  await prisma.triggerEvaluation.update({
    where: { id: triggerResult.evaluationId },
    data: { caseId: result.caseId },
  });

  return NextResponse.json({
    status: "processed",
    mrKey,
    caseId: result.caseId,
    created: result.created,
    intensity: result.intensity,
    compositeScore: result.compositeScore,
    totalGateCount: result.totalGateCount,
    evaluationId: triggerResult.evaluationId,
    triggerRule: triggerResult.ruleName,
  });
}
