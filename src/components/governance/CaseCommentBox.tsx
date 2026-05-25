"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Comment {
  id: string;
  authorEmail: string;
  body: string;
  createdAt: string;
}

interface Props {
  caseId: string;
  caseStatus: string;
  ownedBy: string | null;
  comments: Comment[];
}

export default function CaseCommentBox({ caseId, caseStatus, ownedBy, comments }: Props) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [assignEmail, setAssignEmail] = useState(ownedBy ?? "");
  const [showAssign, setShowAssign] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function addComment() {
    if (!body.trim()) return;
    setSubmitting(true);
    try {
      await fetch(`/api/cases/${caseId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim() }),
      });
      setBody("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function doAction(action: "resolve" | "reopen") {
    setActionLoading(action);
    try {
      await fetch(`/api/cases/${caseId}/${action}`, { method: "POST" });
      router.refresh();
    } finally {
      setActionLoading(null);
    }
  }

  async function doAssign() {
    if (!assignEmail.trim()) return;
    setActionLoading("assign");
    try {
      await fetch(`/api/cases/${caseId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownedBy: assignEmail.trim() }),
      });
      setShowAssign(false);
      router.refresh();
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="border border-border-muted bg-surface p-xl space-y-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="font-mono-technical text-[11px] text-on-surface tracking-widest">
          ACTIVITY &amp; COMMENTS
        </p>
        <span className="font-mono-technical text-[10px] text-on-surface-variant">
          {comments.length} COMMENT{comments.length !== 1 ? "S" : ""}
        </span>
      </div>

      {/* Comment list */}
      {comments.length > 0 && (
        <div className="space-y-md border-l-2 border-border-muted pl-lg">
          {comments.map((c) => (
            <div key={c.id} className="space-y-xs">
              <div className="flex items-center gap-md">
                <span className="font-mono-technical text-[10px] text-primary">{c.authorEmail}</span>
                <span className="font-mono-technical text-[9px] text-on-surface-variant">
                  {new Date(c.createdAt).toLocaleString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="font-body-base text-[13px] text-on-surface whitespace-pre-wrap">{c.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* Comment input */}
      <div className="space-y-sm">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment…"
          rows={3}
          className="w-full bg-surface-container border border-border-muted text-on-surface font-body-base text-[13px] p-md resize-none focus:outline-none focus:border-primary transition-colors placeholder:text-on-surface-variant/40"
        />
        <button
          onClick={addComment}
          disabled={submitting || !body.trim()}
          className="px-lg py-sm border border-primary text-primary font-mono-technical text-[10px] hover:bg-primary/10 transition-colors disabled:opacity-40"
        >
          {submitting ? "ADDING…" : "ADD COMMENT"}
        </button>
      </div>

      {/* Lifecycle actions */}
      <div className="border-t border-border-muted pt-lg space-y-sm">
        <p className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest">
          LIFECYCLE ACTIONS
        </p>
        <div className="flex flex-wrap gap-sm items-center">
          {caseStatus === "active" && (
            <button
              onClick={() => doAction("resolve")}
              disabled={actionLoading !== null}
              className="px-lg py-sm border border-primary text-primary font-mono-technical text-[10px] hover:bg-primary/10 transition-colors disabled:opacity-40"
            >
              {actionLoading === "resolve" ? "RESOLVING…" : "RESOLVE CASE"}
            </button>
          )}
          {caseStatus !== "active" && (
            <button
              onClick={() => doAction("reopen")}
              disabled={actionLoading !== null}
              className="px-lg py-sm border border-tertiary text-tertiary font-mono-technical text-[10px] hover:bg-tertiary/10 transition-colors disabled:opacity-40"
            >
              {actionLoading === "reopen" ? "REOPENING…" : "REOPEN CASE"}
            </button>
          )}
          <button
            onClick={() => setShowAssign((s) => !s)}
            className="px-lg py-sm border border-border-muted text-on-surface-variant font-mono-technical text-[10px] hover:border-primary hover:text-primary transition-colors"
          >
            ASSIGN OWNER
          </button>
        </div>

        {showAssign && (
          <div className="flex items-center gap-sm">
            <input
              type="email"
              value={assignEmail}
              onChange={(e) => setAssignEmail(e.target.value)}
              placeholder="owner@example.com"
              className="flex-1 bg-surface-container border border-border-muted text-on-surface font-mono-technical text-[11px] px-md py-sm focus:outline-none focus:border-primary transition-colors"
            />
            <button
              onClick={doAssign}
              disabled={actionLoading !== null || !assignEmail.trim()}
              className="px-lg py-sm border border-primary text-primary font-mono-technical text-[10px] hover:bg-primary/10 transition-colors disabled:opacity-40"
            >
              {actionLoading === "assign" ? "ASSIGNING…" : "CONFIRM"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
