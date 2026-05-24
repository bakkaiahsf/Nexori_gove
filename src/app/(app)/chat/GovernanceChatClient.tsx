"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { AIControlMode } from "@prisma/client";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  usageEventId?: string;
  tokensIn?: number;
  tokensOut?: number;
  timestamp: Date;
  isStreaming?: boolean;
}

interface RecentCase {
  id: string;
  title: string;
  phase: string;
  status: string;
}

interface PolicyDoc {
  id: string;
  title: string;
  type: string;
}

const MODE_LABEL: Record<string, string> = {
  HUMAN_ONLY: "HUMAN ONLY",
  AI_ASSIST: "AI ASSIST",
  AI_REVIEW: "AI REVIEW",
  AI_CONTROLLED_ACTION: "AI CONTROLLED",
  AI_GOVERNED: "AI GOVERNED",
  AI_RESTRICTED: "AI RESTRICTED",
  EMERGENCY_LOCK: "EMERGENCY LOCK",
};

const STARTER_QUESTIONS = [
  "What gates are currently blocking release?",
  "Summarise our DORA compliance posture",
  "What AI governance controls are in place?",
  "Which cases have pending approvals?",
  "What does EU AI Act require for this project?",
  "Show waiver status and residual risks",
  "What evidence do we need for our next CAB?",
  "Explain our current risk scoring methodology",
];

function Icon({
  name,
  size = 16,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`material-symbols-outlined select-none leading-none ${className}`}
      style={{ fontSize: size }}
    >
      {name}
    </span>
  );
}

