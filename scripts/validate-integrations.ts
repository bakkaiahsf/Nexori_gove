/**
 * Validates all integrations by calling each connector API directly.
 * Run: DATABASE_URL="..." npx tsx scripts/validate-integrations.ts
 */

import { PrismaClient } from "@prisma/client";
import { GitHubConnector } from "../src/lib/connectors/github";
import { GitLabConnector } from "../src/lib/connectors/gitlab";
import { JiraConnector } from "../src/lib/connectors/jira";

const db = new PrismaClient();

function pass(label: string, detail: string) {
  console.log(`  ✓  ${label}: ${detail}`);
}
function fail(label: string, err: unknown) {
  console.log(`  ✗  ${label}: ${String(err).slice(0, 120)}`);
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  NexoriOS Integration Validation");
  console.log("═══════════════════════════════════════════\n");

  const connectors = await db.sourceConnector.findMany({
    where: { enabled: true },
    select: { id: true, type: true, name: true, baseUrl: true, credentials: true, projectKeys: true },
  });

  console.log(`Found ${connectors.length} enabled connector(s) in DB\n`);

  for (const conn of connectors) {
    console.log(`── [${conn.type.toUpperCase()}] ${conn.name} ──────────────────`);
    const creds = conn.credentials as Record<string, string>;

    if (conn.type === "jira") {
      const email = creds.email ?? "";
      const token = creds.apiToken ?? "";
      if (!email || !token) { fail("credentials", "email or apiToken missing"); continue; }

      const jira = new JiraConnector(conn.baseUrl, { email, apiToken: token }, {});

      // Test 1: List projects
      try {
        const projects = await jira.listProjects();
        pass("listProjects", `${projects.length} projects — ${projects.slice(0, 5).map(p => p.key).join(", ")}`);
      } catch (e) { fail("listProjects", e); }

      // Test 2: List boards
      try {
        const boards = await jira.listBoards?.() ?? [];
        pass("listBoards", `${boards.length} boards`);
      } catch (e) { fail("listBoards", e); }

      // Test 3: Fetch first available epic
      if (conn.projectKeys.length > 0) {
        const projectKey = conn.projectKeys[0];
        try {
          const auth = Buffer.from(`${email}:${token}`).toString("base64");
          const res = await fetch(
            `${conn.baseUrl}/rest/api/3/search?jql=project=${projectKey}+AND+issuetype=Epic&maxResults=1`,
            { headers: { Authorization: `Basic ${auth}`, Accept: "application/json" } }
          );
          if (res.ok) {
            const data = await res.json() as { total: number; issues: Array<{ key: string; fields: { summary: string } }> };
            if (data.issues.length > 0) {
              pass(`first epic in ${projectKey}`, `${data.issues[0].key}: ${data.issues[0].fields.summary.slice(0, 60)}`);
            } else {
              pass(`epics in ${projectKey}`, `0 epics found (project exists)`);
            }
          } else {
            fail(`epics in ${projectKey}`, `HTTP ${res.status}`);
          }
        } catch (e) { fail("fetch epic", e); }
      }
    }

    if (conn.type === "github") {
      const token = creds.token ?? creds.apiToken ?? "";
      if (!token) { fail("credentials", "token missing"); continue; }

      const gh = new GitHubConnector({ token, owner: creds.owner ?? "", repo: "" });

      // Test 1: List repositories
      try {
        const repos = await gh.listRepositories();
        pass("listRepositories", `${repos.length} repos — ${repos.slice(0, 4).map(r => r.name).join(", ")}`);
      } catch (e) { fail("listRepositories", e); }

      // Test 2: List open PRs on first known repo
      const firstKey = conn.projectKeys[0] ?? creds.owner ?? "";
      if (firstKey && creds.owner) {
        const testRepo = "salesforce-ai-pipeline"; // known repo from env
        try {
          const ghWithRepo = new GitHubConnector({ token, owner: creds.owner, repo: testRepo });
          const prs = await ghWithRepo.listOpenPRs();
          pass(`open PRs in ${creds.owner}/${testRepo}`, `${prs.length} open PRs`);
        } catch (e) { fail(`open PRs`, e); }
      }
    }

    if (conn.type === "gitlab") {
      const token = creds.token ?? creds.apiToken ?? "";
      if (!token) { fail("credentials", "token missing"); continue; }

      const gl = new GitLabConnector({ token, baseUrl: conn.baseUrl, projectId: "" });

      // Test 1: List projects
      try {
        const projects = await gl.listProjects();
        pass("listProjects", `${projects.length} projects — ${projects.slice(0, 4).map(p => p.pathWithNamespace).join(", ")}`);
      } catch (e) { fail("listProjects", e); }
    }

    console.log();
  }

  // ── AI Provider test ──────────────────────────────────────────────────────
  console.log("── AI PROVIDERS ─────────────────────────────────────");
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? "";
  const openaiKey = process.env.OPENAI_API_KEY ?? "";

  if (anthropicKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 20,
          messages: [{ role: "user", content: "Reply with: OK" }],
        }),
      });
      if (res.ok) {
        const data = await res.json() as { content: Array<{ text: string }> };
        pass("Anthropic claude-haiku-4-5", data.content[0]?.text?.trim() ?? "responded");
      } else {
        fail("Anthropic", `HTTP ${res.status}: ${await res.text()}`);
      }
    } catch (e) { fail("Anthropic", e); }
  } else {
    fail("Anthropic", "ANTHROPIC_API_KEY not set");
  }

  if (openaiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 10, messages: [{ role: "user", content: "Say OK" }] }),
      });
      if (res.ok) {
        const data = await res.json() as { choices: Array<{ message: { content: string } }> };
        pass("OpenAI gpt-4o-mini", data.choices[0]?.message?.content?.trim() ?? "responded");
      } else {
        fail("OpenAI", `HTTP ${res.status}`);
      }
    } catch (e) { fail("OpenAI", e); }
  } else {
    fail("OpenAI", "OPENAI_API_KEY not set");
  }

  console.log("\n═══════════════════════════════════════════");
  console.log("  Validation complete.");
  console.log("═══════════════════════════════════════════");
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
