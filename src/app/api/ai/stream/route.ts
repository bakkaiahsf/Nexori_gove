import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import prisma from "@/lib/db";
import { AIControlMode } from "@prisma/client";
import { AIChatRequestSchema } from "@/schemas/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const GOVERNANCE_SYSTEM_PROMPT =
  "You are a governance evidence assistant for a regulated financial organisation. " +
  "Only use retrieved context to answer. If context is insufficient, say so explicitly. " +
  "Never invent governance evidence. Cite all source IDs.";

const BLOCKED_MODES = new Set<AIControlMode>([
  AIControlMode.HUMAN_ONLY,
  AIControlMode.EMERGENCY_LOCK,
]);

function enc(obj: unknown) {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("data: " + JSON.stringify({ error: "Invalid JSON" }) + "\n\n", {
      status: 400,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const parsed = AIChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response("data: " + JSON.stringify({ error: "Validation failed" }) + "\n\n", {
      status: 400,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const data = parsed.data;
  const provider =
    data.provider ?? (process.env.AI_DEFAULT_PROVIDER as "openai" | "anthropic") ?? "anthropic";
  const model =
    data.model ??
    (provider === "anthropic"
      ? (process.env.ANTHROPIC_MODEL_FAST ?? "claude-haiku-4-5-20251001")
      : (process.env.AI_DEFAULT_MODEL ?? "gpt-4o-mini"));
  const maxTokens = data.maxTokens ?? 2048;

  // Governance mode check
  const setting = data.projectId
    ? await prisma.aIControlSetting.findUnique({
        where: { projectId: data.projectId },
        select: { mode: true },
      })
    : null;
  const mode = (setting?.mode ?? AIControlMode.AI_ASSIST) as AIControlMode;

  if (BLOCKED_MODES.has(mode)) {
    await prisma.aIUsageEvent.create({
      data: {
        projectId: data.projectId,
        model,
        mode,
        action: data.action,
        query: data.messages.at(-1)?.content?.slice(0, 500),
        chunkIds: [],
        tokensIn: 0,
        tokensOut: 0,
        outcome: "blocked",
        blockedReason: `${mode} — AI disabled`,
      },
    });

    const stream = new ReadableStream({
      start(c) {
        c.enqueue(enc({ error: "AI blocked by governance policy", mode, blocked: true }));
        c.close();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  const hasSystem = data.messages.some((m) => m.role === "system");
  const messagesWithSystem = hasSystem
    ? data.messages
    : [{ role: "system" as const, content: GOVERNANCE_SYSTEM_PROMPT }, ...data.messages];

  // AbortController lets us cancel the upstream Anthropic call when the client disconnects
  const abort = new AbortController();

  const readable = new ReadableStream({
    async start(controller) {
      let tokensIn = 0;
      let tokensOut = 0;
      let fullText = "";
      let outcome: "success" | "error" = "success";
      let errorMsg: string | undefined;

      // Safe enqueue — silently drops if the client has already disconnected
      function safeEnqueue(obj: unknown) {
        try { controller.enqueue(enc(obj)); } catch { /* client gone */ }
      }

      try {
        if (provider === "anthropic") {
          const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

          const systemMessages = messagesWithSystem.filter((m) => m.role === "system");
          const userMessages = messagesWithSystem.filter((m) => m.role !== "system");
          const systemText = systemMessages.map((m) => m.content).join("\n\n");

          const stream = client.messages.stream({
            model,
            max_tokens: maxTokens,
            system: systemText || GOVERNANCE_SYSTEM_PROMPT,
            messages: userMessages.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
          });

          // Abort the upstream call when the client disconnects
          abort.signal.addEventListener("abort", () => stream.abort());

          for await (const event of stream) {
            if (abort.signal.aborted) break;
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              const chunk = event.delta.text;
              fullText += chunk;
              safeEnqueue({ chunk });
            }
          }

          if (!abort.signal.aborted) {
            const finalMsg = await stream.finalMessage();
            tokensIn = finalMsg.usage.input_tokens;
            tokensOut = finalMsg.usage.output_tokens;
          }
        } else {
          // OpenAI streaming
          const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          const response = await client.chat.completions.create({
            model,
            messages: messagesWithSystem,
            max_tokens: maxTokens,
            stream: true,
          });

          for await (const chunk of response) {
            if (abort.signal.aborted) break;
            const text = chunk.choices[0]?.delta?.content ?? "";
            if (text) {
              fullText += text;
              safeEnqueue({ chunk: text });
            }
            if (chunk.usage) {
              tokensIn = chunk.usage.prompt_tokens;
              tokensOut = chunk.usage.completion_tokens;
            }
          }
        }
      } catch (err) {
        // Ignore abort errors — client intentionally closed connection
        const isAbort =
          err instanceof Error && (err.name === "AbortError" || err.message.includes("abort"));
        if (!isAbort) {
          outcome = "error";
          errorMsg = err instanceof Error ? err.message : String(err);
          safeEnqueue({ error: errorMsg });
        } else {
          outcome = "error";
          errorMsg = "aborted";
        }
      }

      // Governance audit log — always written, even on abort/error
      let usageEventId: string | undefined;
      try {
        const event = await prisma.aIUsageEvent.create({
          data: {
            projectId: data.projectId,
            sessionId: data.sessionId,
            model,
            mode,
            action: data.action,
            query: data.messages.at(-1)?.content?.slice(0, 500),
            chunkIds: [],
            tokensIn,
            tokensOut,
            outcome,
            blockedReason: errorMsg,
          },
        });
        usageEventId = event.id;
      } catch {
        // DB log failure must not kill the response
      }

      safeEnqueue({ done: true, usageEventId, tokensIn, tokensOut });
      try { controller.close(); } catch { /* already closed */ }
    },
    cancel() {
      // Client disconnected — signal upstream to stop
      abort.abort();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