export default function GovernanceChatClient({
  projectId,
  projectName,
  currentMode,
  isLocked,
  recentCases,
  activePolicies,
}: {
  projectId: string | null;
  projectName: string;
  currentMode: AIControlMode;
  isLocked: boolean;
  recentCases: RecentCase[];
  activePolicies: PolicyDoc[];
}) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(query: string) {
    if (!query.trim() || streaming || isLocked) return;
    setInput("");
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: query.trim(),
      timestamp: new Date(),
    };
    const assistantId = crypto.randomUUID();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const systemContext = [
        `You are the NexoriOS Governance Intelligence assistant for ${projectName}.`,
        `You help governance teams understand compliance posture, case status, gate requirements, and regulatory obligations.`,
        `Current AI control mode: ${currentMode.replace(/_/g, " ")}.`,
        recentCases.length > 0
          ? `Recent governance cases: ${recentCases.map((c) => `${c.title} (${c.phase}, ${c.status})`).join("; ")}.`
          : "",
        activePolicies.length > 0
          ? `Policy corpus includes: ${activePolicies.map((p) => p.title).join(", ")}.`
          : "",
        `Always cite policy chunk IDs when referencing specific policy content.`,
        `Frameworks: DORA, EU AI Act, SOC2, ISO 27001, PCI-DSS, GDPR.`,
        `Never make staffing, lending, or customer eligibility decisions. Never invent governance evidence.`,
      ]
        .filter(Boolean)
        .join(" ");

      const res = await fetch("/api/ai/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          query: query.trim(),
          systemPrompt: systemContext,
          requestedBy: session?.user?.email ?? "governance@nexori.system",
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: err.error ?? "Request failed. Check AI control mode.",
                  isStreaming: false,
                }
              : m
          )
        );
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += dec.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const payload = JSON.parse(line.slice(6)) as {
              chunk?: string;
              done?: boolean;
              usageEventId?: string;
              tokensIn?: number;
              tokensOut?: number;
              error?: string;
            };
            if (payload.chunk) {
              fullText += payload.chunk;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: fullText, isStreaming: true } : m
                )
              );
            }
            if (payload.done) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content: fullText,
                        isStreaming: false,
                        usageEventId: payload.usageEventId,
                        tokensIn: payload.tokensIn,
                        tokensOut: payload.tokensOut,
                      }
                    : m
                )
              );
            }
            if (payload.error) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: payload.error!, isStreaming: false } : m
                )
              );
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: "Connection error. Please try again.", isStreaming: false }
              : m
          )
        );
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
    setStreaming(false);
    setMessages((prev) => prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  return (
    <>
      {/* Header */}
      <header className="h-16 px-xl flex items-center justify-between border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <div className="flex items-center gap-md">
          <h1 className="font-headline-md text-headline-md text-on-surface">
            Governance AI Assistant
          </h1>
          <span className="px-2 py-0.5 font-mono-technical text-[9px] border border-primary text-primary bg-primary/10">
            {projectName}
          </span>
        </div>
        <div className="flex items-center gap-md">
          <span
            className={`px-2 py-1 font-mono-technical text-[10px] border ${
              isLocked
                ? "border-critical text-critical bg-critical/10 animate-pulse"
                : "border-primary text-primary bg-primary/10"
            }`}
          >
            {MODE_LABEL[currentMode] ?? currentMode}
          </span>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="font-mono-technical text-[10px] text-on-surface-variant hover:text-on-surface border border-border-muted px-md py-xs"
            >
              CLEAR
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Chat area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-xl space-y-lg">
            {messages.length === 0 ? (
              <div className="max-w-[720px] mx-auto space-y-xl pt-xl">
                <div className="text-center space-y-md">
                  <div className="w-16 h-16 bg-primary/10 border border-primary flex items-center justify-center mx-auto">
                    <Icon name="psychology" size={32} className="text-primary" />
                  </div>
                  <h2 className="font-headline-md text-headline-md text-on-surface">
                    Governance Intelligence
                  </h2>
                  <p className="font-mono-technical text-[12px] text-on-surface-variant max-w-[480px] mx-auto leading-relaxed">
                    Ask anything about governance posture, compliance requirements, case status,
                    gate requirements, or regulatory obligations. All responses are RAG-grounded and
                    logged as AIUsageEvents.
                  </p>
                </div>

                {isLocked && (
                  <div className="border border-critical/50 bg-critical/5 p-lg text-center space-y-xs">
                    <Icon name="lock" size={20} className="text-critical mx-auto block" />
                    <p className="font-mono-technical text-[11px] text-critical">
                      AI GOVERNANCE LOCKED — Mode: {MODE_LABEL[currentMode]}
                    </p>
                    <p className="font-mono-technical text-[10px] text-on-surface-variant">
                      Change AI control mode in the AI Control Center to enable responses.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-sm">
                  {STARTER_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => void send(q)}
                      disabled={isLocked}
                      className="text-left p-md border border-border-muted bg-surface hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <p className="font-mono-technical text-[11px] text-on-surface leading-relaxed">
                        {q}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="max-w-[800px] mx-auto space-y-lg">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-md ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-8 h-8 shrink-0 flex items-center justify-center border ${
                        msg.role === "user"
                          ? "bg-primary/10 border-primary"
                          : "bg-surface-container-low border-border-muted"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <span className="font-mono-technical text-[10px] text-primary">
                          {(session?.user?.name ?? "U")
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>
                      ) : (
                        <Icon name="psychology" size={14} className="text-on-surface-variant" />
                      )}
                    </div>

                    {/* Bubble */}
                    <div
                      className={`flex-1 space-y-xs ${msg.role === "user" ? "items-end flex flex-col" : ""}`}
                    >
                      <div
                        className={`px-lg py-md font-mono-technical text-[12px] leading-relaxed whitespace-pre-wrap ${
                          msg.role === "user"
                            ? "bg-primary/10 border border-primary text-on-surface inline-block max-w-[90%]"
                            : "bg-surface border border-border-muted text-on-surface"
                        }`}
                      >
                        {msg.content}
                        {msg.isStreaming && (
                          <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse align-middle" />
                        )}
                      </div>
                      <div className="flex items-center gap-sm">
                        <span className="font-mono-technical text-[9px] text-on-surface-variant/60">
                          {msg.timestamp.toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {msg.usageEventId && (
                          <span className="font-mono-technical text-[9px] text-primary border border-primary/30 px-1">
                            LOGGED ✓ · {msg.tokensIn}↑ {msg.tokensOut}↓
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Input bar */}
          <div className="border-t border-border-muted p-lg bg-surface">
            <div className="max-w-[800px] mx-auto">
              <div className="flex gap-md items-end">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLocked}
                  placeholder={
                    isLocked
                      ? "AI governance locked — change mode in AI Control Center"
                      : "Ask about governance posture, compliance requirements, case status… (Enter to send)"
                  }
                  rows={2}
                  className="flex-1 bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[12px] text-on-surface resize-none outline-none focus:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {streaming ? (
                  <button
                    onClick={stop}
                    className="shrink-0 px-lg py-sm bg-critical text-on-error font-mono-technical text-[11px] hover:brightness-110 transition-colors"
                  >
                    <Icon name="stop" size={14} className="text-on-error" />
                  </button>
                ) : (
                  <button
                    onClick={() => void send(input)}
                    disabled={!input.trim() || isLocked}
                    className="shrink-0 px-lg py-sm bg-primary text-background font-mono-technical text-[11px] hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Icon name="send" size={14} className="text-background" />
                  </button>
                )}
              </div>
              <p className="font-mono-technical text-[9px] text-on-surface-variant/60 mt-xs">
                All AI responses logged as AIUsageEvents per DORA Art. 28. RAG-grounded against
                policy corpus. Shift+Enter for new line.
              </p>
            </div>
          </div>
        </div>

        {/* Context sidebar */}
        <div className="w-[240px] border-l border-border-muted bg-surface-container-low flex flex-col shrink-0 overflow-y-auto">
          <div className="p-md border-b border-border-muted">
            <p className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest">
              CONTEXT
            </p>
          </div>

          {recentCases.length > 0 && (
            <div className="p-md space-y-xs border-b border-border-muted">
              <p className="font-mono-technical text-[9px] text-on-surface-variant/60 tracking-widest">
                RECENT CASES
              </p>
              {recentCases.map((c) => (
                <a
                  key={c.id}
                  href={`/cases/${c.id}`}
                  className="block p-xs hover:bg-surface-container-highest transition-colors"
                >
                  <p className="font-mono-technical text-[10px] text-on-surface leading-snug truncate">
                    {c.title}
                  </p>
                  <p className="font-mono-technical text-[9px] text-on-surface-variant">
                    {c.phase} · {c.status}
                  </p>
                </a>
              ))}
            </div>
          )}

          {activePolicies.length > 0 && (
            <div className="p-md space-y-xs border-b border-border-muted">
              <p className="font-mono-technical text-[9px] text-on-surface-variant/60 tracking-widest">
                POLICY CORPUS
              </p>
              {activePolicies.map((p) => (
                <div key={p.id} className="p-xs">
                  <p className="font-mono-technical text-[10px] text-on-surface leading-snug truncate">
                    {p.title}
                  </p>
                  <p className="font-mono-technical text-[9px] text-on-surface-variant capitalize">
                    {p.type.replace(/-/g, " ")}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="p-md space-y-xs mt-auto">
            <p className="font-mono-technical text-[9px] text-on-surface-variant/60 tracking-widest">
              COMPLIANCE
            </p>
            {["DORA", "EU AI Act", "SOC2", "ISO 27001", "PCI-DSS", "GDPR"].map((f) => (
              <span
                key={f}
                className="block font-mono-technical text-[9px] text-on-surface-variant border border-border-muted px-xs py-0.5 mb-xs"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
