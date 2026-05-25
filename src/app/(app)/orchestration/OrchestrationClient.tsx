"use client";

import { useState } from "react";
import Link from "next/link";
import ApproveButton from "@/components/governance/ApproveButton";
import RejectButton from "@/components/governance/RejectButton";
import type {
  SourceGroup,
  OrchestrationCase,
  OrchestrationGate,
  EnterpriseStats,
  ConnectorHealth,
} from "./types";

// ─── shared primitives ────────────────────────────────────────────────────────

function Icon({ name, size = 14 }: { name: string; size?: number }) {
  return (
    <span className="material-symbols-outlined select-none leading-none" style={{ fontSize: size }}>
      {name}
    </span>
  );
}

function IntensityBadge({ intensity }: { intensity: string | undefined }) {
  const map: Record<string, string> = {
    enhanced: "text-tertiary border-tertiary bg-tertiary/10",
    regulated: "text-primary border-primary bg-primary/10",
    critical: "text-critical border-critical bg-critical/10",
    standard: "text-on-surface-variant border-border-muted",
    minimal: "text-on-surface-variant border-border-muted",
  };
  if (!intensity) return null;
  return (
    <span
      className={`px-2 py-0.5 font-mono-technical text-[9px] border ${map[intensity] ?? map.standard}`}
    >
      {intensity.toUpperCase()}
    </span>
  );
}

function StatChip({
  label,
  value,
  color = "text-on-surface",
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div className="text-center">
      <p className={`font-mono-technical text-[16px] font-bold ${color} leading-none`}>{value}</p>
      <p className="font-mono-technical text-[8px] text-on-surface-variant tracking-widest mt-0.5">
        {label}
      </p>
    </div>
  );
}

// ─── source type config ───────────────────────────────────────────────────────

const SOURCE_META: Record<string, { label: string; icon: string; color: string; abbr: string }> = {
  jira: {
    label: "Jira",
    icon: "J",
    color: "text-primary border-primary bg-primary/10",
    abbr: "JIRA",
  },
  github: {
    label: "GitHub",
    icon: "G",
    color: "text-tertiary border-tertiary bg-tertiary/10",
    abbr: "GH",
  },
  gitlab: {
    label: "GitLab",
    icon: "GL",
    color: "text-critical border-critical/40 bg-critical/5",
    abbr: "GL",
  },
  manual: {
    label: "Manual",
    icon: "M",
    color: "text-on-surface-variant border-border-muted",
    abbr: "MAN",
  },
};

// ─── orchestration pipeline breadcrumb ───────────────────────────────────────

type StepState = "done" | "active" | "pending";

