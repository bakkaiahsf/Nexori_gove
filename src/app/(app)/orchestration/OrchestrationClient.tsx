"use client";

import { useState } from "react";
import Link from "next/link";
import ApproveButton from "@/components/governance/ApproveButton";
import RejectButton from "@/components/governance/RejectButton";
import type { ConnectorGroup, OrchestrationCase, OrchestrationGate, ProgramStats } from "./types";

// ─── helpers ────────────────────────────────────────────────────────────────

function IntensityBadge({ intensity }: { intensity: string | undefined }) {
  const map: Record<string, string> = {
    enhanced: "text-tertiary border-tertiary bg-tertiary/10",
    regulated: "text-primary border-primary bg-primary/10",
    critical: "text-critical border-critical bg-critical/10",
    standard: "text-on-surface-variant border-border-muted",
  };
  if (!intensity) return null;
  return (
    <span className={`px-2 py-0.5 font-mono-technical text-[9px] border ${map[intensity] ?? map.standard}`}>
      {intensity.toUpperCase()}
    </span>
  );
}

function PhaseBadge({ phase }: { phase: string }) {
  return (
    <span className="px-2 py-0.5 font-mono-technical text-[9px] border border-border-muted text-on-surface-variant bg-surface-container-high">
      {phase}
    </span>
  );
}

// ─── orchestration breadcrumb ────────────────────────────────────────────────

type StepState = "done" | "active" | "pending";

