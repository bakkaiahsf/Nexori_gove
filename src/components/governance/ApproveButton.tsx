"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ApproveButton({ approvalId }: { approvalId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  async function handleApprove() {
    setState("loading");
    try {
      const res = await fetch(`/api/governance/approvals/${approvalId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolvedByEmail: "bakkaiahsf@gmail.com" }),
      });
      if (res.ok) {
        setState("done");
        router.refresh(); // re-run Server Component data fetch
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
      className={`font-label-caps text-label-caps px-4 py-1.5 transition-all active:scale-95 ${
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
