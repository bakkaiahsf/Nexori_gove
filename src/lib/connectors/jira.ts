import crypto from "crypto";
import prisma from "@/lib/db";
import type { SourceConnector, EpicData, CreateEpicInput, CreateStoryInput } from "./index";

export interface JiraCredentials {
  email: string;
  apiToken: string;
}

export interface JiraFieldMapping {
  regulatoryDomain?: string;     // custom field ID → regulatoryDomain
  jurisdiction?: string;
  dataClassification?: string;
  aiSystem?: string;
  environment?: string;
}

// Maps Jira field mapping keys to EpicData governance signal fields
const GOVERNANCE_SIGNAL_FIELDS: (keyof JiraFieldMapping)[] = [
  "regulatoryDomain",
  "jurisdiction",
  "dataClassification",
  "aiSystem",
  "environment",
];

export class JiraConnector implements SourceConnector {
  readonly type = "jira";

  constructor(
    private readonly baseUrl: string,
    private readonly credentials: JiraCredentials,
    private readonly fieldMapping: JiraFieldMapping = {},
    private readonly defaultProjectKey?: string
  ) {}

  private authHeader(): string {
    const token = Buffer.from(
      `${this.credentials.email}:${this.credentials.apiToken}`
    ).toString("base64");
    return `Basic ${token}`;
  }

