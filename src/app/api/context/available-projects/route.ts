import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { GitHubConnector } from "@/lib/connectors/github";
import { GitLabConnector } from "@/lib/connectors/gitlab";
import { JiraConnector } from "@/lib/connectors/jira";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const [nexoriProjects, connectors] = await Promise.all([
    prisma.project.findMany({
      select: { id: true, name: true, key: true, status: true, programId: true, program: { select: { name: true } } },
      where: { status: { not: "archived" } },
      orderBy: { name: "asc" },
    }),
    prisma.sourceConnector.findMany({
      where: { enabled: true },
      select: { id: true, type: true, name: true, baseUrl: true, credentials: true },
    }),
  ]);

  type SourceProject = {
    id: string;
    name: string;
    ref: string;
    connectorId: string;
    connectorName: string;
    connectorType: string;
  };

  const sourceProjects: SourceProject[] = [];

  // 8-second per-connector timeout — prevents hanging sockets when a source tool is unreachable
  const CONNECTOR_TIMEOUT_MS = 8000;

  await Promise.all(
    connectors.map(async (conn) => {
      const creds = conn.credentials as Record<string, string>;
      const token = creds.token ?? creds.apiToken ?? "";

      try {
        const signal = AbortSignal.timeout(CONNECTOR_TIMEOUT_MS);

        if (conn.type === "github") {
          const gh = new GitHubConnector({ token, owner: "", repo: "" });
          const repos = await Promise.race([
            gh.listRepositories(),
            new Promise<never>((_, rej) => signal.addEventListener("abort", () => rej(new Error("timeout")))),
          ]);
          for (const r of repos) {
            sourceProjects.push({
              id: r.id,
              name: r.fullName,
              ref: r.fullName,
              connectorId: conn.id,
              connectorName: conn.name,
              connectorType: "github",
            });
          }
        } else if (conn.type === "gitlab") {
          const gl = new GitLabConnector({ token, baseUrl: conn.baseUrl, projectId: "" });
          const projects = await Promise.race([
            gl.listProjects(),
            new Promise<never>((_, rej) => signal.addEventListener("abort", () => rej(new Error("timeout")))),
          ]);
          for (const p of projects) {
            sourceProjects.push({
              id: String(p.id),
              name: p.pathWithNamespace,
              ref: p.pathWithNamespace,
              connectorId: conn.id,
              connectorName: conn.name,
              connectorType: "gitlab",
            });
          }
        } else if (conn.type === "jira") {
          const jira = new JiraConnector(
            conn.baseUrl,
            { email: creds.email ?? "", apiToken: creds.apiToken ?? "" },
            {},
            ""
          );
          const jiraProjects = await Promise.race([
            jira.listProjects(),
            new Promise<never>((_, rej) => signal.addEventListener("abort", () => rej(new Error("timeout")))),
          ]).catch(() => [] as Array<{ key: string; name: string }>);
          for (const p of jiraProjects) {
            sourceProjects.push({
              id: p.key,
              name: p.name,
              ref: p.key,
              connectorId: conn.id,
              connectorName: conn.name,
              connectorType: "jira",
            });
          }
        }
      } catch {
        // connector offline or timed out — skip silently
      }
    })
  );

  return NextResponse.json({
    nexoriProjects,
    sourceProjects,
  });
}
