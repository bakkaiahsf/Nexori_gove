// Tool-agnostic connector interface — Jira is the first implementation.
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
}
