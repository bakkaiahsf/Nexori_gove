"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { canEmergencyLock } from "@/lib/auth";

export default function EmergencyButton({ isLocked }: { isLocked: boolean }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  const allowed = canEmergencyLock(session?.user?.role ?? "viewer");

  if (isLocked) {
    return (
      <div className="w-full bg-critical/10 border border-critical text-critical font-label-caps text-label-caps py-md text-center tracking-widest">
        EMERGENCY LOCK ENGAGED
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="w-full bg-surface-container-low border border-border-muted text-on-surface-variant font-label-caps text-label-caps py-md text-center tracking-widest opacity-50">
        RESTRICTED — ADMIN ONLY
      </div>
    );
  }

  async function handleEmergency() {
    if (state !== "idle") return;
    setState("loading");
    try {
      const res = await fetch("/api/ai-control/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "EMERGENCY_LOCK",
          setBy: session?.user?.email,
          reason: `Emergency shutdown initiated by ${session?.user?.name ?? session?.user?.email} via AI Control Center`,
        }),
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
      onClick={handleEmergency}
      disabled={state !== "idle"}
      className={`w-full font-label-caps text-label-caps py-md hover:brightness-110 active:scale-95 transition-all uppercase tracking-widest ${
        state === "loading"
          ? "bg-critical/50 text-on-error cursor-wait"
          : state === "done"
            ? "bg-critical text-on-error cursor-default"
            : "bg-critical text-on-error"
      }`}
    >
      {state === "loading"
        ? "ENGAGING..."
        : state === "done"
          ? "LOCK ENGAGED"
          : "Initiate Shutdown"}
    </button>
  );
}
