import { NextRequest, NextResponse } from "next/server";
import { TriggerAction, Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import {
  verifyGitHubWebhookSignature,
  buildGitHubConnector,
  mapPRToEpicData,
} from "@/lib/connectors/github";
import { evaluateTriggerRules } from "@/lib/governance/trigger";
import { orchestrateGovernanceCase } from "@/lib/governance/orchestrate";

// GitHub sends PR event objects with this shape (trimmed to what we need)
interface GitHubPRPayload {
  number: number;
  title: string;
  body?: string | null;
  head: { ref: string; sha: string };
  base: { ref: string };
  user: { login: string };
  labels: Array<{ name: string }>;
  state: string;
  html_url: string;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  merged_at?: string | null;
  closed_at?: string | null;
}

interface GitHubWebhookBody {
  action?: string;
  pull_request?: GitHubPRPayload;
  repository?: { full_name: string; owner: { login: string }; name: string };
  installation?: { id: number };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = Buffer.from(await req.arrayBuffer());
  const signatureHeader = req.headers.get("x-hub-signature-256") ?? "";
  const githubEvent = req.headers.get("x-github-event") ?? "";
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

  // Always verify HMAC signature for GitHub
  if (!verifyGitHubWebhookSignature(rawBody, signatureHeader, connector.webhookSecret)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let body: GitHubWebhookBody;
  try {
    body = JSON.parse(rawBody.toString("utf-8")) as GitHubWebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const pr = body.pull_request;
  const action = body.action;
  const repo = body.repository?.full_name ?? "";
  const owner = body.repository?.owner?.login ?? "";
  const repoName = body.repository?.name ?? "";

  // Only process pull_request events for now
  if (githubEvent !== "pull_request" || !pr || !action) {
    return NextResponse.json({ status: "ignored", reason: "not a pull_request event" });
  }

  // Map action to canonical event type
  const eventType = `pr.${action}`; // pr.opened, pr.synchronize, pr.closed, pr.merged, etc.
  const prKey = `${repo}#${pr.number}`;

  // Find the project linked to this connector
  const project = await prisma.project.findFirst({
    where: { key: { in: connector.projectKeys } },
    select: { id: true, key: true },
  });

  if (!project) {
    return NextResponse.json({ status: "ignored", reason: "no matching project" });
  }

  // Persist or upsert the PullRequest record
  const state = pr.merged_at ? "merged" : pr.state === "closed" ? "closed" : "open";

  const prRecord = await prisma.pullRequest.upsert({
    where: {
      // unique on connectorId + prNumber via @@index — use findFirst then create/update
      id: `${connectorId}:${repo}:${pr.number}`,
    },
    update: {
      title: pr.title,
      state,
      filesChanged: pr.changed_files ?? 0,
      linesAdded: pr.additions ?? 0,
      linesRemoved: pr.deletions ?? 0,
      labels: pr.labels.map((l) => l.name),
      mergedAt: pr.merged_at ? new Date(pr.merged_at) : undefined,
      closedAt: pr.closed_at ? new Date(pr.closed_at) : undefined,
    },
    create: {
      id: `${connectorId}:${repo}:${pr.number}`,
      connectorId,
      prNumber: pr.number,
      repo,
      title: pr.title,
      author: pr.user.login,
      targetBranch: pr.base.ref,
      sourceBranch: pr.head.ref,
      filesChanged: pr.changed_files ?? 0,
      linesAdded: pr.additions ?? 0,
      linesRemoved: pr.deletions ?? 0,
      labels: pr.labels.map((l) => l.name),
      state,
      externalUrl: pr.html_url,
    },
  });

  // Evaluate trigger rules
  const triggerResult = await evaluateTriggerRules({
    sourceType: "github",
    eventType,
    eventKey: prKey,
    payload: {
      prNumber: pr.number,
      repo,
      action,
      targetBranch: pr.base.ref,
      sourceBranch: pr.head.ref,
      author: pr.user.login,
      labels: pr.labels.map((l) => l.name),
      filesChanged: pr.changed_files ?? 0,
      title: pr.title,
      state,
    } as Record<string, unknown>,
    connectorId,
    projectId: project.id,
  });

  if (!triggerResult.matched || triggerResult.action === TriggerAction.SKIP) {
    return NextResponse.json({
      status: "skipped",
      reason: "no trigger rule matched",
      prKey,
      evaluationId: triggerResult.evaluationId,
    });
  }

  // Fetch PR files list for enrichment
  const ghConnector = buildGitHubConnector(
    String((connector.credentials as Record<string, unknown>).token ?? ""),
    owner,
    repoName
  );

  const epicData = await ghConnector.fetchEpic(prKey);

  // Run governance orchestration pipeline
  const result = await orchestrateGovernanceCase(
    {
      projectId: project.id,
      epicData,
      sourceKey: prKey,
      sourceConnectorId: connectorId,
      phase: "change-delivery",
      regulatoryFrameworks: epicData.regulatoryDomain ? [epicData.regulatoryDomain] : [],
      jurisdiction: epicData.jurisdiction ?? "GLOBAL",
      snapshotOverrides: { sourceType: "pull-request" },
    },
    ghConnector
  );

  // Link the PullRequest to the GovernanceCase
  await prisma.pullRequest.update({
    where: { id: prRecord.id },
    data: {
      caseId: result.caseId,
      governanceStatus: "active",
    },
  });

  // Update TriggerEvaluation with case ID
  await prisma.triggerEvaluation.update({
    where: { id: triggerResult.evaluationId },
    data: { caseId: result.caseId },
  });

  return NextResponse.json({
    status: "processed",
    prKey,
    caseId: result.caseId,
    created: result.created,
    intensity: result.intensity,
    compositeScore: result.compositeScore,
    totalGateCount: result.totalGateCount,
    evaluationId: triggerResult.evaluationId,
    triggerRule: triggerResult.ruleName,
  });
}