  private async jiraFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/rest/api/3${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: this.authHeader(),
        "Content-Type": "application/json",
        Accept: "application/json",
        ...options.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Jira API ${res.status} at ${path}: ${body}`);
    }

    return res.json() as Promise<T>;
  }

  private extractGovernanceSignals(
    issue: Record<string, unknown>,
    fields: Record<string, unknown>
  ): Partial<EpicData> {
    const signals: Partial<EpicData> = {};

    for (const signal of GOVERNANCE_SIGNAL_FIELDS) {
      const fieldId = this.fieldMapping[signal];
      if (!fieldId) continue;
      const raw = fields[fieldId];
      if (raw == null) continue;

      const value = typeof raw === "object" && raw !== null && "value" in raw
        ? String((raw as { value: unknown }).value)
        : String(raw);

      switch (signal) {
        case "regulatoryDomain":   signals.regulatoryDomain = value; break;
        case "jurisdiction":       signals.jurisdiction = value; break;
        case "dataClassification": signals.dataClassification = value; break;
        case "environment":        signals.environment = value; break;
        case "aiSystem":
          signals.aiSystemInvolved = value.toLowerCase() !== "false" && value !== "0" && value !== "none";
          break;
      }
    }

    // Infer from labels
    const labels: string[] = Array.isArray((issue as Record<string, unknown>).labels)
      ? ((issue as Record<string, unknown>).labels as string[])
      : (fields.labels as string[]) ?? [];

    const labelStr = labels.join(" ").toLowerCase();
    if (!("thirdPartyChanges" in signals)) {
      signals.thirdPartyChanges = labelStr.includes("third-party") || labelStr.includes("vendor");
    }
    if (!("infrastructureChange" in signals)) {
      signals.infrastructureChange = labelStr.includes("infra") || labelStr.includes("infrastructure");
    }
    if (!("aiSystemInvolved" in signals)) {
      signals.aiSystemInvolved = labelStr.includes("ai") || labelStr.includes("ml") || labelStr.includes("model");
    }

    return signals;
  }

  async fetchEpic(key: string): Promise<EpicData> {
    type JiraIssue = {
      key: string;
      fields: Record<string, unknown>;
    };

    const issue = await this.jiraFetch<JiraIssue>(`/issue/${key}?expand=renderedFields`);
    const fields = issue.fields;

    const summary = String(fields.summary ?? "");
    const description = this.extractDescription(fields.description);
    const labels = (fields.labels as string[]) ?? [];
    const components = ((fields.components as Array<{ name: string }>) ?? []).map((c) => c.name);

    // Find Confluence page links in remoteLinks
    const confluencePageUrls: string[] = [];
    try {
      type RemoteLink = { object?: { url?: string } };
      const remoteLinks = await this.jiraFetch<RemoteLink[]>(`/issue/${key}/remotelink`);
      for (const link of remoteLinks) {
        const url = link.object?.url ?? "";
        if (url.includes("/wiki/") || url.includes("confluence")) {
          confluencePageUrls.push(url);
        }
      }
    } catch {
      // Remote links fetch is best-effort
    }

    const signals = this.extractGovernanceSignals(issue, fields);

    return {
      key: issue.key,
      title: summary,
      description,
      labels,
      components,
      environment: signals.environment,
      dataClassification: signals.dataClassification,
      aiSystemInvolved: signals.aiSystemInvolved ?? false,
      thirdPartyChanges: signals.thirdPartyChanges ?? false,
      infrastructureChange: signals.infrastructureChange ?? false,
      regulatoryDomain: signals.regulatoryDomain,
      jurisdiction: signals.jurisdiction,
      confluencePageUrls,
      customFields: fields,
      timeline: this.extractTimeline(fields),
    };
  }

  private extractDescription(descriptionField: unknown): string {
    if (!descriptionField) return "";
    // Jira Atlassian Document Format (ADF) → plain text
    if (typeof descriptionField === "string") return descriptionField;
    if (typeof descriptionField === "object" && descriptionField !== null) {
      return this.adfToText(descriptionField as Record<string, unknown>);
    }
    return "";
  }

  private adfToText(node: Record<string, unknown>): string {
    if (node.type === "text") return String(node.text ?? "");
    const content = node.content as Record<string, unknown>[] | undefined;
    if (!content) return "";
    return content.map((child) => this.adfToText(child)).join(" ");
  }

  private extractTimeline(fields: Record<string, unknown>): EpicData["timeline"] {
    const startDate = fields["startDate"] ?? fields["start_date"];
    const dueDate = fields["duedate"] ?? fields["due_date"];
    if (!startDate && !dueDate) return undefined;
    return {
      startDate: startDate ? String(startDate) : undefined,
      dueDate: dueDate ? String(dueDate) : undefined,
    };
  }

  async createEpic(data: CreateEpicInput): Promise<string> {
    type CreateResponse = { key: string };
    const projectKey = this.defaultProjectKey;
    if (!projectKey) throw new Error("JiraConnector: defaultProjectKey required to create issues");

    const body = {
      fields: {
        project: { key: projectKey },
        summary: data.title,
        description: {
          type: "doc",
          version: 1,
          content: [{ type: "paragraph", content: [{ type: "text", text: data.description }] }],
        },
        issuetype: { name: "Epic" },
        labels: data.labels ?? [],
        ...(data.parentKey ? { parent: { key: data.parentKey } } : {}),
      },
    };

    const res = await this.jiraFetch<CreateResponse>("/issue", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return res.key;
  }

  async createStory(data: CreateStoryInput): Promise<string> {
    type CreateResponse = { key: string };
    const projectKey = this.defaultProjectKey;
    if (!projectKey) throw new Error("JiraConnector: defaultProjectKey required to create issues");

    const body = {
      fields: {
        project: { key: projectKey },
        summary: data.title,
        description: {
          type: "doc",
          version: 1,
          content: [{ type: "paragraph", content: [{ type: "text", text: data.description }] }],
        },
        issuetype: { name: "Story" },
        labels: data.labels ?? [],
        parent: { key: data.epicKey },
        ...(data.assignee ? { assignee: { emailAddress: data.assignee } } : {}),
      },
    };

    const res = await this.jiraFetch<CreateResponse>("/issue", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return res.key;
  }

  async addComment(key: string, body: string): Promise<void> {
    await this.jiraFetch(`/issue/${key}/comment`, {
      method: "POST",
      body: JSON.stringify({
        body: {
          type: "doc",
          version: 1,
          content: [{ type: "paragraph", content: [{ type: "text", text: body }] }],
        },
      }),
    });
  }

  async linkIssues(sourceKey: string, targetKey: string, linkType: string): Promise<void> {
    await this.jiraFetch("/issueLink", {
      method: "POST",
      body: JSON.stringify({
        type: { name: linkType },
        inwardIssue: { key: sourceKey },
        outwardIssue: { key: targetKey },
      }),
    });
  }

  async updateIssueStatus(key: string, status: string): Promise<void> {
    type TransitionList = { transitions: Array<{ id: string; name: string }> };
    const { transitions } = await this.jiraFetch<TransitionList>(
      `/issue/${key}/transitions`
    );
    const match = transitions.find(
      (t) => t.name.toLowerCase() === status.toLowerCase()
    );
    if (!match) return; // Status transition not available — skip silently
    await this.jiraFetch(`/issue/${key}/transitions`, {
      method: "POST",
      body: JSON.stringify({ transition: { id: match.id } }),
    });
  }

  async fetchConfluencePage(url: string): Promise<string> {
    // Extract page ID from Confluence URL and fetch content via Confluence REST API
    const pageIdMatch = url.match(/pageId=(\d+)|\/pages\/(\d+)/);
    const pageId = pageIdMatch?.[1] ?? pageIdMatch?.[2];
    if (!pageId) return "";

    const confluenceBase = this.baseUrl.replace(/\/jira$/, "").replace(/\/rest\/api.*$/, "");
    const res = await fetch(
      `${confluenceBase}/wiki/rest/api/content/${pageId}?expand=body.storage`,
      {
        headers: {
          Authorization: this.authHeader(),
          Accept: "application/json",
        },
      }
    );
    if (!res.ok) return "";

    type ConfluencePage = { body?: { storage?: { value?: string } } };
    const page = await res.json() as ConfluencePage;
    const html = page.body?.storage?.value ?? "";
    // Strip HTML tags for plain-text RAG ingestion
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
}

/**
 * Verify HMAC-SHA256 webhook signature from Jira.
 * Header: x-hub-signature-256 = sha256=<hex>
 */
export function verifyJiraWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string,
  secret: string
): boolean {
  const expected = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex")}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Build a JiraConnector from a persisted SourceConnector DB record.
 */
export async function buildJiraConnector(connectorId: string): Promise<JiraConnector> {
  const record = await prisma.sourceConnector.findUniqueOrThrow({
    where: { id: connectorId },
  });

  if (record.type !== "jira") {
    throw new Error(`Connector ${connectorId} is type "${record.type}", expected "jira"`);
  }

  const creds = record.credentials as unknown as JiraCredentials;
  const fieldMapping = (record.fieldMapping ?? {}) as unknown as JiraFieldMapping;
  const defaultProjectKey = record.projectKeys[0];

  return new JiraConnector(record.baseUrl, creds, fieldMapping, defaultProjectKey);
}