function OrchBreadcrumb({
  triggerEval,
  context,
  riskScore,
  gates,
  sourceType,
}: {
  triggerEval: OrchestrationCase["triggerEval"];
  context: OrchestrationCase["context"];
  riskScore: OrchestrationCase["riskScore"];
  gates: OrchestrationGate[];
  sourceType: string;
}) {
  const step1: StepState = "done";
  const step2: StepState = context ? "done" : triggerEval ? "active" : "pending";
  const step3: StepState = riskScore ? "done" : context ? "active" : "pending";
  const step4: StepState = gates.length > 0 ? "done" : riskScore ? "active" : "pending";

  const steps = [
    {
      label: "EVENT",
      sub: (SOURCE_META[sourceType]?.abbr ?? sourceType).toUpperCase(),
      state: step1,
    },
    { label: "INTELLIGENCE", sub: context ? "ENRICHED" : "—", state: step2 },
    {
      label: "RISK",
      sub: riskScore ? `${Math.round(riskScore.compositeScore * 100)}` : "—",
      state: step3,
    },
    {
      label: "PIPELINE",
      sub: gates.length > 0 ? `${gates.length} GATES` : "—",
      state: step4,
    },
  ];

  const stateClass: Record<StepState, string> = {
    done: "text-primary border-primary",
    active: "text-tertiary border-tertiary animate-pulse",
    pending: "text-on-surface-variant/30 border-border-muted",
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
          <div className={`flex items-center gap-xs border px-sm py-xs ${stateClass[step.state]}`}>
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass[step.state]}`} />
            <div>
              <p className="font-mono-technical text-[8px] tracking-widest leading-none">
                {step.label}
              </p>
              <p className="font-mono-technical text-[7px] opacity-60 leading-none mt-0.5">
                {step.sub}
              </p>
            </div>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`h-px w-3 shrink-0 ${step.state === "done" ? "bg-primary/30" : "bg-border-muted"}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── gate pill ────────────────────────────────────────────────────────────────

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

  let pillClass = "border-border-muted text-on-surface-variant bg-surface-container-high";
  if (isSkipped)
    pillClass = "border-border-muted text-on-surface-variant/30 bg-surface line-through";
  else if (isRejected) pillClass = "border-critical text-critical bg-critical/10";
  else if (isApproved) pillClass = "border-primary text-primary bg-primary/10";
  else if (isPendingApproval)
    pillClass = "border-tertiary text-tertiary bg-tertiary/10 animate-pulse";
  else if (isInherited) pillClass = "border-primary/40 text-primary/60 bg-primary/5";

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        disabled={!isPendingApproval}
        className={`flex items-center gap-xs px-sm py-xs font-mono-technical text-[9px] whitespace-nowrap border transition-all ${pillClass} ${isPendingApproval ? "cursor-pointer hover:brightness-110" : "cursor-default"}`}
      >
        {isSkipped && <Icon name="skip_next" size={9} />}
        {isApproved && <Icon name="check_circle" size={9} />}
        {isRejected && <Icon name="cancel" size={9} />}
        {isPendingApproval && <Icon name="pending" size={9} />}
        {!isSkipped && !isApproved && !isRejected && !isPendingApproval && (
          <Icon name="radio_button_unchecked" size={9} />
        )}
        {isInherited && !isApproved && <Icon name="content_copy" size={9} />}
        <span>{gate.name}</span>
      </button>

      {expanded && gate.pendingApprovalId && (
        <div className="absolute top-full left-0 mt-xs z-30 bg-surface border border-tertiary shadow-lg p-sm min-w-[200px] space-y-xs">
          <p className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest">
            GATE ACTION
          </p>
          <p className="font-body-bold text-body-bold text-on-surface text-[11px]">{gate.name}</p>
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

function CaseCard({ c, showProject }: { c: OrchestrationCase; showProject?: boolean }) {
  const [expandedGateId, setExpandedGateId] = useState<string | null>(null);

  const blockedGates = c.gates.filter((g) => g.status === "REJECTED" && !g.skipped);
  const pendingGates = c.gates.filter((g) => g.pendingApprovalId && !g.skipped);
  const approvedGates = c.gates.filter((g) => g.status === "APPROVED" && !g.skipped);
  const activePipelineGates = c.gates.filter((g) => !g.skipped);

  return (
    <div className="bg-surface border-b border-border-muted last:border-0 hover:bg-surface-container-low/30 transition-colors">
      {/* header */}
      <div className="px-lg py-md">
        <div className="flex items-start gap-md">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-xs mb-xs">
              {showProject && (
                <span className="px-1.5 py-0.5 font-mono-technical text-[8px] border border-border-muted text-on-surface-variant bg-surface-container-high">
                  {c.project.key}
                </span>
              )}
              <span className="px-1.5 py-0.5 font-mono-technical text-[8px] border border-border-muted text-on-surface-variant">
                {c.phase}
              </span>
              <IntensityBadge intensity={c.riskScore?.intensity} />
              {blockedGates.length > 0 && (
                <span className="px-1.5 py-0.5 font-mono-technical text-[8px] border border-critical text-critical bg-critical/10">
                  {blockedGates.length} BLOCKED
                </span>
              )}
              {pendingGates.length > 0 && (
                <span className="px-1.5 py-0.5 font-mono-technical text-[8px] border border-tertiary text-tertiary animate-pulse">
                  {pendingGates.length} AWAITING
                </span>
              )}
            </div>
            <Link
              href={`/cases/${c.id}`}
              className="font-body-bold text-body-bold text-on-surface text-[13px] hover:text-primary transition-colors leading-snug"
            >
              {c.title}
            </Link>
            {(c.sourceEpicKey || c.sourceGovEpicKey) && (
              <div className="flex items-center gap-sm mt-xs">
                {c.sourceEpicKey && (
                  <span className="font-mono-technical text-[9px] text-on-surface-variant">
                    {c.sourceEpicKey}
                  </span>
                )}
                {c.sourceGovEpicKey && (
                  <span className="font-mono-technical text-[9px] text-primary flex items-center gap-xs">
                    <Icon name="sync" size={9} />
                    {c.sourceGovEpicKey}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-lg shrink-0">
            {/* orchestration pipeline state */}
            <OrchBreadcrumb
              triggerEval={c.triggerEval}
              context={c.context}
              riskScore={c.riskScore}
              gates={c.gates}
              sourceType={c.sourceType}
            />

            {c.riskScore && (
              <div className="text-right w-12">
                <p className="font-mono-technical text-[18px] font-bold text-on-surface leading-none">
                  {Math.round(c.riskScore.compositeScore * 100)}
                </p>
                <p className="font-mono-technical text-[8px] text-on-surface-variant">RISK</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* gate pipeline */}
      {c.gates.length > 0 && (
        <div className="px-lg pb-md">
          <div className="flex items-center gap-xs flex-wrap mb-xs">
            {c.gates.map((gate) => (
              <GatePill
                key={gate.id}
                gate={gate}
                expanded={expandedGateId === gate.id}
                onToggle={() => setExpandedGateId(expandedGateId === gate.id ? null : gate.id)}
              />
            ))}
          </div>
          <div className="flex items-center gap-md">
            <span className="font-mono-technical text-[8px] text-on-surface-variant">
              {approvedGates.length}/{activePipelineGates.length} APPROVED
            </span>
            {c.adaptivePipeline && c.adaptivePipeline.reducedFromBaseline > 0 && (
              <span className="font-mono-technical text-[8px] text-primary">
                ↓ {c.adaptivePipeline.reducedFromBaseline} SKIPPED BY POLICY
              </span>
            )}
            {c.evidenceCount > 0 && (
              <span className="font-mono-technical text-[8px] text-on-surface-variant flex items-center gap-xs">
                <Icon name="inventory_2" size={8} />
                {c.evidenceCount} EVIDENCE
              </span>
            )}
            {c.waiverCount > 0 && (
              <span className="font-mono-technical text-[8px] text-tertiary flex items-center gap-xs">
                <Icon name="gavel" size={8} />
                {c.waiverCount} WAIVER{c.waiverCount !== 1 ? "S" : ""}
              </span>
            )}
            {c.context?.aiSystemInvolved && (
              <span className="font-mono-technical text-[8px] text-primary flex items-center gap-xs">
                <Icon name="psychology" size={8} />
                AI
              </span>
            )}
            <div className="flex-1" />
            <Link
              href={`/cases/${c.id}`}
              className="font-mono-technical text-[8px] text-primary hover:underline"
            >
              DETAIL →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── source group panel ───────────────────────────────────────────────────────

type FilterStatus = "all" | "blocked" | "pending" | "enhanced" | "regulated";

function filterCase(c: OrchestrationCase, filter: FilterStatus): boolean {
  if (filter === "all") return true;
  if (filter === "blocked") return c.gates.some((g) => g.status === "REJECTED" && !g.skipped);
  if (filter === "pending") return c.gates.some((g) => g.pendingApprovalId && !g.skipped);
  if (filter === "enhanced") return c.riskScore?.intensity === "enhanced";
  if (filter === "regulated") return c.riskScore?.intensity === "regulated";
  return true;
}

function SourceGroupPanel({
  group,
  health,
  filter,
  defaultExpanded,
}: {
  group: SourceGroup;
  health: ConnectorHealth | undefined;
  filter: FilterStatus;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const meta = SOURCE_META[group.sourceType] ?? SOURCE_META.manual;
  const visible = group.cases.filter((c) => filterCase(c, filter));

  // Group cases by project within the source group
  const byProject = new Map<string, OrchestrationCase[]>();
  for (const c of visible) {
    const arr = byProject.get(c.project.name) ?? [];
    arr.push(c);
    byProject.set(c.project.name, arr);
  }

  return (
    <div className="border border-border-muted">
      {/* source header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-lg px-lg py-md bg-surface-container-low hover:bg-surface-container-high transition-colors text-left"
      >
        <div
          className={`w-9 h-9 border flex items-center justify-center font-mono-technical text-[11px] font-bold shrink-0 ${meta.color}`}
        >
          {meta.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-sm">
            <span className="font-body-bold text-body-bold text-on-surface text-[13px]">
              {group.connector?.name ?? meta.label}
            </span>
            <span className={`px-1.5 py-0.5 font-mono-technical text-[8px] border ${meta.color}`}>
              {meta.abbr}
            </span>
            {group.connector && (
              <span
                className={`px-1.5 py-0.5 font-mono-technical text-[8px] border ${group.connector.enabled ? "border-primary/30 text-primary/70" : "border-critical/30 text-critical/70"}`}
              >
                {group.connector.enabled ? "CONNECTED" : "DISABLED"}
              </span>
            )}
          </div>
          {group.connector?.baseUrl && (
            <p className="font-mono-technical text-[9px] text-on-surface-variant truncate">
              {group.connector.baseUrl}
            </p>
          )}
        </div>

        <div className="flex items-center gap-xl shrink-0">
          <StatChip label="CASES" value={group.stats.total} />
          {group.stats.enhanced > 0 && (
            <StatChip label="ENHANCED" value={group.stats.enhanced} color="text-tertiary" />
          )}
          {group.stats.regulated > 0 && (
            <StatChip label="REGULATED" value={group.stats.regulated} color="text-primary" />
          )}
          {group.stats.blocked > 0 && (
            <StatChip label="BLOCKED" value={group.stats.blocked} color="text-critical" />
          )}
          {group.stats.pending > 0 && (
            <StatChip label="PENDING" value={group.stats.pending} color="text-tertiary" />
          )}
          {health && (
            <div className="text-center">
              <p className="font-mono-technical text-[13px] font-bold text-on-surface-variant leading-none">
                {health.eventCount}
              </p>
              <p className="font-mono-technical text-[8px] text-on-surface-variant tracking-widest">
                EVENTS
              </p>
            </div>
          )}
        </div>

        <Icon name={expanded ? "expand_less" : "expand_more"} size={16} />
      </button>

      {/* cases */}
      {expanded && (
        <div className="divide-y divide-border-muted border-t border-border-muted">
          {visible.length === 0 ? (
            <div className="px-lg py-md text-center">
              <p className="font-mono-technical text-[10px] text-on-surface-variant">
                No cases match the current filter.
              </p>
            </div>
          ) : byProject.size > 1 ? (
            // Multiple projects — show project subheaders
            Array.from(byProject.entries()).map(([projectName, cases]) => (
              <div key={projectName}>
                <div className="px-lg py-xs bg-surface-container-low flex items-center gap-sm border-b border-border-muted">
                  <Icon name="folder_special" size={11} />
                  <span className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest">
                    {projectName}
                  </span>
                  <span className="font-mono-technical text-[8px] text-on-surface-variant/60">
                    {cases.length} case{cases.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {cases.map((c) => (
                  <CaseCard key={c.id} c={c} showProject={false} />
                ))}
              </div>
            ))
          ) : (
            // Single project — no subheader needed
            visible.map((c) => <CaseCard key={c.id} c={c} showProject={false} />)
          )}
        </div>
      )}
    </div>
  );
}

// ─── enterprise stats bar ─────────────────────────────────────────────────────

function EnterpriseStatsBar({
  stats,
  projectCount,
}: {
  stats: EnterpriseStats;
  projectCount: number;
}) {
  const dominantMode = Object.entries(stats.aiModes).sort(([, a], [, b]) => b - a)[0]?.[0];

  return (
    <div className="bg-surface border border-border-muted px-xl py-lg">
      <div className="flex items-center gap-xxl">
        <div>
          <p className="font-mono-technical text-[28px] font-bold text-on-surface leading-none">
            {stats.totalCases}
          </p>
          <p className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest">
            GOVERNANCE CASES
          </p>
          <p className="font-mono-technical text-[9px] text-on-surface-variant mt-xs">
            across {projectCount} project{projectCount !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="h-12 w-px bg-border-muted shrink-0" />

        <div className="flex items-center gap-xl flex-1 flex-wrap">
          {[
            { label: "ENHANCED RISK", value: stats.enhanced, color: "text-tertiary" },
            { label: "REGULATED", value: stats.regulated, color: "text-primary" },
            { label: "BLOCKED", value: stats.blocked, color: "text-critical" },
            { label: "PENDING APPROVAL", value: stats.pending, color: "text-tertiary" },
            { label: "WAIVERS", value: stats.waivers, color: "text-on-surface-variant" },
            {
              label: "AVG RISK SCORE",
              value: `${Math.round(stats.avgRiskScore * 100)}`,
              color: "text-on-surface",
            },
          ].map((s) => (
            <StatChip key={s.label} label={s.label} value={s.value} color={s.color} />
          ))}
        </div>

        {dominantMode && (
          <div className="text-right shrink-0">
            <p className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest">
              AI CONTROL
            </p>
            <p className="font-mono-technical text-[11px] text-primary font-bold">
              {dominantMode.replace(/_/g, " ")}
            </p>
            {Object.keys(stats.aiModes).length > 1 && (
              <p className="font-mono-technical text-[8px] text-on-surface-variant">
                {Object.keys(stats.aiModes).length} modes active
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── filter bar ──────────────────────────────────────────────────────────────

function FilterBar({
  active,
  onChange,
  counts,
}: {
  active: FilterStatus;
  onChange: (f: FilterStatus) => void;
  counts: Record<string, number>;
}) {
  const filters: { key: FilterStatus; label: string }[] = [
    { key: "all", label: "ALL" },
    { key: "blocked", label: `BLOCKED ${counts.blocked > 0 ? `(${counts.blocked})` : ""}` },
    { key: "pending", label: `AWAITING ${counts.pending > 0 ? `(${counts.pending})` : ""}` },
    { key: "enhanced", label: "ENHANCED" },
    { key: "regulated", label: "REGULATED" },
  ];

  return (
    <div className="flex items-center gap-xs flex-wrap">
      {filters.map((f) => (
        <button
          key={f.key}
          onClick={() => onChange(f.key)}
          className={`px-md py-xs font-mono-technical text-[10px] border transition-colors ${
            active === f.key
              ? "border-primary bg-primary/10 text-primary"
              : "border-border-muted text-on-surface-variant hover:border-on-surface-variant"
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

// ─── connector health strip ───────────────────────────────────────────────────

function ConnectorHealthStrip({ connectors }: { connectors: ConnectorHealth[] }) {
  if (connectors.length === 0) return null;

  return (
    <div className="flex items-center gap-md px-xl py-sm bg-surface-container-low border-b border-border-muted overflow-x-auto">
      <span className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest shrink-0">
        CONNECTORS
      </span>
      {connectors.map((c) => {
        const meta = SOURCE_META[c.type] ?? SOURCE_META.manual;
        return (
          <div key={c.id} className="flex items-center gap-xs shrink-0">
            <div
              className={`w-5 h-5 border flex items-center justify-center font-mono-technical text-[8px] font-bold ${meta.color}`}
            >
              {meta.icon}
            </div>
            <div>
              <p className="font-mono-technical text-[9px] text-on-surface leading-none">
                {c.name}
              </p>
              <p className="font-mono-technical text-[8px] text-on-surface-variant leading-none">
                {c.enabled ? (
                  <span className="text-primary">
                    {c.matchedCount}/{c.eventCount} matched
                  </span>
                ) : (
                  <span className="text-critical">disabled</span>
                )}
              </p>
            </div>
            <div className="w-px h-6 bg-border-muted ml-xs" />
          </div>
        );
      })}
      <Link
        href="/admin/connectors"
        className="font-mono-technical text-[9px] text-primary hover:underline shrink-0 ml-auto"
      >
        MANAGE →
      </Link>
    </div>
  );
}

// ─── empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="px-xl py-xxl">
      <div className="max-w-[560px] mx-auto bg-surface border border-border-muted p-xl text-center space-y-lg">
        <Icon name="account_tree" size={36} />
        <div>
          <p className="font-body-bold text-body-bold text-on-surface text-[15px]">
            No governance cases yet
          </p>
          <p className="font-mono-technical text-[11px] text-on-surface-variant mt-sm leading-relaxed">
            Cases are created automatically when a source tool event — Jira Portfolio Epic, GitHub
            PR, GitLab MR — matches a configured trigger rule. You can also create cases manually
            from the Projects page.
          </p>
        </div>
        <div className="flex items-center gap-sm justify-center flex-wrap">
          <Link
            href="/admin/trigger-rules"
            className="px-lg py-sm font-mono-technical text-[10px] bg-primary text-background"
          >
            CONFIGURE TRIGGER RULES
          </Link>
          <Link
            href="/admin/connectors"
            className="px-lg py-sm font-mono-technical text-[10px] border border-border-muted text-on-surface-variant hover:border-primary"
          >
            MANAGE CONNECTORS
          </Link>
          <Link
            href="/admin/projects"
            className="px-lg py-sm font-mono-technical text-[10px] border border-border-muted text-on-surface-variant hover:border-primary"
          >
            ONBOARD PROJECT
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── main export ─────────────────────────────────────────────────────────────

export default function OrchestrationClient({
  sourceGroups,
  enterpriseStats,
  connectorHealth,
  projectCount,
}: {
  sourceGroups: SourceGroup[];
  enterpriseStats: EnterpriseStats;
  connectorHealth: ConnectorHealth[];
  projectCount: number;
}) {
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const allCases = sourceGroups.flatMap((g) => g.cases);

  const filterCounts = {
    blocked: allCases.filter((c) => c.gates.some((g) => g.status === "REJECTED" && !g.skipped))
      .length,
    pending: allCases.filter((c) => c.gates.some((g) => g.pendingApprovalId && !g.skipped)).length,
  };

  const healthById = new Map(connectorHealth.map((h) => [h.id, h]));

  const visibleGroups = sourceFilter === "all"
    ? sourceGroups
    : sourceGroups.filter((g) => g.sourceType === sourceFilter);

  const visibleCount = visibleGroups.reduce(
    (sum, g) => sum + g.cases.filter((c) => filterCase(c, filter)).length,
    0
  );

  const sourceTypes = [...new Set(sourceGroups.map((g) => g.sourceType))];

  return (
    <>
      {/* header */}
      <header className="h-16 px-xl flex items-center justify-between border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <div className="flex items-center gap-lg">
          <h1 className="font-headline-md text-headline-md text-on-surface">
            Governance Orchestration
          </h1>
          <span className="font-mono-technical text-[10px] text-on-surface-variant">
            ENTERPRISE · {projectCount} PROJECT{projectCount !== 1 ? "S" : ""} · ALL SOURCES
          </span>
        </div>
        <div className="flex items-center gap-sm font-mono-technical text-[10px]">
          <Link
            href="/admin/trigger-rules"
            className="px-md py-xs border border-border-muted text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
          >
            TRIGGER RULES
          </Link>
          <Link
            href="/admin/connectors"
            className="px-md py-xs border border-border-muted text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
          >
            CONNECTORS
          </Link>
          <Link
            href="/admin/projects"
            className="px-md py-xs bg-primary text-background hover:bg-primary/90 transition-colors"
          >
            + ONBOARD PROJECT
          </Link>
        </div>
      </header>

      {/* connector health */}
      <ConnectorHealthStrip connectors={connectorHealth} />

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* enterprise stats */}
        <div className="px-xl pt-xl pb-lg">
          <EnterpriseStatsBar stats={enterpriseStats} projectCount={projectCount} />
        </div>

        {/* filter bar */}
        <div className="px-xl pb-xs flex items-center gap-lg flex-wrap">
          <FilterBar active={filter} onChange={setFilter} counts={filterCounts} />
          <div className="flex-1" />
          <p className="font-mono-technical text-[10px] text-on-surface-variant">
            {visibleCount} CASE{visibleCount !== 1 ? "S" : ""} · {sourceGroups.length} SOURCE
            {sourceGroups.length !== 1 ? "S" : ""}
          </p>
        </div>

        {/* source type filter */}
        {sourceTypes.length > 1 && (
          <div className="px-xl pb-lg flex items-center gap-xs">
            <span className="font-mono-technical text-[9px] text-on-surface-variant/50 tracking-widest mr-xs">SOURCE</span>
            {(["all", ...sourceTypes] as string[]).map((s) => {
              const meta = SOURCE_META[s] ?? SOURCE_META.manual;
              return (
                <button
                  key={s}
                  onClick={() => setSourceFilter(s)}
                  className={`flex items-center gap-xs px-md py-xs font-mono-technical text-[10px] border transition-colors ${
                    sourceFilter === s
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border-muted text-on-surface-variant hover:border-on-surface-variant"
                  }`}
                >
                  {s === "all" ? "ALL" : (
                    <><span className={`font-bold ${meta.color.split(" ")[0]}`}>{meta.icon}</span> {s.toUpperCase()}</>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {allCases.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="px-xl pb-xl space-y-md">
            {visibleGroups.map((group) => (
              <SourceGroupPanel
                key={group.sourceType}
                group={group}
                health={group.connector ? healthById.get(group.connector.id) : undefined}
                filter={filter}
                defaultExpanded={
                  group.stats.blocked > 0 || group.stats.pending > 0 || visibleGroups.length === 1
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* status bar */}
      <footer className="h-8 bg-surface-container-low border-t border-border-muted flex items-center px-xl font-mono-technical text-[9px] text-on-surface-variant shrink-0 gap-xl">
        <span>ORCHESTRATION ENGINE: ACTIVE</span>
        <span>{enterpriseStats.totalCases} CASES TRACKED</span>
        <span>AVG RISK: {Math.round(enterpriseStats.avgRiskScore * 100)}</span>
        {enterpriseStats.blocked > 0 && (
          <span className="text-critical">{enterpriseStats.blocked} BLOCKED</span>
        )}
        {enterpriseStats.pending > 0 && (
          <span className="text-tertiary">{enterpriseStats.pending} PENDING APPROVAL</span>
        )}
        <span className="ml-auto">
          {new Date().toISOString().slice(0, 16).replace("T", " ")} UTC
        </span>
      </footer>
    </>
  );
}
