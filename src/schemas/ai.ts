import { z } from "zod";

export const AIProviderSchema = z.enum(["openai", "anthropic"]);

export const ChatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1),
});

export const AIChatRequestSchema = z.object({
  provider: AIProviderSchema.optional(),
  model: z.string().optional(),
  messages: z.array(ChatMessageSchema).min(1),
  action: z.string().min(1).max(100),
  projectId: z.string().cuid().optional(),
  sessionId: z.string().optional(),
  maxTokens: z.number().int().min(1).max(8192).optional(),
});

export type AIProvider = z.infer<typeof AIProviderSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type AIChatRequest = z.infer<typeof AIChatRequestSchema>;

// ── Connector schemas ─────────────────────────────────────────────────────────
export const SourceConnectorCreateSchema = z.object({
  type: z.enum(["jira", "linear", "github", "azure-devops", "servicenow"]),
  name: z.string().min(1).max(100),
  baseUrl: z.string().url(),
  credentials: z.object({
    email: z.string().email(),
    apiToken: z.string().min(1),
  }),
  webhookSecret: z.string().optional(),
  projectKeys: z.array(z.string()).min(1),
  fieldMapping: z.record(z.string()).optional(),
  tenantId: z.string().optional(),
});

export type SourceConnectorCreate = z.infer<typeof SourceConnectorCreateSchema>;

// ── Policy document schemas ───────────────────────────────────────────────────
export const PolicyDocumentCreateSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(["internal-policy", "sop", "risk-appetite", "regulatory-guidance"]),
  content: z.string().min(10),
  version: z.string().optional(),
  effectiveAt: z.string().datetime().optional(),
  uploadedBy: z.string().email(),
  tenantId: z.string().optional(),
});

export type PolicyDocumentCreate = z.infer<typeof PolicyDocumentCreateSchema>;

// ── Classification request (preview — no DB writes) ───────────────────────────
export const ClassificationRequestSchema = z.object({
  projectId: z.string().cuid(),
  epicKey: z.string().min(1),
  epicTitle: z.string().min(1),
  epicDescription: z.string().optional(),
  labels: z.array(z.string()).optional(),
  components: z.array(z.string()).optional(),
  environment: z.string().optional(),
  dataClassification: z.string().optional(),
  aiSystemInvolved: z.boolean().optional(),
  thirdPartyChanges: z.boolean().optional(),
  infrastructureChange: z.boolean().optional(),
  regulatoryFrameworks: z.array(z.string()).optional(),
  jurisdiction: z.string().optional(),
  tenantId: z.string().optional(),
});

export type ClassificationRequest = z.infer<typeof ClassificationRequestSchema>;

// ── Waiver schemas ────────────────────────────────────────────────────────────
export const WaiverRequestSchema = z.object({
  projectId: z.string().cuid(),
  caseId: z.string().cuid().optional(),
  gateId: z.string().cuid().optional(),
  requestedBy: z.string().email(),
  waiverType: z.enum(["emergency", "time-limited", "risk-accepted", "expedited-path"]),
  reason: z.string().min(10).max(2000),
});

export type WaiverRequestInput = z.infer<typeof WaiverRequestSchema>;

// ── Expert profile schemas ────────────────────────────────────────────────────
export const ExpertProfileCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  domains: z.array(z.string()).min(1),
  jurisdictions: z.array(z.string()).min(1),
  tenantId: z.string().optional(),
});

export type ExpertProfileCreate = z.infer<typeof ExpertProfileCreateSchema>;

// ── Gate definition schemas ───────────────────────────────────────────────────
export const GateDefinitionCreateSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  category: z.string().min(1),
  defaultSlaHours: z.number().int().min(1).max(720),
  intensityTriggers: z.array(z.enum(["minimal", "standard", "regulated", "enhanced"])).min(1),
  skipConditions: z
    .array(
      z.object({
        field: z.string(),
        op: z.enum(["eq", "neq", "lt", "gt", "notContains", "notIn"]),
        value: z.unknown(),
      })
    )
    .optional(),
  requiredEvidence: z.array(z.string()).optional(),
  approverRoles: z.array(z.string()).min(1),
  tenantId: z.string().optional(),
});

export type GateDefinitionCreate = z.infer<typeof GateDefinitionCreateSchema>;
