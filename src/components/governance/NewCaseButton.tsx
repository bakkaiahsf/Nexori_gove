"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const PHASES = [
  { value: "change-delivery", label: "Change Delivery" },
  { value: "ai-deployment", label: "AI Deployment" },
  { value: "third-party-onboarding", label: "Third-Party Onboarding" },
  { value: "code-review", label: "Code Review / PR" },
  { value: "incident", label: "Incident Response" },
  { value: "sprint-governance", label: "Sprint Governance" },
  { value: "release", label: "Release / Deployment" },
  { value: "policy-update", label: "Policy Update" },
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

export default function NewCaseButton() {
  const router = useRouter();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [phase, setPhase] = useState("change-delivery");
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function close() {
    setOpen(false);
    setState("idle");
    setTitle("");
    setDescription("");
    setPhase("change-delivery");
    setErrorMsg("");
  }

  async function create() {
    if (!title.trim() || state === "saving") return;
    setState("saving");
    setErrorMsg("");

    try {
      const res = await fetch("/api/governance/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          phase,
          createdBy: session?.user?.email,
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMsg(typeof err.error === "string" ? err.error : "Failed to create case");
        setState("error");
        return;
      }

      const data = (await res.json()) as { caseId: string };
      close();
      router.push(`/cases/${data.caseId}`);
      router.refresh();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Network error");
      setState("error");
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-sm px-lg py-sm bg-primary text-background font-mono-technical text-[11px] hover:bg-primary/90 transition-colors"
      >
        <Icon name="add" size={14} className="text-background" />
        NEW CASE
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={close} />

          {/* Modal */}
          <div className="relative bg-surface border border-border-muted w-full max-w-[520px] mx-xl shadow-2xl">
            {/* Header */}
            <div className="px-xl py-lg border-b border-border-muted flex items-center justify-between">
              <div className="flex items-center gap-md">
                <Icon name="add_circle" size={16} className="text-primary" />
                <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
                  NEW GOVERNANCE CASE
                </p>
              </div>
              <button onClick={close} className="text-on-surface-variant hover:text-on-surface">
                <Icon name="close" size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-xl space-y-lg">
              <div>
                <label className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest block mb-xs">
                  CASE TITLE *
                </label>
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void create()}
                  placeholder="e.g. AI Model Deployment — Credit Scoring v2"
                  className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-body-base text-body-base text-on-surface outline-none focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest block mb-xs">
                  GOVERNANCE PHASE *
                </label>
                <div className="grid grid-cols-2 gap-xs">
                  {PHASES.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setPhase(p.value)}
                      className={`px-md py-sm text-left border font-mono-technical text-[10px] transition-colors ${
                        phase === p.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border-muted text-on-surface-variant hover:border-primary/50"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest block mb-xs">
                  DESCRIPTION (OPTIONAL)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Brief description of the change, deployment, or event requiring governance..."
                  className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-body-base text-body-base text-on-surface resize-none outline-none focus:border-primary transition-colors"
                />
              </div>

              {errorMsg && (
                <p className="font-mono-technical text-[10px] text-critical">{errorMsg}</p>
              )}

              <div className="flex gap-sm">
                <button
                  onClick={() => void create()}
                  disabled={!title.trim() || state === "saving"}
                  className="flex-1 flex items-center justify-center gap-sm py-md bg-primary text-background font-mono-technical text-[11px] hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {state === "saving" ? (
                    <>
                      <span className="w-3 h-3 border border-background/40 border-t-background rounded-full animate-spin" />{" "}
                      CREATING…
                    </>
                  ) : (
                    <>
                      <Icon name="add_circle" size={14} className="text-background" /> CREATE CASE
                    </>
                  )}
                </button>
                <button
                  onClick={close}
                  className="px-xl py-md border border-border-muted text-on-surface-variant font-mono-technical text-[11px] hover:border-on-surface-variant"
                >
                  CANCEL
                </button>
              </div>

              <p className="font-mono-technical text-[9px] text-on-surface-variant">
                A GovernanceEvent (CASE_CREATED) will be emitted to the flight recorder. Risk
                scoring and gate pipeline can be triggered from the case detail.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
