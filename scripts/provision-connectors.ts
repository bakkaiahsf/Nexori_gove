/**
 * Provision real integration connectors from .env.local into the DB.
 * Run: npx tsx scripts/provision-connectors.ts
 *
 * - Deletes dummy/seed connectors with fake URLs
 * - Upserts real Jira, GitHub, and GitLab connectors using env vars
 * - Validates connectivity for each connector before saving
 */

import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function log(symbol: string, msg: string) {
  console.log(`${symbol} ${msg}`);
}

async function validateJira(baseUrl: string, email: string, token: string): Promise<string[]> {
  const auth = Buffer.from(`${email}:${token}`).toString("base64");
  const res = await fetch(`${baseUrl}/rest/api/3/project?maxResults=50`, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Jira API ${res.status}: ${await res.text()}`);
  }
  const data = await res.json() as Array<{ key: string; name: string }>;
  return data.map((p) => p.key);
}

async function validateGitHub(token: string): Promise<{ login: string; repos: string[] }> {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const userRes = await fetch("https://api.github.com/user", { headers });
  if (!userRes.ok) throw new Error(`GitHub API ${userRes.status}: ${await userRes.text()}`);
  const user = await userRes.json() as { login: string };

  const reposRes = await fetch(
    "https://api.github.com/user/repos?per_page=30&sort=updated&affiliation=owner,collaborator,organization_member",
    { headers }
  );
  if (!reposRes.ok) throw new Error(`GitHub repos API ${reposRes.status}: ${await reposRes.text()}`);
  const repos = await reposRes.json() as Array<{ full_name: string }>;
  return { login: user.login, repos: repos.map((r) => r.full_name) };
}

async function validateGitLab(baseUrl: string, token: string): Promise<string[]> {
  const res = await fetch(`${baseUrl}/api/v4/projects?membership=true&per_page=30&order_by=last_activity_at`, {
    headers: { "PRIVATE-TOKEN": token },
  });
  if (!res.ok) throw new Error(`GitLab API ${res.status}: ${await res.text()}`);
  const data = await res.json() as Array<{ path_with_namespace: string }>;
  return data.map((p) => p.path_with_namespace);
}

async function main() {
  log("🔍", "Reading credentials from environment...\n");

  const jiraBase = process.env.JIRA_BASE_URL ?? "";
  const jiraEmail = process.env.JIRA_EMAIL ?? "";
  const jiraToken = process.env.JIRA_API_TOKEN ?? "";
  const githubToken = process.env.GITHUB_TOKEN ?? "";
  const githubOrg = process.env.GITHUB_ORG ?? "";
  const gitlabUrl = process.env.GITLAB_URL ?? "https://gitlab.com";
  const gitlabToken = process.env.GITLAB_TOKEN ?? "";

  // ── 1. Remove known dummy connectors ──────────────────────────────────────
  log("🗑 ", "Removing dummy/seed connectors with fake URLs...");
  const deleted = await db.sourceConnector.deleteMany({
    where: {
      baseUrl: {
        in: [
          "https://nexori-test.atlassian.net",
          "https://nexoribank.atlassian.net",
          "https://api.github.com",
        ],
      },
    },
  });
  log("   ", `Deleted ${deleted.count} dummy connector(s)\n`);

  // ── 2. Jira ────────────────────────────────────────────────────────────────
  if (jiraBase && jiraEmail && jiraToken) {
    process.stdout.write("⚙  Validating Jira connection to " + jiraBase + " ...");
    try {
      const projectKeys = await validateJira(jiraBase, jiraEmail, jiraToken);
      console.log(` ✓  ${projectKeys.length} project(s): ${projectKeys.slice(0, 8).join(", ")}`);

      const existing = await db.sourceConnector.findFirst({
        where: { type: "jira", baseUrl: jiraBase },
        select: { id: true },
      });

      const connData = {
        type: "jira",
        name: "Salesforce AI Jira (salesforceai.atlassian.net)",
        baseUrl: jiraBase,
        credentials: { email: jiraEmail, apiToken: jiraToken } as object,
        projectKeys,
        webhookSecret: crypto.randomBytes(32).toString("hex"),
        enabled: true,
      };

      if (existing) {
        await db.sourceConnector.update({ where: { id: existing.id }, data: connData });
        log("   ", `Updated Jira connector (id: ${existing.id})`);
      } else {
        const created = await db.sourceConnector.create({ data: connData });
        log("   ", `Created Jira connector (id: ${created.id})`);
      }
    } catch (err) {
      log("✗ ", `Jira validation FAILED: ${String(err)}`);
    }
  } else {
    log("⚠ ", "Jira env vars missing (JIRA_BASE_URL / JIRA_EMAIL / JIRA_API_TOKEN) — skipping");
  }

  // ── 3. GitHub ──────────────────────────────────────────────────────────────
  if (githubToken) {
    process.stdout.write("\n⚙  Validating GitHub connection ...");
    try {
      const { login, repos } = await validateGitHub(githubToken);
      console.log(` ✓  authenticated as ${login}, ${repos.length} repo(s) visible`);

      const existing = await db.sourceConnector.findFirst({
        where: { type: "github", credentials: { path: ["token"], equals: githubToken } },
        select: { id: true },
      });

      const connData = {
        type: "github",
        name: `GitHub — ${githubOrg || login}`,
        baseUrl: "https://api.github.com",
        credentials: { token: githubToken, owner: githubOrg || login } as object,
        projectKeys: [githubOrg || login],
        webhookSecret: crypto.randomBytes(32).toString("hex"),
        enabled: true,
      };

      if (existing) {
        await db.sourceConnector.update({ where: { id: existing.id }, data: connData });
        log("   ", `Updated GitHub connector (id: ${existing.id})`);
      } else {
        const created = await db.sourceConnector.create({ data: connData });
        log("   ", `Created GitHub connector (id: ${created.id})`);
      }
      log("   ", `Repos: ${repos.slice(0, 6).join(", ")}${repos.length > 6 ? " ..." : ""}`);
    } catch (err) {
      log("✗ ", `GitHub validation FAILED: ${String(err)}`);
    }
  } else {
    log("⚠ ", "GITHUB_TOKEN missing — skipping");
  }

  // ── 4. GitLab ─────────────────────────────────────────────────────────────
  if (gitlabToken) {
    process.stdout.write("\n⚙  Validating GitLab connection to " + gitlabUrl + " ...");
    try {
      const projects = await validateGitLab(gitlabUrl, gitlabToken);
      console.log(` ✓  ${projects.length} project(s): ${projects.slice(0, 5).join(", ")}`);

      const existing = await db.sourceConnector.findFirst({
        where: { type: "gitlab", baseUrl: gitlabUrl },
        select: { id: true },
      });

      const connData = {
        type: "gitlab",
        name: `GitLab — ${gitlabUrl.replace("https://", "")}`,
        baseUrl: gitlabUrl,
        credentials: { token: gitlabToken } as object,
        projectKeys: projects.slice(0, 20),
        webhookSecret: crypto.randomBytes(32).toString("hex"),
        enabled: true,
      };

      if (existing) {
        await db.sourceConnector.update({ where: { id: existing.id }, data: connData });
        log("   ", `Updated GitLab connector (id: ${existing.id})`);
      } else {
        const created = await db.sourceConnector.create({ data: connData });
        log("   ", `Created GitLab connector (id: ${created.id})`);
      }
    } catch (err) {
      log("✗ ", `GitLab validation FAILED: ${String(err)}`);
    }
  } else {
    log("⚠ ", "GITLAB_TOKEN missing — skipping");
  }

  // ── 5. Fix any remaining bad-URL Jira connectors ──────────────────────────
  log("\n🔧", "Fixing any remaining connectors with malformed baseUrls...");
  const badJira = await db.sourceConnector.findMany({
    where: { type: "jira", baseUrl: { contains: "/jira/software" } },
    select: { id: true, baseUrl: true },
  });
  for (const c of badJira) {
    const fixedUrl = new URL(c.baseUrl).origin;
    await db.sourceConnector.update({ where: { id: c.id }, data: { baseUrl: fixedUrl } });
    log("   ", `Fixed connector ${c.id}: ${c.baseUrl} → ${fixedUrl}`);
  }

  // ── 6. Summary ────────────────────────────────────────────────────────────
  console.log("\n─────────────────────────────────────────────");
  const all = await db.sourceConnector.findMany({
    select: { id: true, type: true, name: true, baseUrl: true, enabled: true },
  });
  log("📋", `Final connector inventory (${all.length} total):`);
  for (const c of all) {
    log(`  ${c.enabled ? "●" : "○"}`, `[${c.type.toUpperCase()}] ${c.name} — ${c.baseUrl}`);
  }

  await db.$disconnect();
  log("\n✅", "Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
