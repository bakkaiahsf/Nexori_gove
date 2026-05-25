export interface OrchestrationGate {
  id: string;
  name: string;
  order: number;
  status: string;
  skipped: boolean;
  skipReason: string | null;
  inheritedFrom: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectedAt: string | null;
  pendingApprovalId: string | null;
}

export interface OrchestrationCase {
  id: string;
  title: string;
  description: string | null;
  phase: string;
  status: string;
  sourceEpicKey: string | null;
  sourceGovEpicKey: string | null;
  sourceConnectorId: string | null;
  sourceType: string; // "jira" | "github" | "gitlab" | "manual"
  createdAt: string;
  project: {
    id: string;
    key: string;
    name: string;
  };
  context: {
    aiSystemInvolved: boolean;
    thirdPartyChanges: boolean;
    infrastructureChange: boolean;
    dataClassification: string | null;
    environment: string | null;
    enrichedAt: string;
    contextSummary: string | null;
  } | null;
  riskScore: {
    compositeScore: number;
    intensity: string;
    aiModeRecommended: string;
    scoredAt: string;
  } | null;
  adaptivePipeline: {
    totalGateCount: number;
    reducedFromBaseline: number;
    composedAt: string;
  } | null;
  gates: OrchestrationGate[];
  evidenceCount: number;
  waiverCount: number;
  triggerEval: {
    evaluatedAt: string;
    sourceType: string;
    eventType: string;
    action: string | null;
  } | null;
}

export interface SourceGroup {
  sourceType: string; // "jira" | "github" | "gitlab" | "manual"
  connector: {
    id: string;
    type: string;
    name: string;
    baseUrl: string;
    enabled: boolean;
    lastEventAt: string | null;
  } | null;
  cases: OrchestrationCase[];
  stats: {
    total: number;
    enhanced: number;
    regulated: number;
    blocked: number;
    pending: number;
    waivers: number;
  };
}

// Kept for backwards compat with old client code
export interface ConnectorGroup {
  connector: {
    id: string;
    type: string;
    name: string;
    baseUrl: string;
    projectKeys: string[];
  } | null;
  cases: OrchestrationCase[];
  stats: {
    total: number;
    enhanced: number;
    regulated: number;
    blocked: number;
    pending: number;
    waivers: number;
  };
}

export interface EnterpriseStats {
  totalProjects: number;
  totalCases: number;
  enhanced: number;
  regulated: number;
  blocked: number;
  pending: number;
  waivers: number;
  avgRiskScore: number;
  aiModes: Record<string, number>;
}

export interface ConnectorHealth {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
  eventCount: number;
  matchedCount: number;
  lastEventAt: string | null;
}

export interface ProgramStats {
  totalCases: number;
  enhanced: number;
  regulated: number;
  blocked: number;
  pending: number;
  waivers: number;
  aiMode: string;
}
