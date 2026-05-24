"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { canApprove } from "@/lib/auth";

export default function RejectButton({ approvalId }: { approvalId: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [state, setState] = useState<"idle" | "confirming" | "loading" | "done">("idle");
  const [reason, setReason] = useState("");

  const allowed = canApprove(session?.user?.role ?? "viewer");

  if (!allowed) return null;

  if (state === "done") {
    return (
      <div className="flex-1 border border-critical/50 text-critical font-label-caps text-label-caps py-xs text-center">
        ✗ REJECTED
      </div>
    );
  }

  if (state === "confirming") {
    return (
      <div className="flex-1 space-y-xs">
        <input
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Rejection reason..."
          className="w-full bg-surface-container-low border border-critical/50 text-on-surface font-mono-technical text-[11px] px-2 py-1 focus:outline-none focus:ring-1 focus:ring-critical"
          onKeyDown={(e) => e.key === "Escape" && setState("idle")}
        />
        <div className="flex gap-xs">
          <button
            onClick={async () => {
              if (!reason.trim()) return;
              setState("loading");
              try {
                const res = await fetch(`/api/governance/approvals/${approvalId}`, {
                  method: "DELETE",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    resolvedByEmail: session?.user?.email ?? "system",
                    reason: reason.trim(),
                  }),
                });
                if (res.ok) {
                  setState("done");
                  router.refresh();
                } else setState("idle");
              } catch {
                setState("idle");
              }
            }}
            disabled={!reason.trim()}
            className="flex-1 bg-critical text-on-error font-label-caps text-label-caps py-xs hover:brightness-110 disabled:opacity-40"
          >
            CONFIRM
          </button>
          <button
            onClick={() => setState("idle")}
            className="px-3 border border-border-muted text-on-surface-variant font-label-caps text-label-caps py-xs hover:border-on-surface-variant"
          >
            ESC
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setState("confirming")}
      disabled={state === "loading"}
      className="flex-1 border border-border-muted text-on-surface-variant font-label-caps text-label-caps py-xs hover:border-critical hover:text-critical transition-colors"
    >
      {state === "loading" ? "..." : "REJECT"}
    </button>
  );
}
