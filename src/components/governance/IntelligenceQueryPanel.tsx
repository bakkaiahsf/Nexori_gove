"use client";

import { useState, useRef, useEffect } from "react";

interface QueryResult {
  answer: string;
  citedChunkIds: string[];
  mode: string;
  tokensUsed: number;
  usageEventId?: string;
}

const SUGGESTED_QUESTIONS = [
  "What DORA controls apply to an AI system deployment in the EU?",
  "Which governance gates are required for a production infrastructure change?",
  "What evidence do I need for a SOC 2 Type II audit trail?",
  "How does DORA Article 28 apply to a new third-party AI provider?",
  "What is the escalation path when a CAB approval gate is rejected?",
  "Summarise the regulatory posture of this project.",
  "What internal governance steps are required before a sprint release?",
  "How should we handle a critical vulnerability found post-deployment?",
];

function Icon({
  name,
  size = 18,
  fill = false,
  className = "",
}: {
  name: string;
  size?: number;
  fill?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`material-symbols-outlined select-none leading-none ${className}`}
      style={{ fontSize: size, fontVariationSettings: fill ? "'FILL' 1" : "'FILL' 0" }}
    >
      {name}
    </span>
  );
}

// ─── streaming fetch helper ───────────────────────────────────────────────────

async function streamQuery(
  q: string,
  projectId: string,
  onChunk: (text: string) => void,
  signal: AbortSignal
): Promise<{ tokensUsed: number; usageEventId?: string }> {
  const res = await fetch("/api/ai/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      action: "governance-intelligence-query",
      projectId,
      messages: [
        {
          role: "system",
          content:
            "You are a governance intelligence assistant for a regulated financial enterprise. " +
            "Cover both internal governance (internal policies, agile delivery gates, sprint governance, " +
            "change management, release readiness) and external compliance (DORA, EU AI Act, SOC 2, " +
            "GDPR, ISO 27001, PCI-DSS). " +
            "Answer clearly with sections where helpful. " +
            "Cite all source IDs you reference. Never invent governance evidence. " +
            "If context is insufficient, say so explicitly.",
        },
        { role: "user", content: q.trim() },
      ],
      maxTokens: 2048,
    }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let tokensUsed = 0;
  let usageEventId: string | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const parsed = JSON.parse(line.slice(6)) as {
          chunk?: string;
          done?: boolean;
          error?: string;
          blocked?: boolean;
          tokensIn?: number;
          tokensOut?: number;
          usageEventId?: string;
        };

        if (parsed.error) throw new Error(parsed.error);
        if (parsed.chunk) onChunk(parsed.chunk);
        if (parsed.done) {
          tokensUsed = (parsed.tokensIn ?? 0) + (parsed.tokensOut ?? 0);
          usageEventId = parsed.usageEventId;
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }

  return { tokensUsed, usageEventId };
}

// ─── component ────────────────────────────────────────────────────────────────

