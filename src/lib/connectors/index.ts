// Tool-agnostic connector interface — Jira, GitHub, GitLab implement this.
// Linear, ServiceNow, Azure DevOps plug in by implementing this interface.

export interface EpicData {
  key: string;
  title: string;
  description: string;
  labels: string[];
  components: string[];
  environment?: string;
  dataClassification?: string;
  aiSystemInvolved: boolean;
  thirdPartyChanges: boolean;
  infrastructureChange: boolean;
  regulatoryDomain?: string;
  jurisdiction?: string;
  confluencePageUrls: string[];
  customFields: Record<string, unknown>;
  timeline?: {
    startDate?: string;
    dueDate?: string;
    milestones?: Array<{ name: string; date: string }>;
  };
}

export interface CreateEpicInput {
  title: string;
  description: string;
  labels?: string[];
  parentKey?: string;
}

export interface CreateStoryInput {
  epicKey: string;
  title: string;
  description: string;
  labels?: string[];
  assignee?: string;
}

export interface SourceConnector {
  type: string;

  /** Fetch a single epic by its source key (e.g. "BANK-120") */
  fetchEpic(key: string): Promise<EpicData>;

  /** Create an epic in the source tool — returns the new issue key */
  createEpic(data: CreateEpicInput): Promise<string>;

  /** Create a story under an epic — returns the new issue key */
  createStory(data: CreateStoryInput): Promise<string>;

  /** Add a comment to an issue */
  addComment(key: string, body: string): Promise<void>;

  /** Link two issues with a named relationship */
  linkIssues(sourceKey: string, targetKey: string, linkType: string): Promise<void>;

  /** Update an issue's status (if the connector supports it) */
  updateIssueStatus(key: string, status: string): Promise<void>;

  /** Fetch raw text from a Confluence page URL (optional capability) */
  fetchConfluencePage?(url: string): Promise<string>;

  /** List available boards (optional — Jira, GitHub Projects, GitLab boards) */
  listBoards?(): Promise<Array<{ id: string; name: string; type: string }>>;

  /** Create a PR/MR with a file in the repo — for Guardrails-as-Code push */
  createPullRequest?(input: {
    title: string;
    body: string;
    filePath: string;
    fileContent: string;
    baseBranch: string;
  }): Promise<{ url?: string; number?: number }>;
}

import { JiraConnector, type JiraCredentials, type JiraFieldMapping } from "./jira";
import { GitHubConnector } from "./github";
import { GitLabConnector } from "./gitlab";

/** Instantiate the right connector implementation from a DB record */
export function getConnector(record: {
  type: string;
  baseUrl: string;
  credentials: unknown;
  webhookSecret?: string | null;
  projectKeys?: string[];
  fieldMapping?: unknown;
}): SourceConnector {
  const creds = record.credentials as Record<string, string>;

  if (record.type === "jira") {
    const jiraCreds = creds as unknown as JiraCredentials;
    const fieldMapping = (record.fieldMapping ?? {}) as JiraFieldMapping;
    const defaultProjectKey = record.projectKeys?.[0];
    return new JiraConnector(record.baseUrl, jiraCreds, fieldMapping, defaultProjectKey);
  }

  if (record.type === "github") {
    const token = creds.token ?? creds.apiToken ?? "";
    const owner = creds.owner ?? record.projectKeys?.[0]?.split("/")?.[0] ?? "";
    const repo = creds.repo ?? record.projectKeys?.[0]?.split("/")?.[1] ?? "";
    return new GitHubConnector({ token, owner, repo });
  }

  if (record.type === "gitlab") {
    const token = creds.token ?? creds.apiToken ?? "";
    const projectId = creds.projectId ?? record.projectKeys?.[0] ?? "";
    return new GitLabConnector({ token, baseUrl: record.baseUrl, projectId });
  }

  throw new Error(`No connector implementation for type: ${record.type}`);
}
