"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface WaiverResult {
  waiverId: string;
  residualRisk: string;
  compensatingControls: Array<{ control: string; owner: string; dueDate?: string }>;
  status: string;
}

const WAIVER_TYPES = [
  { value: "emergency",       label: "Emergency",        desc: "Immediate risk to operations" },
  { value: "time-limited",    label: "Time-Limited",     desc: "Temporary exception with expiry" },
  { value: "risk-accepted",   label: "Risk Accepted",    desc: "Risk formally accepted by owner" },
  { value: "expedited-path",  label: "Expedited Path",   desc: "Fast-track review for low-risk change" },
];

function Icon({ name, size = 14, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <span
      className={`material-symbols-outlined select-none leading-none ${className}`}
      style={{ fontSize: size }}
    >
      {name}
    </span>
  );
}

export default function WaiverRequestButton({
  caseId,
  gateId,
  gateName,
  projectId,
}: {
  caseId: string;
  gateId: string;
  gateName: string;
  projectId: string;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [waiverType, setWaiverType] = useState("risk-accepted");
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [result, setResult] = useState<WaiverResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function submit() {
    if (!reason.trim() || state === "submitting") return;
    setState("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/governance/waivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          caseId,
          gateId,
          requestedBy: session?.user?.email ?? "governance@nexori.system",
          waiverType,
          reason: reason.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setErrorMsg(err.error ?? `Request failed (${res.status})`);
        setState("error");
        return;
      }

      const data = await res.json() as WaiverResult;
      setResult(data);
      setState("done");
      router.refresh();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Network error");
      setState("error");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-xs px-md py-xs border border-tertiary text-tertiary font-mono-technical text-[9px] hover:bg-tertiary/10 transition-colors"
      >
        <Icon name="policy" size={11} className="text-tertiary" />
        REQUEST WAIVER
      </button>
    );
  }

  return (
    <div className="border border-tertiary/50 bg-surface-container-low p-lg space-y-md">
      <div className="flex items-center justify-between">
        <p className="font-mono-technical text-[10px] text-tertiary tracking-widest">WAIVER REQUEST — {gateName}</p>
        <button onClick={() => { setOpen(false); setState("idle"); setResult(null); setErrorMsg(""); }}
          className="text-on-surface-variant hover:text-on-surface">
          <Icon name="close" size={14} />
        </button>
      </div>

      {state === "done" && result ? (
        /* ── Success: show residual risk + compensating controls ── */
        <div className="space-y-md">
          <div className="flex items-center gap-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
            <p className="font-mono-technical text-[10px] text-tertiary">WAIVER SUBMITTED — PENDING APPROVAL</p>
          </div>

          <div className="bg-surface border border-tertiary/30 p-md space-y-sm">
            <p className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest">AI RESIDUAL RISK ANALYSIS</p>
            <p className="font-mono-technical text-[11px] text-on-surface leading-relaxed">{result.residualRisk}</p>
          </div>

          {result.compensatingControls.length > 0 && (
            <div className="space-y-xs">
              <p className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest">COMPENSATING CONTROLS</p>
              {result.compensatingControls.map((ctrl, i) => (
                <div key={i} className="flex items-start gap-sm border-l-2 border-primary/40 pl-sm">
                  <Icon name="shield" size={11} className="text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-mono-technical text-[10px] text-on-surface">{ctrl.control}</p>
                    <p className="font-mono-technical text-[9px] text-on-surface-variant">Owner: {ctrl.owner}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button onClick={() => { setOpen(false); setState("idle"); setResult(null); }}
            className="w-full font-mono-technical text-[10px] text-primary border border-primary py-xs hover:bg-primary/10 transition-colors">
            CLOSE
          </button>
        </div>
      ) : (
        /* ── Request form ── */
        <div className="space-y-md">
          {/* Waiver type */}
          <div className="grid grid-cols-2 gap-xs">
            {WAIVER_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setWaiverType(t.value)}
                className={`p-sm border text-left transition-colors ${
                  waiverType === t.value
                    ? "border-tertiary bg-tertiary/10"
                    : "border-border-muted hover:border-tertiary/50"
                }`}
              >
                <p className="font-mono-technical text-[10px] text-on-surface">{t.label}</p>
                <p className="font-mono-technical text-[9px] text-on-surface-variant leading-snug">{t.desc}</p>
              </button>
            ))}
          </div>

          {/* Reason */}
          <div>
            <p className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest mb-xs">JUSTIFICATION (REQUIRED)</p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide business justification for this waiver request..."
              rows={3}
              className="w-full bg-surface border border-border-muted p-sm font-mono-technical text-[11px] text-on-surface resize-none outline-none focus:border-tertiary transition-colors"
            />
          </div>

          {errorMsg && (
            <p className="font-mono-technical text-[10px] text-critical">{errorMsg}</p>
          )}

          <div className="flex items-center gap-sm">
            <button
              onClick={() => void submit()}
              disabled={!reason.trim() || state === "submitting"}
              className="flex-1 flex items-center justify-center gap-sm py-sm bg-tertiary text-background font-mono-technical text-[10px] hover:bg-tertiary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {state === "submitting" ? (
                <><span className="w-3 h-3 border border-background/40 border-t-background rounded-full animate-spin" /> SUBMITTING…</>
              ) : (
                <><Icon name="policy" size={12} className="text-background" /> SUBMIT WAIVER</>
              )}
            </button>
            <button
              onClick={() => { setOpen(false); setState("idle"); }}
              className="px-md py-sm border border-border-muted text-on-surface-variant font-mono-technical text-[10px] hover:border-on-surface-variant"
            >
              CANCEL
            </button>
          </div>

          <p className="font-mono-technical text-[9px] text-on-surface-variant">
            AI will analyse residual risk and suggest compensating controls. Waiver requires approval.
          </p>
        </div>
      )}
    </div>
  );
}
