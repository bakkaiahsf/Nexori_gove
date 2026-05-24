import { timingSafeEqual } from "crypto";
import type { EpicData, SourceConnector, CreateEpicInput, CreateStoryInput } from "./index";

interface GitLabMRPayload {
  iid: number;
  title: string;
  description?: string | null;
  source_branch: string;
  target_branch: string;
  author: { username: string };
  labels: string[];
  state: string;
  web_url: string;
  changes_count?: string | null;
  merged_at?: string | null;
  closed_at?: string | null;
}

interface GitLabMRChange {
  old_path: string;
  new_path: string;
  a_mode: string;
  b_mode: string;
  new_file: boolean;
  renamed_file: boolean;
  deleted_file: boolean;
}

interface GitLabConnectorOptions {
  token: string;
  baseUrl: string; // e.g. "https://gitlab.com"
  projectId: string | number; // GitLab numeric project ID or "namespace/name"
}

export function mapMRToEpicData(
  mr: GitLabMRPayload,
  changes: GitLabMRChange[],
  projectPath: string
): EpicData {
  const labels = mr.labels ?? [];
  const filenames = changes.map((c) => c.new_path || c.old_path);

  const aiSystemInvolved =
    labels.some((l) => /ai|ml|model|llm/i.test(l)) ||
    filenames.some((f) => /ai\/|ml\/|model[s]?\//i.test(f));

  const thirdPartyChanges =
    labels.some((l) => /third.party|vendor|integration|dependency/i.test(l)) ||
    filenames.some((f) => /package\.json|requirements\.txt|go\.mod|Gemfile/i.test(f));

  const infrastructureChange =
    labels.some((l) => /infra|terraform|k8s|kubernetes|docker/i.test(l)) ||
    filenames.some((f) => /terraform|\.tf|k8s|kubernetes|dockerfile|docker-compose/i.test(f));

  const dataClassification = labels.find((l) => /personal|financial|confidential|restricted/i.test(l));
  const regulatoryDomain = labels.find((l) => /dora|eu-ai-act|soc2|iso-27001|pci|gdpr/i.test(l));

  const isProduction = mr.target_branch === "main" || mr.target_branch === "master";

  return {
    key: `${projectPath}!${mr.iid}`,
    title: mr.title,
    description:
      mr.description ?? `GitLab MR !${mr.iid} in ${projectPath} targeting ${mr.target_branch}`,
    labels,
    components: [...new Set(filenames.map((f) => f.split("/")[0]))].filter(Boolean),
    environment: isProduction ? "production" : "staging",
    dataClassification,
    aiSystemInvolved,
    thirdPartyChanges,
    infrastructureChange,
    regulatoryDomain,
    jurisdiction: "GLOBAL",
    confluencePageUrls: [],
    customFields: {
      mrIid: mr.iid,
      projectPath,
      author: mr.author.username,
      targetBranch: mr.target_branch,
      sourceBranch: mr.source_branch,
      filesChanged: changes.length,
      webUrl: mr.web_url,
    },
  };
}

export class GitLabConnector implements SourceConnector {
  readonly type = "gitlab";
  private readonly opts: GitLabConnectorOptions;

  constructor(opts: GitLabConnectorOptions) {
    this.opts = opts;
  }

  private get apiBase(): string {
    return `${this.opts.baseUrl}/api/v4`;
  }

  private encodedProjectId(): string {
    return encodeURIComponent(String(this.opts.projectId));
  }

  private async glFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.apiBase}${path}`, {
      ...options,
      headers: {
        "PRIVATE-TOKEN": this.opts.token,
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
    if (!res.ok) {
      throw new Error(`GitLab API ${res.status}: ${await res.text()}`);
    }
    return res.json() as Promise<T>;
  }

  async fetchEpic(key: string): Promise<EpicData> {
    // key format: "namespace/project!123" or just "123"
    let mrIid: number;
    let projectId = this.opts.projectId;

    const match = key.match(/^(.+)!(\d+)$/);
    if (match) {
      projectId = match[1];
      mrIid = parseInt(match[2], 10);
    } else {
      mrIid = parseInt(key.replace("!", ""), 10);
    }

    const encodedPid = encodeURIComponent(String(projectId));
    const [mr, changes] = await Promise.all([
      this.glFetch<GitLabMRPayload>(`/projects/${encodedPid}/merge_requests/${mrIid}`),
      this.glFetch<{ changes: GitLabMRChange[] }>(
        `/projects/${encodedPid}/merge_requests/${mrIid}/changes`
      ).then((r) => r.changes ?? []),
    ]);

    return mapMRToEpicData(mr, changes, String(projectId));
  }

  async createEpic(_data: CreateEpicInput): Promise<string> {
    throw new Error("GitLab connector does not support creating epics");
  }

  async createStory(_data: CreateStoryInput): Promise<string> {
    throw new Error("GitLab connector does not support creating stories");
  }

  async addComment(key: string, body: string): Promise<void> {
    const match = key.match(/^(.+)!(\d+)$/);
    if (!match) return;
    const [, projectPath, iid] = match;
    await this.glFetch(`/projects/${encodeURIComponent(projectPath)}/merge_requests/${iid}/notes`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
  }

  async linkIssues(_sourceKey: string, _targetKey: string, _linkType: string): Promise<void> {
    // GitLab supports issue links via dedicated endpoint — not needed for MVP
  }

  async updateIssueStatus(_key: string, _status: string): Promise<void> {
    // MR state transitions (merge/close) require dedicated endpoints
  }
}

export function buildGitLabConnector(opts: GitLabConnectorOptions): GitLabConnector {
  return new GitLabConnector(opts);
}

/**
 * Verify GitLab webhook token (header: X-Gitlab-Token).
 * GitLab sends a shared secret string, not an HMAC.
 */
export function verifyGitLabWebhookToken(
  header: string,
  expectedSecret: string
): boolean {
  const a = Buffer.from(header, "utf-8");
  const b = Buffer.from(expectedSecret, "utf-8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
