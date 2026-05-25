import { createHmac, timingSafeEqual } from "crypto";
import type { EpicData, SourceConnector, CreateEpicInput, CreateStoryInput } from "./index";

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

interface GitHubPRFile {
  filename: string;
  additions: number;
  deletions: number;
  status: string;
}

interface GitHubConnectorOptions {
  token: string;
  owner: string;
  repo: string;
}

/**
 * Map raw GitHub PR payload to the canonical EpicData used by the governance pipeline.
 * GitHub PRs → treated as governance "epics" for pipeline orchestration purposes.
 */
export function mapPRToEpicData(
  pr: GitHubPRPayload,
  files: GitHubPRFile[],
  repo: string
): EpicData {
  const labels = pr.labels.map((l) => l.name);
  const filenames = files.map((f) => f.filename);

  const aiSystemInvolved =
    labels.some((l) => /ai|ml|model|llm/i.test(l)) ||
    filenames.some((f) => /ai\/|ml\/|model[s]?\//i.test(f));

  const thirdPartyChanges =
    labels.some((l) => /third.party|vendor|integration|dependency/i.test(l)) ||
    filenames.some((f) => /package\.json|requirements\.txt|go\.mod/i.test(f));

  const infrastructureChange =
    labels.some((l) => /infra|infrastructure|terraform|k8s|kubernetes|docker/i.test(l)) ||
    filenames.some((f) => /terraform|\.tf|k8s|kubernetes|dockerfile|docker-compose/i.test(f));

  const dataClassification = labels.find((l) =>
    /personal|financial|confidential|restricted/i.test(l)
  );

  const regulatoryDomain = labels.find((l) => /dora|eu-ai-act|soc2|iso-27001|pci|gdpr/i.test(l));

  return {
    key: `${repo}#${pr.number}`,
    title: pr.title,
    description: pr.body ?? `GitHub PR #${pr.number} in ${repo} targeting ${pr.base.ref}`,
    labels,
    components: [...new Set(filenames.map((f) => f.split("/")[0]))].filter(Boolean),
    environment: pr.base.ref === "main" || pr.base.ref === "master" ? "production" : "staging",
    dataClassification,
    aiSystemInvolved,
    thirdPartyChanges,
    infrastructureChange,
    regulatoryDomain,
    jurisdiction: "GLOBAL",
    confluencePageUrls: [],
    customFields: {
      prNumber: pr.number,
      repo,
      author: pr.user.login,
      targetBranch: pr.base.ref,
      sourceBranch: pr.head.ref,
      filesChanged: pr.changed_files ?? files.length,
      linesAdded: pr.additions ?? 0,
      linesRemoved: pr.deletions ?? 0,
      htmlUrl: pr.html_url,
    },
  };
}

export class GitHubConnector implements SourceConnector {
  readonly type = "github";
  private readonly opts: GitHubConnectorOptions;

  constructor(opts: GitHubConnectorOptions) {
    this.opts = opts;
  }

  private async ghFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`https://api.github.com${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.opts.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...options?.headers,
      },
    });
    if (!res.ok) {
      throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
    }
    return res.json() as Promise<T>;
  }

  async fetchEpic(key: string): Promise<EpicData> {
    // key format: "owner/repo#123" or just "123" (uses constructor owner/repo)
    let prNumber: number;
    let owner = this.opts.owner;
    let repo = this.opts.repo;

    const match = key.match(/^([^/]+)\/([^#]+)#(\d+)$/);
    if (match) {
      owner = match[1];
      repo = match[2];
      prNumber = parseInt(match[3], 10);
    } else {
      prNumber = parseInt(key.replace("#", ""), 10);
    }

    const [pr, files] = await Promise.all([
      this.ghFetch<GitHubPRPayload>(`/repos/${owner}/${repo}/pulls/${prNumber}`),
      this.ghFetch<GitHubPRFile[]>(`/repos/${owner}/${repo}/pulls/${prNumber}/files`),
    ]);

    return mapPRToEpicData(pr, files, `${owner}/${repo}`);
  }

  async createEpic(_data: CreateEpicInput): Promise<string> {
    throw new Error("GitHub connector does not support creating epics");
  }

  async createStory(_data: CreateStoryInput): Promise<string> {
    throw new Error("GitHub connector does not support creating stories");
  }

  async addComment(key: string, body: string): Promise<void> {
    const match = key.match(/^([^/]+)\/([^#]+)#(\d+)$/);
    if (!match) return;
    const [, owner, repo, num] = match;
    await this.ghFetch(`/repos/${owner}/${repo}/issues/${num}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
      headers: { "Content-Type": "application/json" },
    });
  }

  async linkIssues(_sourceKey: string, _targetKey: string, _linkType: string): Promise<void> {
    // GitHub does not have native issue linking in the REST API
  }

  async updateIssueStatus(_key: string, _status: string): Promise<void> {
    // Status updates on PRs require merge/close operations — not supported generically
  }

  async listBoards(): Promise<Array<{ id: string; name: string; type: string }>> {
    try {
      const projects = await this.ghFetch<Array<{ id: number; name: string; body?: string }>>(
        `/repos/${this.opts.owner}/${this.opts.repo}/projects`
      );
      return projects.map((p) => ({ id: String(p.id), name: p.name, type: "kanban" }));
    } catch {
      return [];
    }
  }

  async createPullRequest(input: {
    title: string;
    body: string;
    filePath: string;
    fileContent: string;
    baseBranch: string;
  }): Promise<{ url?: string; number?: number }> {
    const { owner, repo } = this.opts;
    const branchName = `nexori-guardrails-${Date.now()}`;

    // Get base branch SHA
    const baseRef = await this.ghFetch<{ object: { sha: string } }>(
      `/repos/${owner}/${repo}/git/ref/heads/${input.baseBranch}`
    );
    const baseSha = baseRef.object.sha;

    // Create branch
    await this.ghFetch(`/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha }),
      headers: { "Content-Type": "application/json" },
    });

    // Check if file exists to get its SHA (needed for update)
    let existingSha: string | undefined;
    try {
      const existing = await this.ghFetch<{ sha: string }>(
        `/repos/${owner}/${repo}/contents/${input.filePath}?ref=${branchName}`
      );
      existingSha = existing.sha;
    } catch {
      existingSha = undefined;
    }

    // Create or update file
    const fileBody: Record<string, string> = {
      message: `chore(governance): add ${input.filePath}`,
      content: Buffer.from(input.fileContent).toString("base64"),
      branch: branchName,
    };
    if (existingSha) fileBody.sha = existingSha;

    await this.ghFetch(`/repos/${owner}/${repo}/contents/${input.filePath}`, {
      method: "PUT",
      body: JSON.stringify(fileBody),
      headers: { "Content-Type": "application/json" },
    });

    // Create PR
    const pr = await this.ghFetch<{ html_url: string; number: number }>(
      `/repos/${owner}/${repo}/pulls`,
      {
        method: "POST",
        body: JSON.stringify({
          title: input.title,
          body: input.body,
          head: branchName,
          base: input.baseBranch,
        }),
        headers: { "Content-Type": "application/json" },
      }
    );

    return { url: pr.html_url, number: pr.number };
  }

  async listRepositories(): Promise<
    Array<{ id: string; name: string; fullName: string; defaultBranch: string; private: boolean; description: string | null }>
  > {
    const repos = await this.ghFetch<
      Array<{ id: number; name: string; full_name: string; default_branch: string; private: boolean; description: string | null }>
    >(`/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member`);
    return repos.map((r) => ({
      id: String(r.id),
      name: r.name,
      fullName: r.full_name,
      defaultBranch: r.default_branch,
      private: r.private,
      description: r.description,
    }));
  }

  async listOpenPRs(): Promise<
    Array<{ number: number; title: string; author: string; url: string; labels: string[]; sourceBranch: string; targetBranch: string }>
  > {
    const { owner, repo } = this.opts;
    const prs = await this.ghFetch<
      Array<{ number: number; title: string; user: { login: string }; html_url: string; labels: Array<{ name: string }>; head: { ref: string }; base: { ref: string } }>
    >(`/repos/${owner}/${repo}/pulls?state=open&per_page=50&sort=updated`);
    return prs.map((pr) => ({
      number: pr.number,
      title: pr.title,
      author: pr.user.login,
      url: pr.html_url,
      labels: pr.labels.map((l) => l.name),
      sourceBranch: pr.head.ref,
      targetBranch: pr.base.ref,
    }));
  }

  async createIssue(input: {
    title: string;
    body: string;
    labels?: string[];
  }): Promise<{ number: number; url: string }> {
    const { owner, repo } = this.opts;
    const issue = await this.ghFetch<{ number: number; html_url: string }>(
      `/repos/${owner}/${repo}/issues`,
      {
        method: "POST",
        body: JSON.stringify({ title: input.title, body: input.body, labels: input.labels ?? [] }),
        headers: { "Content-Type": "application/json" },
      }
    );
    return { number: issue.number, url: issue.html_url };
  }
}

export function buildGitHubConnector(token: string, owner: string, repo: string): GitHubConnector {
  return new GitHubConnector({ token, owner, repo });
}

/**
 * Verify GitHub webhook signature using HMAC-SHA256.
 * GitHub sends: X-Hub-Signature-256: sha256=<hex>
 */
export function verifyGitHubWebhookSignature(
  body: Buffer,
  signatureHeader: string,
  secret: string
): boolean {
  if (!signatureHeader.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(body).digest("hex"), "utf-8");
  const actual = Buffer.from(signatureHeader.slice(7), "utf-8");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
