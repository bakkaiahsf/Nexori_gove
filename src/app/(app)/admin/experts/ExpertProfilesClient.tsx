"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { ExpertData } from "./page";

function Icon({
  name,
  size = 14,
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

const DOMAIN_META: Record<string, string> = {
  "ai-governance": "text-tertiary border-tertiary bg-tertiary/10",
  security: "text-critical border-critical bg-critical/10",
  architecture: "text-primary border-primary bg-primary/10",
  dpo: "text-tertiary border-tertiary bg-tertiary/10",
  cab: "text-primary border-primary bg-primary/10",
  regulatory: "text-tertiary border-tertiary bg-tertiary/10",
};

const JURISDICTION_CLS = "text-on-surface-variant border-border-muted";

const DOMAIN_OPTS = [
  "ai-governance",
  "security",
  "architecture",
  "dpo",
  "cab",
  "regulatory",
] as const;
const JURISDICTION_OPTS = ["EU", "UK", "US", "APAC", "GLOBAL"] as const;

function AddExpertForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [domains, setDomains] = useState<string[]>([]);
  const [jurisdictions, setJurisdictions] = useState<string[]>([]);
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function toggleDomain(d: string) {
    setDomains((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  function toggleJurisdiction(j: string) {
    setJurisdictions((prev) => (prev.includes(j) ? prev.filter((x) => x !== j) : [...prev, j]));
  }

  async function save() {
    if (!email.trim() || domains.length === 0 || state === "saving") return;
    setState("saving");
    setErrorMsg("");
    try {
      const res = await fetch("/api/experts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          domains,
          jurisdictions: jurisdictions.length > 0 ? jurisdictions : ["GLOBAL"],
          createdBy: session?.user?.email,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMsg(err.error ?? "Failed to create expert");
        setState("error");
        return;
      }
      router.refresh();
      onDone();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Network error");
      setState("error");
    }
  }

  return (
    <div className="border border-primary/50 bg-surface p-xl space-y-lg">
      <div className="flex items-center justify-between">
        <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
          ADD EXPERT PROFILE
        </p>
        <button onClick={onDone} className="text-on-surface-variant hover:text-on-surface">
          <Icon name="close" size={16} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-lg">
        <div>
          <label className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest block mb-xs">
            EMAIL *
          </label>
          <input
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="reviewer@enterprise.com"
            className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[11px] text-on-surface outline-none focus:border-primary transition-colors"
          />
        </div>
        <div>
          <label className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest block mb-xs">
            DISPLAY NAME
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dr. Jane Smith"
            className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[11px] text-on-surface outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest block mb-xs">
          GOVERNANCE DOMAINS *
        </label>
        <div className="flex flex-wrap gap-xs">
          {DOMAIN_OPTS.map((d) => (
            <button
              key={d}
              onClick={() => toggleDomain(d)}
              className={`px-md py-xs font-mono-technical text-[10px] border transition-colors ${
                domains.includes(d)
                  ? (DOMAIN_META[d] ?? "border-primary text-primary bg-primary/10")
                  : "border-border-muted text-on-surface-variant hover:border-primary/50"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest block mb-xs">
          JURISDICTIONS
        </label>
        <div className="flex flex-wrap gap-xs">
          {JURISDICTION_OPTS.map((j) => (
            <button
              key={j}
              onClick={() => toggleJurisdiction(j)}
              className={`px-md py-xs font-mono-technical text-[10px] border transition-colors ${
                jurisdictions.includes(j)
                  ? "border-primary text-primary bg-primary/10"
                  : "border-border-muted text-on-surface-variant hover:border-primary/50"
              }`}
            >
              {j}
            </button>
          ))}
        </div>
      </div>

      {errorMsg && <p className="font-mono-technical text-[10px] text-critical">{errorMsg}</p>}

      <div className="flex gap-sm">
        <button
          onClick={() => void save()}
          disabled={!email.trim() || domains.length === 0 || state === "saving"}
          className="flex-1 flex items-center justify-center gap-sm py-md bg-primary text-background font-mono-technical text-[10px] hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {state === "saving" ? (
            <>
              <span className="w-3 h-3 border border-background/40 border-t-background rounded-full animate-spin" />
              SAVING…
            </>
          ) : (
            <>
              <Icon name="add" size={12} className="text-background" />
              ADD EXPERT
            </>
          )}
        </button>
        <button
          onClick={onDone}
          className="px-xl py-md border border-border-muted text-on-surface-variant font-mono-technical text-[10px] hover:border-on-surface-variant"
        >
          CANCEL
        </button>
      </div>
    </div>
  );
}

function ExpertCard({ expert }: { expert: ExpertData }) {
  const lastActive = expert.lastActiveAt
    ? new Date(expert.lastActiveAt).toLocaleDateString("en-GB")
    : "Never";

  const loadColor =
    expert.activeApprovals === 0
      ? "text-on-surface-variant"
      : expert.activeApprovals > 5
        ? "text-critical"
        : expert.activeApprovals > 3
          ? "text-tertiary"
          : "text-primary";

  return (
    <div className="bg-surface border border-border-muted p-lg space-y-sm hover:bg-surface-container-highest transition-colors">
      <div className="flex items-start gap-md">
        <div className="w-9 h-9 bg-primary/10 border border-primary flex items-center justify-center shrink-0">
          <span className="font-mono-technical text-[11px] text-primary">
            {(expert.name ?? expert.email)
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-body-bold text-body-bold text-on-surface text-[13px] truncate">
            {expert.name ?? expert.email}
          </p>
          {expert.name && (
            <p className="font-mono-technical text-[10px] text-on-surface-variant truncate">
              {expert.email}
            </p>
          )}
        </div>
        <div className="text-right shrink-0 space-y-xs">
          <p className={`font-mono-technical text-[18px] font-bold ${loadColor}`}>
            {expert.activeApprovals}
          </p>
          <p className="font-mono-technical text-[8px] text-on-surface-variant">ACTIVE</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-xs">
        {expert.domains.map((d) => (
          <span
            key={d}
            className={`px-1.5 py-0.5 font-mono-technical text-[9px] border ${DOMAIN_META[d] ?? "border-border-muted text-on-surface-variant"}`}
          >
            {d}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between text-[9px] font-mono-technical text-on-surface-variant/60 border-t border-border-muted pt-sm">
        <span>
          {expert.jurisdictions.map((j) => (
            <span
              key={j}
              className={`inline-block mr-xs px-1 py-0.5 border text-[8px] ${JURISDICTION_CLS}`}
            >
              {j}
            </span>
          ))}
        </span>
        <span>
          {expert.avgResolutionHours != null
            ? `Avg ${expert.avgResolutionHours.toFixed(1)}h resolution`
            : "No resolutions yet"}{" "}
          · Last active: {lastActive}
        </span>
      </div>
    </div>
  );
}

export default function ExpertProfilesClient({ experts }: { experts: ExpertData[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [domainFilter, setDomainFilter] = useState<string>("all");

  const domains = ["all", ...new Set(experts.flatMap((e) => e.domains))];

  const filtered =
    domainFilter === "all" ? experts : experts.filter((e) => e.domains.includes(domainFilter));

  return (
    <div className="space-y-lg">
      {/* Actions bar */}
      <div className="flex items-center gap-md">
        <div className="flex gap-xs flex-wrap">
          {domains.map((d) => (
            <button
              key={d}
              onClick={() => setDomainFilter(d)}
              className={`px-md py-xs font-mono-technical text-[10px] border transition-colors ${
                domainFilter === d
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border-muted text-on-surface-variant hover:border-primary/50"
              }`}
            >
              {d.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-sm px-lg py-sm bg-primary text-background font-mono-technical text-[10px] hover:bg-primary/90 transition-colors"
        >
          <Icon name="add" size={12} className="text-background" />
          ADD EXPERT
        </button>
      </div>

      {showAdd && <AddExpertForm onDone={() => setShowAdd(false)} />}

      {filtered.length === 0 ? (
        <div className="border border-border-muted p-xl text-center space-y-md">
          <Icon name="group" size={32} className="text-on-surface-variant/40 mx-auto block" />
          <p className="font-mono-technical text-[12px] text-on-surface-variant">
            No expert profiles yet.
          </p>
          <p className="font-mono-technical text-[10px] text-on-surface-variant/60">
            Register governance reviewers so AI can route approvals to the right expert based on
            domain, jurisdiction, and workload.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-md">
          {filtered.map((e) => (
            <ExpertCard key={e.id} expert={e} />
          ))}
        </div>
      )}

      <div className="bg-surface-container-low border border-border-muted p-lg">
        <p className="font-mono-technical text-[9px] text-on-surface-variant">
          Expert routing uses domain coverage, jurisdiction, and active workload to assign
          approvals. The AI router prioritises experts with relevant domain expertise and available
          capacity (activeApprovals below workload cap). Workload caps are configurable via the API.
        </p>
      </div>
    </div>
  );
}
