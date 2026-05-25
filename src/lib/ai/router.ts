import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/db";
import { AIControlMode } from "@prisma/client";
import type { AIProvider, ChatMessage, AIChatRequest } from "@/schemas/ai";

// ── Governance system prompt — injected on every NexoriOS AI call ─────────────
const GOVERNANCE_SYSTEM_PROMPT =
  "You are a governance evidence assistant for a regulated financial organisation. " +
  "Only use retrieved context to answer. If context is insufficient, say so explicitly. " +
  "Never invent governance evidence. Cite all source IDs.";

// ── Blocked AI control modes ──────────────────────────────────────────────────
const BLOCKED_MODES = new Set<AIControlMode>([
  AIControlMode.HUMAN_ONLY,
  AIControlMode.EMERGENCY_LOCK,
]);

export interface AIRouterResponse {
  content: string;
  provider: AIProvider;
  model: string;
  tokensIn: number;
  tokensOut: number;
  usageEventId: string;
}

export class AIBlockedError extends Error {
  constructor(
    public readonly mode: AIControlMode,
    message: string
  ) {
    super(message);
    this.name = "AIBlockedError";
  }
}

// ── Resolve effective provider + model from request or env defaults ───────────
function resolveProvider(req: AIChatRequest): { provider: AIProvider; model: string } {
  const provider = req.provider ?? (process.env.AI_DEFAULT_PROVIDER as AIProvider) ?? "anthropic";
  const defaultModel =
    provider === "anthropic"
      ? (process.env.ANTHROPIC_MODEL_FAST ?? "claude-haiku-4-5-20251001")
      : (process.env.AI_DEFAULT_MODEL ?? "gpt-4o-mini");
  return { provider, model: req.model ?? defaultModel };
}

// ── Check project AI control mode ─────────────────────────────────────────────
async function checkControlMode(projectId: string | undefined): Promise<AIControlMode> {
  if (!projectId) return AIControlMode.AI_ASSIST;
  const setting = await prisma.aIControlSetting.findUnique({
    where: { projectId },
    select: { mode: true },
  });
  return setting?.mode ?? AIControlMode.AI_ASSIST;
}

// ── Call OpenAI ───────────────────────────────────────────────────────────────
async function callOpenAI(
  model: string,
  messages: ChatMessage[],
  maxTokens: number
): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Prepend governance system prompt if no system message already present
  const hasSystem = messages.some((m) => m.role === "system");
  const effectiveMessages = hasSystem
    ? messages
    : [{ role: "system" as const, content: GOVERNANCE_SYSTEM_PROMPT }, ...messages];

  const response = await client.chat.completions.create({
    model,
    messages: effectiveMessages,
    max_tokens: maxTokens,
  });

  const choice = response.choices[0];
  return {
    content: choice.message.content ?? "",
    tokensIn: response.usage?.prompt_tokens ?? 0,
    tokensOut: response.usage?.completion_tokens ?? 0,
  };
}

// ── Call Anthropic ────────────────────────────────────────────────────────────
async function callAnthropic(
  model: string,
  messages: ChatMessage[],
  maxTokens: number
): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Anthropic uses a top-level system param — extract from messages if present
  const systemMsg = messages.find((m) => m.role === "system");
  const system = systemMsg?.content ?? GOVERNANCE_SYSTEM_PROMPT;
  const userMessages = messages.filter((m) => m.role !== "system") as Array<{
    role: "user" | "assistant";
    content: string;
  }>;

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: userMessages,
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return {
    content: textBlock?.type === "text" ? textBlock.text : "",
    tokensIn: response.usage.input_tokens,
    tokensOut: response.usage.output_tokens,
  };
}

// ── Main router — governance middleware built in ───────────────────────────────
export async function routeAI(req: AIChatRequest): Promise<AIRouterResponse> {
  const { provider, model } = resolveProvider(req);
  const maxTokens = req.maxTokens ?? Number(process.env.AI_MAX_TOKENS_PER_REQUEST ?? 4096);

  // 1. Governance gate: check AI control mode
  const mode = await checkControlMode(req.projectId);
  if (BLOCKED_MODES.has(mode)) {
    // Log the blocked attempt
    const event = await prisma.aIUsageEvent.create({
      data: {
        projectId: req.projectId,
        sessionId: req.sessionId,
        model,
        mode,
        action: req.action,
        query: req.messages.at(-1)?.content?.slice(0, 500),
        chunkIds: [],
        tokensIn: 0,
        tokensOut: 0,
        outcome: "blocked",
        blockedReason: `${mode} — AI calls are disabled for this project`,
      },
    });
    throw new AIBlockedError(
      mode,
      `AI is blocked: project is in ${mode} mode. UsageEvent: ${event.id}`
    );
  }

  // 2. Call the selected provider
  let result: { content: string; tokensIn: number; tokensOut: number };
  let outcome: "success" | "error" = "success";
  let errorMessage: string | undefined;

  try {
    result =
      provider === "anthropic"
        ? await callAnthropic(model, req.messages, maxTokens)
        : await callOpenAI(model, req.messages, maxTokens);
  } catch (err) {
    outcome = "error";
    errorMessage = err instanceof Error ? err.message : String(err);
    result = { content: "", tokensIn: 0, tokensOut: 0 };
  }

  // 3. Governance log — every AI call, no exceptions (CLAUDE.md §6 + §9)
  const event = await prisma.aIUsageEvent.create({
    data: {
      projectId: req.projectId,
      sessionId: req.sessionId,
      model,
      mode,
      action: req.action,
      query: req.messages.at(-1)?.content?.slice(0, 500),
      chunkIds: [],
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      outcome,
      blockedReason: errorMessage,
    },
  });

  if (outcome === "error") {
    throw new Error(`AI provider error: ${errorMessage} — logged as ${event.id}`);
  }

  return {
    content: result.content,
    provider,
    model,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    usageEventId: event.id,
  };
}
