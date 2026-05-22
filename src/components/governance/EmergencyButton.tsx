"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EmergencyButton({ isLocked }: { isLocked: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  async function handleEmergency() {
    if (state !== "idle") return;
    setState("loading");
    try {
      const res = await fetch("/api/ai-control/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "EMERGENCY_LOCK",
          reason: "Emergency shutdown initiated via AI Control Center UI",
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

  if (isLocked) {
    return (
      <div className="w-full bg-critical/10 border border-critical text-critical font-label-caps text-label-caps py-md text-center tracking-widest">
        EMERGENCY LOCK ENGAGED
      </div>
    );
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
      {state === "loading" ? "ENGAGING..." : state === "done" ? "LOCK ENGAGED" : "Initiate Shutdown"}
    </button>
  );
}
