"use client";

import { useState } from "react";

interface Props {
  caseId: string;
  gateId?: string;
  gateName?: string;
  triggerLabel?: string;
}

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(
      /^#{1,3} (.+)$/gm,
      '<p class="font-body-bold text-body-bold text-on-surface mt-md mb-xs">$1</p>'
    )
    .replace(/^- (.+)$/gm, '<li class="ml-md list-disc">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-md list-decimal">$2</li>')
    .replace(/\n\n/g, '<p class="mt-sm"></p>');
}

export default function AiReviewPanel({
  caseId,
  gateId,
  gateName,
  triggerLabel = "Readiness Advisor — What's Missing?",
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runReview() {
    setLoading(true);
    setError(null);
    setReview(null);
    try {
      const res = await fetch("/api/ai/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, gateId, gateName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Review failed");
      setReview(data.review);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
    setLoading(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setOpen(true);
          if (!review) runReview();
        }}
        className="flex items-center gap-sm px-md py-sm border border-primary/40 text-primary font-mono-technical text-[10px] hover:bg-primary/10 transition-colors"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
          psychology
        </span>
        {triggerLabel}
      </button>
    );
  }

  return (
    <div className="border border-primary/30 bg-surface-container-low">
      <div className="flex items-center justify-between px-lg py-md border-b border-border-muted">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>
            psychology
          </span>
          <span className="font-label-caps text-label-caps text-primary tracking-widest text-[10px]">
            READINESS ADVISOR
          </span>
          {gateName && (
            <span className="font-mono-technical text-[10px] text-on-surface-variant">
              · {gateName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-md">
          <button
            onClick={runReview}
            disabled={loading}
            className="font-mono-technical text-[10px] text-primary hover:underline disabled:opacity-50"
          >
            {loading ? "REVIEWING..." : "REFRESH"}
          </button>
          <button
            onClick={() => setOpen(false)}
            className="font-mono-technical text-[10px] text-on-surface-variant hover:text-on-surface"
          >
            CLOSE
          </button>
        </div>
      </div>

      <div className="px-lg py-md min-h-[120px]">
        {loading && (
          <div className="flex items-center gap-sm text-primary">
            <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>
              progress_activity
            </span>
            <span className="font-mono-technical text-[11px]">
              Analysing governance evidence...
            </span>
          </div>
        )}

        {error && <p className="font-mono-technical text-[11px] text-critical">{error}</p>}

        {review && !loading && (
          <div
            className="font-body-base text-body-base text-on-surface text-[12px] leading-relaxed space-y-xs"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(review) }}
          />
        )}
      </div>

      <div className="px-lg py-xs border-t border-border-muted">
        <p className="font-mono-technical text-[9px] text-on-surface-variant">
          READINESS ADVISOR · SOURCE: CASE_CONTEXT + EVIDENCE_ITEMS · LOGGED AS AI_USAGE_EVENT
        </p>
      </div>
    </div>
  );
}
