"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { canApprove } from "@/lib/auth";

export default function ApproveButton({ approvalId }: { approvalId: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  const allowed = canApprove(session?.user?.role ?? "viewer");

  if (!allowed) {
    return (
      <span className="flex-1 text-center font-mono-technical text-[10px] text-on-surface-variant py-xs border border-border-muted opacity-50">
        VIEW ONLY
      </span>
    );
  }

  async function handleApprove() {
    setState("loading");
    try {
      const res = await fetch(`/api/governance/approvals/${approvalId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolvedByEmail: session?.user?.email ?? "system" }),
      });
      if (res.ok) {
        setState("done");
        router.refresh();
      } else {
        setState("idle");
      }
    } catch {
      setState("idle");
    }
  }

  return (
    <button
      onClick={handleApprove}
      disabled={state !== "idle"}
      className={`flex-1 font-label-caps text-label-caps px-4 py-xs transition-all active:scale-95 ${
        state === "done"
          ? "bg-surface-container-high text-primary border border-primary cursor-default"
          : state === "loading"
            ? "bg-primary/50 text-on-primary cursor-wait"
            : "bg-primary text-on-primary hover:brightness-110"
      }`}
    >
      {state === "done" ? "✓ APPROVED" : state === "loading" ? "..." : "APPROVE"}
    </button>
  );
}