export default function IntelligenceQueryPanel({
  projectId,
  aiMode,
}: {
  projectId: string;
  aiMode: string;
}) {
  const [query, setQuery] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ query: string; result: QueryResult }>>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isBlocked = aiMode === "HUMAN_ONLY" || aiMode === "EMERGENCY_LOCK";

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [query]);

  function stop() {
    abortRef.current?.abort();
    setStreaming(false);
  }

  async function submit(q: string) {
    if (!q.trim() || streaming || isBlocked) return;
    setStreaming(true);
    setError(null);
    setResult(null);
    setStreamedText("");

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    let accText = "";

    try {
      const { tokensUsed, usageEventId } = await streamQuery(
        q,
        projectId,
        (chunk) => {
          accText += chunk;
          setStreamedText(accText);
        },
        ctrl.signal
      );

      const queryResult: QueryResult = {
        answer: accText,
        citedChunkIds: [],
        mode: aiMode,
        tokensUsed,
        usageEventId,
      };
      setResult(queryResult);
      setStreamedText("");
      setHistory((prev) => [{ query: q.trim(), result: queryResult }, ...prev.slice(0, 4)]);
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setStreamedText("");
        setError(null);
      } else {
        setError(e instanceof Error ? e.message : "Network error. Please retry.");
      }
    } finally {
      setStreaming(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      void submit(query);
    }
  }

  const displayText = streaming ? streamedText : (result?.answer ?? "");
  const showResponse = streaming ? streamedText.length > 0 : !!result;

  return (
    <div className="col-span-12 bg-surface border border-border-muted">
      {/* Header */}
      <div className="px-xl py-lg border-b border-border-muted flex items-center justify-between">
        <div className="flex items-center gap-md">
          <div className="w-8 h-8 bg-primary/10 border border-primary flex items-center justify-center">
            <Icon name="psychology" size={16} className="text-primary" />
          </div>
          <div>
            <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
              GOVERNANCE INTELLIGENCE
            </h3>
            <p className="font-mono-technical text-[10px] text-on-surface-variant">
              Internal &amp; External · RAG-cited · Mode-enforced · Real-time streaming
            </p>
          </div>
        </div>
        <div className="flex items-center gap-md">
          {streaming && (
            <span className="flex items-center gap-xs font-mono-technical text-[10px] text-primary animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              STREAMING
            </span>
          )}
          {isBlocked ? (
            <span className="px-2 py-0.5 bg-critical/10 text-critical border border-critical font-mono-technical text-[10px]">
              AI BLOCKED · {aiMode.replace(/_/g, " ")}
            </span>
          ) : (
            <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary font-mono-technical text-[10px]">
              {aiMode.replace(/_/g, " ")}
            </span>
          )}
        </div>
      </div>

      <div className="p-xl grid grid-cols-12 gap-lg">
        {/* Left: query + response */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-lg">
          {/* Query input */}
          <div
            className={`border ${isBlocked ? "border-critical/30 bg-critical/5" : "border-primary/30 bg-primary/5"}`}
          >
            <textarea
              ref={textareaRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKey}
              disabled={isBlocked || streaming}
              placeholder={
                isBlocked
                  ? "AI is currently blocked by governance policy. Contact your administrator."
                  : "Ask a governance question… internal policies, compliance, gate requirements, agile governance…"
              }
              className="w-full bg-transparent p-lg font-body-base text-body-base text-on-surface placeholder:text-on-surface-variant/50 resize-none outline-none min-h-[80px] max-h-[200px] disabled:opacity-50 disabled:cursor-not-allowed"
              rows={3}
            />
            <div className="px-lg py-md border-t border-primary/20 flex items-center justify-between">
              <span className="font-mono-technical text-[10px] text-on-surface-variant">
                {query.length > 0 ? `${query.length} chars · ` : ""}⌘↵ to submit
              </span>
              <div className="flex items-center gap-sm">
                {streaming && (
                  <button
                    onClick={stop}
                    className="flex items-center gap-sm px-md py-sm border border-critical text-critical font-mono-technical text-[11px] hover:bg-critical/10 transition-colors"
                  >
                    <Icon name="stop" size={12} className="text-critical" />
                    STOP
                  </button>
                )}
                <button
                  onClick={() => void submit(query)}
                  disabled={!query.trim() || streaming || isBlocked}
                  className="flex items-center gap-sm px-lg py-sm bg-primary text-background font-mono-technical text-[11px] hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {streaming ? (
                    <>
                      <span className="w-3 h-3 border border-background/40 border-t-background rounded-full animate-spin" />
                      STREAMING
                    </>
                  ) : (
                    <>
                      <Icon name="send" size={14} className="text-background" />
                      QUERY INTELLIGENCE
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="border border-critical/30 bg-critical/5 p-lg flex items-start gap-md">
              <Icon name="error" size={16} className="text-critical shrink-0 mt-0.5" />
              <div>
                <p className="font-mono-technical text-[11px] text-critical">{error}</p>
                <button
                  onClick={() => {
                    setError(null);
                    void submit(query);
                  }}
                  className="mt-sm font-mono-technical text-[10px] text-primary hover:underline"
                >
                  RETRY →
                </button>
              </div>
            </div>
          )}

          {/* Streaming / result response */}
          {showResponse && (
            <div className="border border-primary/20 bg-surface-container-low">
              <div className="px-lg py-md border-b border-primary/20 flex items-center justify-between">
                <span className="font-mono-technical text-[10px] text-primary flex items-center gap-sm">
                  <Icon name="auto_awesome" size={12} className="text-primary" />
                  INTELLIGENCE RESPONSE
                </span>
                <div className="flex items-center gap-md">
                  {streaming && (
                    <span className="font-mono-technical text-[10px] text-primary animate-pulse">
                      GENERATING…
                    </span>
                  )}
                  {!streaming && result && result.tokensUsed > 0 && (
                    <span className="font-mono-technical text-[10px] text-on-surface-variant">
                      {result.tokensUsed} TOKENS
                    </span>
                  )}
                  {!streaming && result?.usageEventId && (
                    <span
                      className="font-mono-technical text-[10px] text-on-surface-variant"
                      title={result.usageEventId}
                    >
                      LOGGED ✓
                    </span>
                  )}
                </div>
              </div>
              <div className="p-lg">
                <p className="font-body-base text-body-base text-on-surface leading-relaxed whitespace-pre-wrap">
                  {displayText}
                  {streaming && (
                    <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse align-middle" />
                  )}
                </p>
              </div>
            </div>
          )}

          {/* History */}
          {history.length > 1 && (
            <div className="space-y-sm">
              <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">
                RECENT QUERIES
              </p>
              {history.slice(1).map((h, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setQuery(h.query);
                    setResult(h.result);
                    setError(null);
                    setStreamedText("");
                  }}
                  className="w-full text-left px-lg py-sm border border-border-muted hover:border-primary transition-colors"
                >
                  <p className="font-body-base text-body-base text-on-surface-variant text-[12px] truncate">
                    {h.query}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: suggestions + audit */}
        <div className="col-span-12 lg:col-span-4 space-y-lg">
          {/* Domain tabs */}
          <div>
            <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest mb-md">
              SUGGESTED QUERIES
            </p>
            <div className="space-y-sm">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  disabled={isBlocked || streaming}
                  onClick={() => {
                    setQuery(q);
                    textareaRef.current?.focus();
                  }}
                  className="w-full text-left px-md py-sm border border-border-muted hover:border-primary hover:bg-primary/5 transition-colors group disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <p className="font-body-base text-body-base text-on-surface-variant text-[11px] group-hover:text-on-surface leading-snug">
                    {q}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Coverage */}
          <div className="border border-border-muted p-lg space-y-sm">
            <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">
              INTELLIGENCE COVERAGE
            </p>
            {[
              { label: "Internal Governance", icon: "corporate_fare" },
              { label: "Agile Delivery Gates", icon: "account_tree" },
              { label: "DORA / EU AI Act", icon: "gavel" },
              { label: "SOC 2 / ISO 27001", icon: "verified_user" },
              { label: "GDPR / PCI-DSS", icon: "shield" },
              { label: "Change & Release Governance", icon: "deployed_code_update" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-sm">
                <Icon name={item.icon} size={12} className="text-primary shrink-0" />
                <p className="font-mono-technical text-[10px] text-on-surface-variant">
                  {item.label}
                </p>
              </div>
            ))}
          </div>

          <div className="border border-border-muted p-lg space-y-sm">
            <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">
              AUDIT GUARANTEE
            </p>
            {[
              "Every query logged as AIUsageEvent",
              "Only retrieved policy context used",
              "Real-time streaming — no socket timeout",
              "DORA Art. 13 compliant logging",
              "Mode enforcement: " + aiMode.replace(/_/g, " "),
            ].map((item) => (
              <div key={item} className="flex items-start gap-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <p className="font-mono-technical text-[10px] text-on-surface-variant">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
