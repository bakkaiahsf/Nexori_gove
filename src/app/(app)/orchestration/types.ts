export interface OrchestrationGate {
  id: string;
  name: string;
  order: number;
  status: string; // GateStatus enum values
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
  createdAt: string;
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

export interface ProgramStats {
  totalCases: number;
  enhanced: number;
  regulated: number;
  blocked: number;
  pending: number;
  waivers: number;
  aiMode: string;
}
