import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { GitHubConnector } from "@/lib/connectors/github";
import { GitLabConnector } from "@/lib/connectors/gitlab";
import { JiraConnector } from "@/lib/connectors/jira";
import { orchestrateGovernanceCase } from "@/lib/governance/orchestrate";
import { writeGovernancePipelineToJira } from "@/lib/connectors/jira-writeback";
import { writeGovernancePipelineToGitHub } from "@/lib/connectors/github-writeback";
import { writeGovernancePipelineToGitLab } from "@/lib/connectors/gitlab-writeback";
import { generateGuardrailYaml, guardrailFilePath, hashGuardrailYaml } from "@/lib/guardrails/generator";
import { GovernanceEventType } from "@prisma/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SyncRequestSchema = z.object({
  projectId: z.string().cuid(),
  connectorId: z.string().cuid(),
  boardId: z.string().min(1),           // "owner/repo" for GitHub, "namespace/project" for GitLab
  jiraConnectorId: z.string().cuid().optional(),
  jiraBoardId: z.string().optional(),   // Jira board ID for creating tickets
  pushGuardrails: z.boolean().default(false),
});

type SyncItemResult = {
  key: string;
  caseId?: string;
  created?: boolean;
  jiraGovEpicKey?: string;
  githubIssueUrl?: string;
  gitlabIssueUrl?: string;
  error?: string;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: z.infer<typeof SyncRequestSchema>;
  try {
    body = SyncRequestSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: "Invalid request", detail: String(err) }, { status: 400 });
  }

  const { projectId, connectorId, boardId, jiraConnectorId, pushGuardrails } = body;

  // Load source connector
  const connRecord = await prisma.sourceConnector.findUnique({
    where: { id: connectorId },
    select: { id: true, type: true, baseUrl: true, credentials: true, enabled: true },
  });
  if (!connRecord || !connRecord.enabled) {
    return NextResponse.json({ error: "Connector not found or disabled" }, { status: 404 });
  }

  // Load project
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      key: true,
      name: true,
      regulatoryMappings: { select: { framework: true }, distinct: ["framework"] },
    },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const creds = connRecord.credentials as Record<string, string>;
  const token = creds.token ?? creds.apiToken ?? "";

  // Fetch open items from the source tool
  type OpenItem = { key: string; title: string; prOrMrNumber: number; url: string };
  const openItems: OpenItem[] = [];

  let ghConnector: GitHubConnector | null = null;
  let glConnector: GitLabConnector | null = null;

  if (connRecord.type === "github") {
    const [owner, repo] = boardId.split("/");
    if (!owner || !repo) {
      return NextResponse.json({ error: "Invalid boardId for GitHub — expected owner/repo" }, { status: 400 });
    }
    ghConnector = new GitHubConnector({ token, owner, repo });
    const prs = await ghConnector.listOpenPRs();
    for (const pr of prs) {
      openItems.push({ key: `${boardId}#${pr.number}`, title: pr.title, prOrMrNumber: pr.number, url: pr.url });
    }
  } else if (connRecord.type === "gitlab") {
    glConnector = new GitLabConnector({ token, baseUrl: connRecord.baseUrl, projectId: boardId });
    const mrs = await glConnector.listOpenMRs();
    for (const mr of mrs) {
      openItems.push({ key: `${boardId}!${mr.iid}`, title: mr.title, prOrMrNumber: mr.iid, url: mr.url });
    }
  } else {
    return NextResponse.json({ error: "Sync only supports github or gitlab connectors" }, { status: 400 });
  }

  // Load Jira connector if specified
  let jiraConn: JiraConnector | null = null;
  let jiraConnRecord: { baseUrl: string; credentials: unknown; projectKeys: string[]; fieldMapping: unknown } | null = null;
  if (jiraConnectorId) {
    jiraConnRecord = await prisma.sourceConnector.findUnique({
      where: { id: jiraConnectorId },
      select: { baseUrl: true, credentials: true, projectKeys: true, fieldMapping: true },
    });
    if (jiraConnRecord) {
      const jiraCreds = jiraConnRecord.credentials as Record<string, string>;
      jiraConn = new JiraConnector(
        jiraConnRecord.baseUrl,
        { email: jiraCreds.email ?? "", apiToken: jiraCreds.apiToken ?? "" },
        (jiraConnRecord.fieldMapping as Record<string, string> | undefined) ?? {},
        jiraConnRecord.projectKeys[0]
      );
    }
  }

  // Process each open PR/MR
  const results: SyncItemResult[] = [];

  for (const item of openItems) {
    try {
      // Fetch full epic data (PR/MR details + file list)
      const epicData = connRecord.type === "github"
        ? await ghConnector!.fetchEpic(item.key)
        : await glConnector!.fetchEpic(item.key);

      // Run governance orchestration
      const result = await orchestrateGovernanceCase({
        projectId,
        epicData,
        sourceKey: item.key,
        sourceConnectorId: connectorId,
        phase: "change-delivery",
        snapshotOverrides: { sourceType: connRecord.type === "github" ? "pull-request" : "merge-request" },
      });

      const itemResult: SyncItemResult = {
        key: item.key,
        caseId: result.caseId,
        created: result.created,
      };

      // Only writeback on newly created cases
      if (result.created) {
        // Fetch gates for writeback
        const govCase = await prisma.governanceCase.findUniqueOrThrow({
          where: { id: result.caseId },
          include: { governanceGates: { orderBy: { order: "asc" } }, riskScore: true },
        });

        const gates = govCase.governanceGates.map((g) => ({
          name: g.name,
          status: g.status as string,
          skipped: g.skipped,
          order: g.order,
        }));

        // Build pipeline result for Jira writeback
        const adaptivePipeline = await prisma.adaptivePipeline.findUnique({
          where: { caseId: result.caseId },
        });

        const pipelineResult = {
          pipelineId: adaptivePipeline?.id ?? "",
          caseId: result.caseId,
          totalGateCount: result.totalGateCount,
          reducedFromBaseline: result.reducedFromBaseline,
          gatesIncluded: (adaptivePipeline?.gatesIncluded as Array<{ slug: string; gateId: string; order: number; reason: string }>) ?? [],
          gatesSkipped: (adaptivePipeline?.gatesSkipped as Array<{ slug: string; skipReason: string }>) ?? [],
          inheritedApprovals: (adaptivePipeline?.inheritedApprovals as Array<{ slug: string; fromCaseId: string; rationale: string }>) ?? [],
        };

        // GitHub tracking issue
        if (connRecord.type === "github" && ghConnector) {
          try {
            const url = await writeGovernancePipelineToGitHub({
              token,
              owner: boardId.split("/")[0],
              repo: boardId.split("/")[1],
              prNumber: item.prOrMrNumber,
              caseId: result.caseId,
              caseTitle: item.title,
              gates,
              riskIntensity: result.intensity,
              compositeScore: result.compositeScore,
            });
            itemResult.githubIssueUrl = url;
          } catch {
            // Non-fatal — governance case exists in NexoriOS regardless
          }
        }

        // GitLab tracking issue
        if (connRecord.type === "gitlab" && glConnector) {
          try {
            const url = await writeGovernancePipelineToGitLab({
              token,
              baseUrl: connRecord.baseUrl,
              projectId: boardId,
              mrIid: item.prOrMrNumber,
              caseId: result.caseId,
              caseTitle: item.title,
              gates,
              riskIntensity: result.intensity,
              compositeScore: result.compositeScore,
            });
            itemResult.gitlabIssueUrl = url;
          } catch {
            // Non-fatal
          }
        }

        // Jira writeback
        if (jiraConn) {
          try {
            await writeGovernancePipelineToJira(result.caseId, pipelineResult, jiraConn, projectId);
            const updated = await prisma.governanceCase.findUnique({
              where: { id: result.caseId },
              select: { sourceGovEpicKey: true },
            });
            itemResult.jiraGovEpicKey = updated?.sourceGovEpicKey ?? undefined;
          } catch {
            // Non-fatal
          }
        }

        // Save project board link if not already present
        try {
          await prisma.projectBoard.upsert({
            where: { projectId_connectorId_boardId: { projectId, connectorId, boardId } },
            update: { enabled: true },
            create: {
              id: `${projectId}:${connectorId}:${boardId}`,
              projectId,
              connectorId,
              boardId,
              boardName: boardId,
              boardType: connRecord.type === "github" ? "github-repo" : "gitlab-project",
            },
          });
        } catch {
          // Non-fatal
        }
      }

      results.push(itemResult);
    } catch (err) {
      results.push({ key: item.key, error: String(err) });
    }
  }

  // Push governance guidelines (guardrails-as-code) if requested
  const guardrailsPushed: string[] = [];
  const projectFrameworks = [...new Set(project.regulatoryMappings.map((m) => String(m.framework)))];

  if (pushGuardrails && projectFrameworks.length > 0) {
    const connector = connRecord.type === "github" ? ghConnector : glConnector;
    if (connector?.createPullRequest) {
      for (const framework of projectFrameworks) {
        try {
          const yaml = generateGuardrailYaml({
            projectKey: project.key,
            projectName: project.name,
            framework,
          });
          const filePath = guardrailFilePath(String(framework));
          const hash = hashGuardrailYaml(yaml);

          // Check if we already pushed this hash
          const existing = await prisma.guardrailPush.findFirst({
            where: { projectId, framework: String(framework), rulesHash: hash, status: { in: ["PENDING", "MERGED"] } },
          });
          if (existing) continue;

          const prResult = await connector.createPullRequest({
            title: `[GOV] Add ${framework} governance rules`,
            body: `NexoriOS is adding governance rules for **${framework}** framework.\n\nThis PR was generated automatically based on the regulatory frameworks configured for project **${project.key}**.`,
            filePath,
            fileContent: yaml,
            baseBranch: connRecord.type === "github"
              ? (await (ghConnector as GitHubConnector).listRepositories().then((r) => r.find((repo) => repo.fullName === boardId)?.defaultBranch ?? "main").catch(() => "main"))
              : "main",
          });

          await prisma.guardrailPush.create({
            data: {
              projectId,
              connectorId,
              framework: String(framework),
              repoPath: filePath,
              prUrl: prResult.url ?? null,
              prNumber: prResult.number ?? null,
              status: "PENDING",
              rulesHash: hash,
            },
          });

          await prisma.governanceEvent.create({
            data: {
              projectId,
              type: GovernanceEventType.GUARDRAIL_PUSHED,
              resourceType: "guardrail-push",
              resourceId: projectId,
              payload: { framework, prUrl: prResult.url, boardId },
            },
          });

          guardrailsPushed.push(`${framework}: ${prResult.url ?? "PR created"}`);
        } catch {
          // Non-fatal per framework
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    projectId,
    connectorType: connRecord.type,
    boardId,
    totalFound: openItems.length,
    casesCreated: results.filter((r) => r.created).length,
    casesExisting: results.filter((r) => r.created === false).length,
    errors: results.filter((r) => r.error).length,
    guardrailsPushed,
    results,
  });
}