function OrchBreadcrumb({
  triggerEval,
  context,
  riskScore,
  gates,
}: {
  triggerEval: OrchestrationCase["triggerEval"];
  context: OrchestrationCase["context"];
  riskScore: OrchestrationCase["riskScore"];
  gates: OrchestrationGate[];
}) {
  const step1: StepState = triggerEval ? "done" : "done"; // always present on created case
  const step2: StepState = context ? "done" : triggerEval ? "active" : "pending";
  const step3: StepState = riskScore ? "done" : context ? "active" : "pending";
  const step4: StepState = gates.length > 0 ? "done" : riskScore ? "active" : "pending";

  const steps = [
    { label: "EVENT RECEIVED", sub: triggerEval?.sourceType ?? "TRIGGER", state: step1 },
    { label: "INTELLIGENCE", sub: context ? "ENRICHED" : "—", state: step2 },
    { label: "RISK SCORED", sub: riskScore ? `${Math.round(riskScore.compositeScore * 100)}` : "—", state: step3 },
    { label: "GATE PIPELINE", sub: gates.length > 0 ? `${gates.length} GATES` : "—", state: step4 },
  ];

  const stateClass: Record<StepState, string> = {
    done: "text-primary border-primary",
    active: "text-tertiary border-tertiary animate-pulse",
    pending: "text-on-surface-variant/40 border-border-muted",
  };
  const dotClass: Record<StepState, string> = {
    done: "bg-primary",
    active: "bg-tertiary",
    pending: "bg-surface-container-highest",
  };

  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center">
          <div className={`flex items-center gap-xs border px-md py-xs ${stateClass[step.state]}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${dotClass[step.state]}`} />
            <div>
              <p className="font-mono-technical text-[9px] tracking-widest leading-none">{step.label}</p>
              <p className="font-mono-technical text-[8px] opacity-70 leading-none mt-0.5">{step.sub}</p>
            </div>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-px w-4 ${step.state === "done" ? "bg-primary/40" : "bg-border-muted"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── gate pipeline ────────────────────────────────────────────────────────────

function GatePill({
  gate,
  expanded,
  onToggle,
}: {
  gate: OrchestrationGate;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isSkipped = gate.skipped;
  const isRejected = gate.status === "REJECTED" && !isSkipped;
  const isApproved = gate.status === "APPROVED" && !isSkipped;
  const isPendingApproval = !!gate.pendingApprovalId && !isSkipped;
  const isInherited = !!gate.inheritedFrom;
  const isPending = gate.status === "PENDING" && !gate.pendingApprovalId && !isSkipped;

  let pillClass = "border border-border-muted text-on-surface-variant bg-surface-container-high";
  if (isSkipped) pillClass = "border border-border-muted text-on-surface-variant/30 bg-surface line-through";
  else if (isRejected) pillClass = "border border-critical text-critical bg-critical/10";
  else if (isApproved) pillClass = "border border-primary text-primary bg-primary/10";
  else if (isPendingApproval) pillClass = "border border-tertiary text-tertiary bg-tertiary/10 animate-pulse";
  else if (isInherited) pillClass = "border border-primary/40 text-primary/60 bg-primary/5";

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        disabled={!isPendingApproval}
        className={`flex items-center gap-xs px-md py-xs font-mono-technical text-[10px] whitespace-nowrap transition-all ${pillClass} ${isPendingApproval ? "cursor-pointer hover:brightness-110" : "cursor-default"}`}
      >
        {isSkipped && (
          <span className="material-symbols-outlined" style={{ fontSize: 10 }}>skip_next</span>
        )}
        {isApproved && (
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 10 }}>check_circle</span>
        )}
        {isRejected && (
          <span className="material-symbols-outlined text-critical" style={{ fontSize: 10 }}>cancel</span>
        )}
        {isPendingApproval && (
          <span className="material-symbols-outlined text-tertiary" style={{ fontSize: 10 }}>pending</span>
        )}
        {isPending && (
          <span className="material-symbols-outlined" style={{ fontSize: 10 }}>radio_button_unchecked</span>
        )}
        {isInherited && !isApproved && (
          <span className="material-symbols-outlined" style={{ fontSize: 10 }}>content_copy</span>
        )}
        <span>{gate.name}</span>
        {isInherited && (
          <span className="font-mono-technical text-[8px] opacity-60">↑</span>
        )}
      </button>

      {expanded && gate.pendingApprovalId && (
        <div className="absolute top-full left-0 mt-xs z-30 bg-surface border border-tertiary shadow-lg p-sm min-w-[200px] space-y-xs">
          <p className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest">GATE ACTION</p>
          <p className="font-body-bold text-body-bold text-on-surface text-[11px]">{gate.name}</p>
          {gate.approvedBy && (
            <p className="font-mono-technical text-[9px] text-primary">By {gate.approvedBy}</p>
          )}
          <div className="flex gap-xs pt-xs">
            <ApproveButton approvalId={gate.pendingApprovalId} />
            <RejectButton approvalId={gate.pendingApprovalId} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── case card ────────────────────────────────────────────────────────────────

function CaseCard({ c }: { c: OrchestrationCase }) {
  const [expandedGateId, setExpandedGateId] = useState<string | null>(null);

  const blockedGates = c.gates.filter((g) => g.status === "REJECTED" && !g.skipped);
  const pendingGates = c.gates.filter((g) => g.pendingApprovalId && !g.skipped);
  const approvedGates = c.gates.filter((g) => g.status === "APPROVED" && !g.skipped);

  return (
    <div className="bg-surface border border-border-muted hover:border-primary/30 transition-colors">
      {/* header */}
      <div className="px-xl py-lg border-b border-border-muted">
        <div className="flex items-start gap-lg">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-sm mb-xs">
              <PhaseBadge phase={c.phase} />
              <IntensityBadge intensity={c.riskScore?.intensity} />
              {blockedGates.length > 0 && (
                <span className="px-2 py-0.5 font-mono-technical text-[9px] border border-critical text-critical bg-critical/10">
                  {blockedGates.length} BLOCKED
                </span>
              )}
              {pendingGates.length > 0 && (
                <span className="px-2 py-0.5 font-mono-technical text-[9px] border border-tertiary text-tertiary animate-pulse">
                  {pendingGates.length} AWAITING
                </span>
              )}
            </div>
            <Link
              href={`/cases/${c.id}`}
              className="font-body-bold text-body-bold text-on-surface text-[14px] hover:text-primary transition-colors leading-snug"
            >
              {c.title}
            </Link>
            <div className="flex items-center gap-md mt-xs">
              {c.sourceEpicKey && (
                <span className="font-mono-technical text-[10px] text-on-surface-variant">{c.sourceEpicKey}</span>
              )}
              {c.sourceGovEpicKey && (
                <span className="font-mono-technical text-[10px] text-primary">
                  <span className="material-symbols-outlined" style={{ fontSize: 10 }}>sync</span> {c.sourceGovEpicKey}
                </span>
              )}
              {c.triggerEval && (
                <span className="font-mono-technical text-[10px] text-on-surface-variant">
                  {c.triggerEval.sourceType} · {c.triggerEval.eventType}
                </span>
              )}
            </div>
          </div>

          {c.riskScore && (
            <div className="text-right shrink-0">
              <p className="font-mono-technical text-[20px] font-bold text-on-surface leading-none">
                {Math.round(c.riskScore.compositeScore * 100)}
              </p>
              <p className="font-mono-technical text-[9px] text-on-surface-variant">RISK SCORE</p>
              <p className="font-mono-technical text-[9px] text-primary mt-xs">{c.riskScore.aiModeRecommended}</p>
            </div>
          )}
        </div>
      </div>

      {/* orchestration breadcrumb */}
      <div className="px-xl py-md border-b border-border-muted bg-surface-container-low">
        <OrchBreadcrumb
          triggerEval={c.triggerEval}
          context={c.context}
          riskScore={c.riskScore}
          gates={c.gates}
        />
      </div>

      {/* gate pipeline */}
      {c.gates.length > 0 && (
        <div className="px-xl py-md border-b border-border-muted overflow-x-auto">
          <div className="flex items-center gap-xs pb-xs">
            {c.gates.map((gate) => (
              <GatePill
                key={gate.id}
                gate={gate}
                expanded={expandedGateId === gate.id}
                onToggle={() => setExpandedGateId(expandedGateId === gate.id ? null : gate.id)}
              />
            ))}
          </div>
          <div className="flex items-center gap-lg mt-xs">
            <span className="font-mono-technical text-[9px] text-on-surface-variant">
              {approvedGates.length}/{c.gates.filter((g) => !g.skipped).length} APPROVED
            </span>
            {c.adaptivePipeline && c.adaptivePipeline.reducedFromBaseline > 0 && (
              <span className="font-mono-technical text-[9px] text-primary">
                ↓ {c.adaptivePipeline.reducedFromBaseline} SKIPPED BY POLICY
              </span>
            )}
          </div>
        </div>
      )}

      {/* footer */}
      <div className="px-xl py-sm flex items-center gap-xl">
        <div className="flex items-center gap-md flex-1">
          <span className="font-mono-technical text-[9px] text-on-surface-variant flex items-center gap-xs">
            <span className="material-symbols-outlined" style={{ fontSize: 10 }}>inventory_2</span>
            {c.evidenceCount} EVIDENCE
          </span>
          {c.waiverCount > 0 && (
            <span className="font-mono-technical text-[9px] text-tertiary flex items-center gap-xs">
              <span className="material-symbols-outlined" style={{ fontSize: 10 }}>gavel</span>
              {c.waiverCount} WAIVER{c.waiverCount !== 1 ? "S" : ""}
            </span>
          )}
          {c.context?.aiSystemInvolved && (
            <span className="font-mono-technical text-[9px] text-primary flex items-center gap-xs">
              <span className="material-symbols-outlined" style={{ fontSize: 10 }}>psychology</span>
              AI SYSTEM
            </span>
          )}
          {c.context?.environment && (
            <span className="font-mono-technical text-[9px] text-on-surface-variant">
              ENV: {c.context.environment}
            </span>
          )}
        </div>
        <Link
          href={`/cases/${c.id}`}
          className="font-mono-technical text-[9px] text-primary hover:underline flex items-center gap-xs"
        >
          FULL DETAIL →
        </Link>
      </div>
    </div>
  );
}

// ─── connector header (program mode row) ────────────────────────────────────

function ConnectorHeader({
  group,
  expanded,
  onToggle,
}: {
  group: ConnectorGroup;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { connector, stats } = group;
  const typeColor: Record<string, string> = {
    jira: "text-primary border-primary bg-primary/10",
    github: "text-tertiary border-tertiary bg-tertiary/10",
    gitlab: "text-primary border-primary bg-primary/10",
  };
  const color = connector ? typeColor[connector.type] ?? "text-on-surface border-border-muted" : "text-on-surface-variant border-border-muted";

  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-lg px-xl py-lg bg-surface border border-border-muted hover:bg-surface-container-low transition-colors text-left"
    >
      {connector ? (
        <div className={`w-9 h-9 border flex items-center justify-center font-mono-technical text-[10px] shrink-0 ${color}`}>
          {connector.type === "jira" ? "J" : connector.type === "github" ? "G" : connector.type === "gitlab" ? "GL" : "?"}
        </div>
      ) : (
        <div className="w-9 h-9 border border-border-muted flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 14 }}>link_off</span>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-sm">
          <span className="font-body-bold text-body-bold text-on-surface text-[13px]">
            {connector?.name ?? "Unlinked Cases"}
          </span>
          {connector && (
            <span className={`px-2 py-0.5 font-mono-technical text-[9px] border ${color}`}>
              {connector.type.toUpperCase()}
            </span>
          )}
        </div>
        {connector?.baseUrl && (
          <p className="font-mono-technical text-[10px] text-on-surface-variant truncate">{connector.baseUrl}</p>
        )}
      </div>

      <div className="flex items-center gap-xl shrink-0">
        <StatChip label="CASES" value={stats.total} />
        {stats.enhanced > 0 && <StatChip label="ENHANCED" value={stats.enhanced} color="text-tertiary" />}
        {stats.regulated > 0 && <StatChip label="REGULATED" value={stats.regulated} color="text-primary" />}
        {stats.blocked > 0 && <StatChip label="BLOCKED" value={stats.blocked} color="text-critical" />}
        {stats.pending > 0 && <StatChip label="PENDING" value={stats.pending} color="text-tertiary" />}
        {stats.waivers > 0 && <StatChip label="WAIVERS" value={stats.waivers} />}
      </div>

      <span className="material-symbols-outlined text-on-surface-variant ml-md" style={{ fontSize: 16 }}>
        {expanded ? "expand_less" : "expand_more"}
      </span>
    </button>
  );
}

function StatChip({ label, value, color = "text-on-surface-variant" }: { label: string; value: number; color?: string }) {
  return (
    <div className="text-center">
      <p className={`font-mono-technical text-[13px] font-bold ${color} leading-none`}>{value}</p>
      <p className="font-mono-technical text-[8px] text-on-surface-variant tracking-widest">{label}</p>
    </div>
  );
}

// ─── program stats bar ────────────────────────────────────────────────────────

function ProgramStatsBar({ stats }: { stats: ProgramStats }) {
  return (
    <div className="bg-surface border border-border-muted px-xl py-lg flex items-center gap-xxl">
      <div>
        <p className="font-mono-technical text-[22px] font-bold text-on-surface leading-none">{stats.totalCases}</p>
        <p className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest">TOTAL CASES</p>
      </div>
      <div className="h-8 w-px bg-border-muted" />
      <div className="flex items-center gap-xl flex-1">
        {[
          { label: "ENHANCED", value: stats.enhanced, color: "text-tertiary" },
          { label: "REGULATED", value: stats.regulated, color: "text-primary" },
          { label: "BLOCKED", value: stats.blocked, color: "text-critical" },
          { label: "PENDING", value: stats.pending, color: "text-tertiary" },
          { label: "WAIVERS", value: stats.waivers, color: "text-on-surface-variant" },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <p className={`font-mono-technical text-[18px] font-bold ${s.color} leading-none`}>{s.value}</p>
            <p className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="text-right">
        <p className="font-mono-technical text-[10px] text-on-surface-variant">AI MODE</p>
        <p className="font-mono-technical text-[12px] text-primary font-bold">{stats.aiMode.replace(/_/g, " ")}</p>
      </div>
    </div>
  );
}

// ─── filter bar ──────────────────────────────────────────────────────────────

type FilterStatus = "all" | "blocked" | "pending" | "enhanced" | "regulated";

function FilterBar({
  active,
  onChange,
  counts,
}: {
  active: FilterStatus;
  onChange: (f: FilterStatus) => void;
  counts: { blocked: number; pending: number; enhanced: number; regulated: number };
}) {
  const filters: { key: FilterStatus; label: string; count?: number; color?: string }[] = [
    { key: "all", label: "ALL" },
    { key: "blocked", label: "BLOCKED", count: counts.blocked, color: "text-critical" },
    { key: "pending", label: "AWAITING", count: counts.pending, color: "text-tertiary" },
    { key: "enhanced", label: "ENHANCED", count: counts.enhanced, color: "text-tertiary" },
    { key: "regulated", label: "REGULATED", count: counts.regulated, color: "text-primary" },
  ];

  return (
    <div className="flex items-center gap-xs">
      {filters.map((f) => (
        <button
          key={f.key}
          onClick={() => onChange(f.key)}
          className={`flex items-center gap-xs px-md py-xs font-mono-technical text-[10px] border transition-colors ${
            active === f.key
              ? "border-primary bg-primary/10 text-primary"
              : "border-border-muted text-on-surface-variant hover:border-on-surface-variant"
          }`}
        >
          {f.label}
          {f.count !== undefined && f.count > 0 && (
            <span className={`font-bold ${f.color ?? ""}`}>{f.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── main client ─────────────────────────────────────────────────────────────

type ViewMode = "project" | "program";

export default function OrchestrationClient({
  projectName,
  groups,
  programStats,
}: {
  projectName: string;
  groups: ConnectorGroup[];
  programStats: ProgramStats;
}) {
  const [mode, setMode] = useState<ViewMode>("program");
  const [selectedConnectorIdx, setSelectedConnectorIdx] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set([0]));
  const [filter, setFilter] = useState<FilterStatus>("all");

  const allCases = groups.flatMap((g) => g.cases);

  function filterCase(c: OrchestrationCase): boolean {
    if (filter === "all") return true;
    if (filter === "blocked") return c.gates.some((g) => g.status === "REJECTED" && !g.skipped);
    if (filter === "pending") return c.gates.some((g) => g.pendingApprovalId && !g.skipped);
    if (filter === "enhanced") return c.riskScore?.intensity === "enhanced";
    if (filter === "regulated") return c.riskScore?.intensity === "regulated";
    return true;
  }

  const filterCounts = {
    blocked: allCases.filter((c) => c.gates.some((g) => g.status === "REJECTED" && !g.skipped)).length,
    pending: allCases.filter((c) => c.gates.some((g) => g.pendingApprovalId && !g.skipped)).length,
    enhanced: allCases.filter((c) => c.riskScore?.intensity === "enhanced").length,
    regulated: allCases.filter((c) => c.riskScore?.intensity === "regulated").length,
  };

  return (
    <>
      {/* header */}
      <header className="h-16 px-xl flex items-center justify-between border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <div className="flex items-center gap-xl">
          <h1 className="font-headline-md text-headline-md text-on-surface">Governance Orchestration</h1>
          <span className="font-mono-technical text-[11px] text-on-surface-variant">{projectName}</span>
        </div>

        <div className="flex items-center gap-md">
          {/* mode toggle */}
          <div className="flex border border-border-muted">
            <button
              onClick={() => setMode("project")}
              className={`px-lg py-xs font-mono-technical text-[10px] transition-colors ${
                mode === "project" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              PROJECT
            </button>
            <button
              onClick={() => setMode("program")}
              className={`px-lg py-xs font-mono-technical text-[10px] transition-colors ${
                mode === "program" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              PROGRAM
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* program stats */}
        <div className="px-xl pt-xl pb-lg">
          <ProgramStatsBar stats={programStats} />
        </div>

        {/* filter + context row */}
        <div className="px-xl pb-lg flex items-center gap-lg">
          <FilterBar active={filter} onChange={setFilter} counts={filterCounts} />
          <div className="flex-1" />
          <p className="font-mono-technical text-[10px] text-on-surface-variant">
            {allCases.filter(filterCase).length} CASES · {groups.length} SOURCE{groups.length !== 1 ? "S" : ""}
          </p>
        </div>

        {allCases.length === 0 ? (
          <div className="px-xl pb-xl">
            <div className="bg-surface border border-border-muted p-xl text-center space-y-md">
              <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 32 }}>account_tree</span>
              <p className="font-body-bold text-body-bold text-on-surface">No governance cases yet</p>
              <p className="font-mono-technical text-[11px] text-on-surface-variant">
                Cases are created when a Jira Portfolio Epic, GitHub PR, or GitLab MR matches a configured trigger rule.
              </p>
            </div>
          </div>
        ) : mode === "project" ? (
          /* ── project mode: connector selector + filtered cases ── */
          <div className="px-xl pb-xl space-y-lg">
            {/* connector tabs */}
            {groups.length > 1 && (
              <div className="flex items-center gap-xs border-b border-border-muted pb-md">
                {groups.map((g, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedConnectorIdx(i)}
                    className={`flex items-center gap-xs px-lg py-sm font-mono-technical text-[11px] border-b-2 transition-colors ${
                      selectedConnectorIdx === i
                        ? "border-primary text-primary"
                        : "border-transparent text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    {g.connector?.name ?? "Unlinked"}
                    <span className="font-mono-technical text-[9px] opacity-70">{g.stats.total}</span>
                  </button>
                ))}
              </div>
            )}

            {/* cases for selected connector */}
            {(groups[selectedConnectorIdx]?.cases ?? []).filter(filterCase).map((c) => (
              <CaseCard key={c.id} c={c} />
            ))}

            {(groups[selectedConnectorIdx]?.cases ?? []).filter(filterCase).length === 0 && (
              <div className="bg-surface border border-border-muted p-xl text-center">
                <p className="font-mono-technical text-[11px] text-on-surface-variant">No cases match the current filter.</p>
              </div>
            )}
          </div>
        ) : (
          /* ── program mode: all sources collapsed/expanded ── */
          <div className="px-xl pb-xl space-y-md">
            {groups.map((group, i) => {
              const isExpanded = expandedGroups.has(i);
              const visibleCases = group.cases.filter(filterCase);

              return (
                <div key={i} className="border border-border-muted">
                  <ConnectorHeader
                    group={group}
                    expanded={isExpanded}
                    onToggle={() => {
                      setExpandedGroups((prev) => {
                        const next = new Set(prev);
                        if (next.has(i)) next.delete(i);
                        else next.add(i);
                        return next;
                      });
                    }}
                  />

                  {isExpanded && (
                    <div className="divide-y divide-border-muted">
                      {visibleCases.length === 0 ? (
                        <div className="px-xl py-lg text-center">
                          <p className="font-mono-technical text-[10px] text-on-surface-variant">No cases match the current filter.</p>
                        </div>
                      ) : (
                        visibleCases.map((c) => (
                          <div key={c.id} className="border-0">
                            <CaseCard c={c} />
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* footer */}
      <footer className="h-8 bg-surface-container-low border-t border-border-muted flex items-center px-xl font-mono-technical text-[10px] text-on-surface-variant shrink-0">
        <span>
          ORCHESTRATION ENGINE: ACTIVE · {allCases.length} CASES · AI MODE: {programStats.aiMode.replace(/_/g, " ")}
        </span>
      </footer>
    </>
  );
}
