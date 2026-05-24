export type GateWithStats = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  defaultSlaHours: number;
  intensityTriggers: string[];
  requiredEvidence: string[];
  approverRoles: string[];
  isBuiltIn: boolean;
  enabled: boolean;
};

export const CATEGORY_META: Record<string, { label: string; color: string }> = {
  security: { label: "Security", color: "text-critical border-critical bg-critical/10" },
  architecture: { label: "Architecture", color: "text-primary border-primary bg-primary/10" },
  "ai-governance": {
    label: "AI Governance",
    color: "text-tertiary border-tertiary bg-tertiary/10",
  },
  regulatory: { label: "Regulatory", color: "text-tertiary border-tertiary bg-tertiary/10" },
  operational: { label: "Operational", color: "text-primary border-primary bg-primary/10" },
  "change-management": {
    label: "Change Mgmt",
    color: "text-on-surface-variant border-border-muted",
  },
};
