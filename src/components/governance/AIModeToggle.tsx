"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AIControlMode } from "@prisma/client";
import { canChangeAIMode } from "@/lib/auth";

const MODES: { id: AIControlMode; label: string; desc: string }[] = [
  { id: AIControlMode.AI_ASSIST, label: "AI Assist", desc: "AI surfaces suggestions. Human decides." },
  { id: AIControlMode.AI_REVIEW, label: "AI Review", desc: "AI reviews and flags risk. Human approves." },
  { id: AIControlMode.AI_CONTROLLED_ACTION, label: "AI Controlled", desc: "AI acts within policy bounds. Fully logged." },
  { id: AIControlMode.HUMAN_ONLY, label: "Human Only", desc: "AI disabled. All workflows manual." },
];

export default function AIModeToggle({ currentMode }: { currentMode: AIControlMode }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [active, setActive] = useState<AIControlMode>(currentMode);
  const [loading, setLoading] = useState<AIControlMode | null>(null);

  const allowed = canChangeAIMode(session?.user?.role ?? "viewer");

  async function switchMode(mode: AIControlMode) {
    if (!allowed || mode === active || loading) return;
    setLoading(mode);
    try {
      const res = await fetch("/api/ai-control/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          setBy: session?.user?.email,
          reason: `Mode changed to ${mode} via AI Control Center by ${session?.user?.name ?? session?.user?.email}`,
        }),
      });
      if (res.ok) {
        setActive(mode);
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-sm">
      {!allowed && (
        <p className="font-mono-technical text-[10px] text-on-surface-variant border border-border-muted px-md py-xs mb-sm">
          VIEW ONLY — insufficient role to change AI mode
        </p>
      )}
      {MODES.map((m) => {
        const isActive = active === m.id;
        const isLoading = loading === m.id;
        return (
          <button
            key={m.id}
            onClick={() => switchMode(m.id)}
            disabled={!allowed || !!loading}
            className={`w-full text-left p-md border transition-colors ${
              isActive
                ? "border-primary bg-primary/5 text-on-surface"
                : "border-border-muted text-on-surface-variant hover:border-on-surface-variant"
            } ${isLoading ? "opacity-60" : ""} ${!allowed ? "cursor-not-allowed" : "cursor-pointer"}`}
          >
            <div className="flex items-center justify-between mb-xs">
              <span className="font-body-bold text-body-bold">{m.label}</span>
              {isActive && <span className="w-2 h-2 rounded-full bg-primary" />}
              {isLoading && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
            </div>
            <p className="font-mono-technical text-[11px] opacity-70">{m.desc}</p>
          </button>
        );
      })}
    </div>
  );
}
