import type { AIControlMode, RegulatoryFramework } from "@prisma/client";

export type ProjectSummary = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  domain: string | null;
  classification: string | null;
  ownerEmail: string;
  status: string;
  createdAt: Date;
  aiMode: AIControlMode;
  activeCases: number;
  triggerRules: number;
  blockedGates: number;
  pendingGates: number;
  readiness: "GO" | "NO_GO" | "CONDITIONAL" | "SETUP";
  connectors: string[];
  frameworks: RegulatoryFramework[];
};
