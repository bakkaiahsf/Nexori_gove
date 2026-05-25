import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { AIControlMode, RegulatoryFramework } from "@prisma/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const AnalyzeSchema = z.object({
  title: z.string().max(500),
  description: z.string().max(2000).optional(),
  issueType: z.string().optional(),
  labels: z.array(z.string()).default([]),
  components: z.array(z.string()).default([]),
  domain: z.string().optional(),
  source: z.enum(["jira", "github", "gitlab", "manual"]).default("manual"),
});

type Suggestion = {
  suggestedTemplate: string;
  suggestedFrameworks: RegulatoryFramework[];
  suggestedAiMode: AIControlMode;
  riskFactors: string[];
  rationale: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
};

const VALID_TEMPLATES = [
  "agile-delivery",
  "ai-deployment",
  "regulatory-change",
  "third-party-onboarding",
  "data-infrastructure",
  "custom",
];

const VALID_AI_MODES: AIControlMode[] = [
  AIControlMode.HUMAN_ONLY,
  AIControlMode.AI_ASSIST,
  AIControlMode.AI_REVIEW,
  AIControlMode.AI_CONTROLLED_ACTION,
];

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = AnalyzeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { title, description, issueType, labels, components, domain } = parsed.data;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(fallbackSuggestion(domain, labels, issueType));
  }

  try {
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: `You are a governance intelligence engine for regulated enterprises (banking, insurance, fintech).
Analyse change metadata and return governance recommendations as JSON only.
Template IDs: agile-delivery, ai-deployment, regulatory-change, third-party-onboarding, data-infrastructure, custom
Frameworks (use exact enum names): DORA, EU_AI_ACT, SOC2, ISO_27001, PCI_DSS, GDPR
AI modes (use exact enum names): HUMAN_ONLY, AI_ASSIST, AI_REVIEW, AI_CONTROLLED_ACTION
Return ONLY valid JSON. No markdown. No explanation outside the JSON object.`,
      messages: [
        {
          role: "user",
          content: `Analyse and return JSON:
Title: ${title}
Description: ${description?.slice(0, 500) ?? "N/A"}
Issue Type: ${issueType ?? "Unknown"}
Labels: ${labels.join(", ") || "none"}
Components: ${components.join(", ") || "none"}
Industry Domain: ${domain ?? "unknown"}

Return exactly:
{
  "suggestedTemplate": "<template-id>",
  "suggestedFrameworks": ["FRAMEWORK1"],
  "suggestedAiMode": "AI_MODE",
  "riskFactors": ["risk1", "risk2"],
  "rationale": "<2-3 sentence explanation>",
  "confidence": "HIGH"
}`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "{}";
    const jsonMatch = /\{[\s\S]*\}/.exec(text);
    if (!jsonMatch) throw new Error("No JSON in response");

    const raw = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    const suggestedTemplate =
      typeof raw.suggestedTemplate === "string" && VALID_TEMPLATES.includes(raw.suggestedTemplate)
        ? raw.suggestedTemplate
        : fallbackTemplateid(domain, labels, issueType);

    const suggestedFrameworks = Array.isArray(raw.suggestedFrameworks)
      ? (raw.suggestedFrameworks as string[]).filter((f): f is RegulatoryFramework =>
          Object.values(RegulatoryFramework).includes(f as RegulatoryFramework)
        )
      : [];

    const suggestedAiMode =
      typeof raw.suggestedAiMode === "string" &&
      VALID_AI_MODES.includes(raw.suggestedAiMode as AIControlMode)
        ? (raw.suggestedAiMode as AIControlMode)
        : AIControlMode.AI_ASSIST;

    const result: Suggestion = {
      suggestedTemplate,
      suggestedFrameworks,
      suggestedAiMode,
      riskFactors: Array.isArray(raw.riskFactors) ? (raw.riskFactors as string[]).slice(0, 5) : [],
      rationale: typeof raw.rationale === "string" ? raw.rationale : "",
      confidence: ["HIGH", "MEDIUM", "LOW"].includes(raw.confidence as string)
        ? (raw.confidence as "HIGH" | "MEDIUM" | "LOW")
        : "MEDIUM",
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(fallbackSuggestion(domain, labels, issueType));
  }
}

function fallbackTemplateid(domain?: string, labels?: string[], issueType?: string): string {
  const text = `${domain ?? ""} ${(labels ?? []).join(" ")} ${issueType ?? ""}`.toLowerCase();
  if (/\bai\b|ml|model|llm|gpt|neural|algorithm/.test(text)) return "ai-deployment";
  if (/vendor|third.party|supplier|onboard|ict.provider/.test(text))
    return "third-party-onboarding";
  if (/data|gdpr|pci|privacy|database|pipeline/.test(text)) return "data-infrastructure";
  if (/dora|regulatory|portfolio|programme|program|compliance|regulation/.test(text))
    return "regulatory-change";
  return "agile-delivery";
}

function fallbackSuggestion(domain?: string, labels?: string[], issueType?: string): Suggestion {
  const tpl = fallbackTemplateid(domain, labels, issueType);
  const frameMap: Record<string, RegulatoryFramework[]> = {
    "ai-deployment": [
      RegulatoryFramework.EU_AI_ACT,
      RegulatoryFramework.DORA,
      RegulatoryFramework.ISO_27001,
    ],
    "third-party-onboarding": [RegulatoryFramework.DORA, RegulatoryFramework.ISO_27001],
    "data-infrastructure": [
      RegulatoryFramework.GDPR,
      RegulatoryFramework.PCI_DSS,
      RegulatoryFramework.ISO_27001,
    ],
    "regulatory-change": [
      RegulatoryFramework.DORA,
      RegulatoryFramework.ISO_27001,
      RegulatoryFramework.SOC2,
    ],
    "agile-delivery": [RegulatoryFramework.SOC2],
    custom: [],
  };
  return {
    suggestedTemplate: tpl,
    suggestedFrameworks: frameMap[tpl] ?? [],
    suggestedAiMode: AIControlMode.AI_ASSIST,
    riskFactors: [],
    rationale: "Rule-based recommendation derived from available metadata.",
    confidence: "LOW",
  };
}
