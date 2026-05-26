"use client";

import { useState, useEffect, useRef } from "react";
import { TriggerAction } from "@prisma/client";

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

const EVENT_TYPES: Record<string, string[]> = {
  jira: [
    "issue.created",
    "issue.updated",
    "epic.created",
    "epic.updated",
    "portfolio-epic.created",
  ],
  github: ["pr.opened", "pr.merged", "pr.closed", "pr.synchronize", "pr.reopened"],
  gitlab: ["mr.open", "mr.merge", "mr.close", "mr.update", "mr.reopen"],
};

const CONDITION_FIELDS: Record<string, Array<{ field: string; label: string; hint: string }>> = {
  jira: [
    { field: "issueType", label: "Issue Type", hint: "e.g. Epic, Portfolio Epic, Story" },
    { field: "labels", label: "Labels", hint: "e.g. governance-required" },
    { field: "components", label: "Components", hint: "e.g. payments, ai-engine" },
    { field: "summary", label: "Summary contains", hint: "e.g. regulatory, compliance" },
  ],
  github: [
    { field: "targetBranch", label: "Target Branch", hint: "e.g. main, master, release" },
    { field: "labels", label: "PR Labels", hint: "e.g. governance, ai-change" },
    { field: "author", label: "Author", hint: "e.g. bot, dependabot" },
    { field: "filesChanged", label: "Files Changed", hint: "number threshold e.g. 20" },
    { field: "title", label: "PR Title contains", hint: "e.g. [REGULATED]" },
  ],
  gitlab: [
    { field: "targetBranch", label: "Target Branch", hint: "e.g. main, master" },
    { field: "labels", label: "MR Labels", hint: "e.g. governance-required" },
    { field: "author", label: "Author", hint: "username" },
    { field: "title", label: "MR Title contains", hint: "e.g. [COMPLIANCE]" },
  ],
};

const OPS = [
  { value: "eq", label: "equals" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
  { value: "matches", label: "matches regex" },
];

const ACTION_META: Record<TriggerAction, { label: string; desc: string; cls: string }> = {
  FULL_PIPELINE: {
    label: "Full Pipeline",
    desc: "Enrich context → score risk → compose gates → write back",
    cls: "text-primary border-primary bg-primary/10",
  },
  CLASSIFY_ONLY: {
    label: "Classify Only",
    desc: "Score and classify the change — no gate pipeline created",
    cls: "text-tertiary border-tertiary bg-tertiary/10",
  },
  SKIP: {
    label: "Explicit Skip",
    desc: "Ignore this event — log it but take no governance action",
    cls: "text-on-surface-variant border-border-muted",
  },
};

const RETRY_MESSAGES: Record<string, string> = {
  "error:api_key": "API key invalid — update connector credentials",
  "error:permissions": "Token lacks read permission on this repo/board",
  "error:not_found": "Source project not found — verify the board or repo reference",
  "error:rate_limited": "Rate limited by source API — next retry in 60s",
};

interface Rule {
  id: string;
  name: string;
  description: string | null;
  source: string;
  eventType: string;
  conditions: Array<{ field: string; op: string; value: string }>;
  action: TriggerAction;
  priority: number;
  enabled: boolean;
  createdAt: string;
  sourceProjectRef?: string | null;
  sourceBoardRef?: string | null;
  lastRunAt?: string | null;
  lastRunResult?: string | null;
}

interface Evaluation {
  id: string;
  sourceType: string;
  eventType: string;
  eventKey: string;
  matched: boolean;
  action: TriggerAction | null;
  caseId: string | null;
  evaluatedAt: string;
  ruleId: string | null;
}

interface Connector {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
}

interface Props {
  activeProjectId: string;
  activeProjectName: string;
  projects: { id: string; key: string; name: string }[];
  rules: Rule[];
  evaluations: Evaluation[];
  connectors: Connector[];
  // backwards compat
  projectId?: string;
}

const DEFAULT_FORM = {
  name: "",
  description: "",
  source: "jira",
  eventType: "issue.created",
  action: "FULL_PIPELINE" as TriggerAction,
  priority: 100,
  conditions: [] as Array<{ field: string; op: string; value: string }>,
  connectorId: "",
  sourceProjectRef: "",
};

export default function TriggerRulesClient({
  activeProjectId,
  activeProjectName,
  projects,
  rules: initialRules,
  evaluations,
  connectors,
  projectId: _legacyProjectId,
}: Props) {
  const projectId = activeProjectId ?? _legacyProjectId ?? "";
  const [rules, setRules] = useState<Rule[]>(initialRules);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"rules" | "log">("rules");
  const [sourceRefs, setSourceRefs] = useState<Array<{ value: string; label: string }>>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);
  const lastFetchKey = useRef("");

  const availableEventTypes = EVENT_TYPES[form.source] ?? [];
  const availableFields = CONDITION_FIELDS[form.source] ?? [];

  useEffect(() => {
    if (!form.connectorId) {
      setSourceRefs([]);
      return;
    }
    const fetchKey = `${form.source}:${form.connectorId}`;
    if (lastFetchKey.current === fetchKey) return;
    lastFetchKey.current = fetchKey;
    setLoadingRefs(true);
    setSourceRefs([]);

    const url =
      form.source === "jira"
        ? `/api/integrations/jira/boards?connectorId=${form.connectorId}`
        : form.source === "github"
          ? `/api/integrations/github/repos?connectorId=${form.connectorId}`
          : `/api/integrations/gitlab/projects?connectorId=${form.connectorId}`;

    fetch(url)
      .then((r) => r.json())
      .then((data: unknown) => {
        const d = data as Record<string, unknown>;
        let refs: Array<{ value: string; label: string }> = [];
        if (form.source === "jira" && Array.isArray(d.boards)) {
          const boards = d.boards as Array<{ projectKey?: string; projectName?: string; name: string }>;
          const seen = new Set<string>();
          for (const b of boards) {
            if (b.projectKey && !seen.has(b.projectKey)) {
              seen.add(b.projectKey);
              refs.push({ value: b.projectKey, label: `${b.projectKey} — ${b.projectName ?? b.name}` });
            }
          }
        } else if (form.source === "github" && Array.isArray(d.repos)) {
          refs = (d.repos as Array<{ fullName: string; name: string }>).map((r) => ({
            value: r.fullName,
            label: r.fullName,
          }));
        } else if (form.source === "gitlab" && Array.isArray(d.projects)) {
          refs = (d.projects as Array<{ pathWithNamespace: string; name: string }>).map((p) => ({
            value: p.pathWithNamespace,
            label: p.pathWithNamespace,
          }));
        }
        setSourceRefs(refs);
      })
      .catch(() => setSourceRefs([]))
      .finally(() => setLoadingRefs(false));
  }, [form.connectorId, form.source]);

  function addCondition() {
    const firstField = availableFields[0]?.field ?? "";
    setForm((f) => ({
      ...f,
      conditions: [...f.conditions, { field: firstField, op: "eq", value: "" }],
    }));
  }

  function updateCondition(idx: number, key: string, value: string) {
    setForm((f) => {
      const conds = [...f.conditions];
      conds[idx] = { ...conds[idx], [key]: value };
      return { ...f, conditions: conds };
    });
  }

  function removeCondition(idx: number) {
    setForm((f) => ({ ...f, conditions: f.conditions.filter((_, i) => i !== idx) }));
  }

  async function saveRule() {
    if (!form.name.trim()) {
      setSaveError("Rule name is required.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/admin/trigger-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, projectId }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setSaveError(err.error ?? `Failed (${res.status})`);
        return;
      }
      const created = (await res.json()) as Rule;
      setRules((prev) => [created, ...prev]);
      setForm({ ...DEFAULT_FORM });
      setShowForm(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleRule(id: string, enabled: boolean) {
    setTogglingId(id);
    try {
      await fetch(`/api/admin/trigger-rules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !enabled } : r)));
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="p-xl">
      <div className="max-w-[1200px] mx-auto space-y-lg">
        {/* Project selector */}
        {projects && projects.length > 1 && (
          <div className="flex items-center gap-md">
            <span className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest shrink-0">
              PROJECT
            </span>
            <div className="flex items-center gap-xs flex-wrap">
              {projects.map((p) => (
                <a
                  key={p.id}
                  href={`/admin/trigger-rules?project=${p.id}`}
                  className={`px-md py-xs font-mono-technical text-[10px] border transition-colors ${
                    p.id === projectId
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border-muted text-on-surface-variant hover:border-primary/50"
                  }`}
                >
                  {p.name}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Explainer */}
        <div className="bg-surface border border-border-muted p-lg grid grid-cols-3 gap-lg text-center">
          {[
            {
              icon: "input",
              label: "Event Arrives",
              desc: "Jira epic, GitHub PR, GitLab MR — any tool event",
            },
            {
              icon: "rule",
              label: "Trigger Evaluator",
              desc: "Evaluates event against your rules in priority order",
            },
            {
              icon: "account_tree",
              label: "Action Taken",
              desc: "Full pipeline · Classify only · Skip (all logged)",
            },
          ].map((step, i) => (
            <div key={step.label} className="flex flex-col items-center gap-sm relative">
              {i < 2 && <div className="absolute right-0 top-4 w-px h-8 bg-border-muted" />}
              <div className="w-8 h-8 bg-primary/10 border border-primary flex items-center justify-center">
                <Icon name={step.icon} size={16} className="text-primary" />
              </div>
              <p className="font-body-bold text-body-bold text-on-surface text-[12px]">
                {step.label}
              </p>
              <p className="font-mono-technical text-[10px] text-on-surface-variant">{step.desc}</p>
            </div>
          ))}
        </div>

        {/* Tab switcher */}
        <div className="flex items-center justify-between">
          <div className="flex gap-sm">
            {(["rules", "log"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-lg py-sm font-mono-technical text-[11px] border transition-colors ${tab === t ? "border-primary text-primary bg-primary/10" : "border-border-muted text-on-surface-variant hover:border-primary"}`}
              >
                {t === "rules"
                  ? `MONITORING RULES (${rules.length})`
                  : `EVALUATION LOG (${evaluations.length})`}
              </button>
            ))}
          </div>
          {tab === "rules" && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-sm px-lg py-sm bg-primary text-background font-mono-technical text-[11px] hover:bg-primary/90 transition-colors"
            >
              <Icon name={showForm ? "close" : "add"} size={14} className="text-background" />
              {showForm ? "CANCEL" : "NEW RULE"}
            </button>
          )}
        </div>

        {/* Rule form */}
        {tab === "rules" && showForm && (
          <div className="bg-surface border border-primary/30 p-xl space-y-lg">
            <p className="font-label-caps text-label-caps text-primary tracking-widest">
              CREATE MONITORING RULE
            </p>

            <div className="grid grid-cols-2 gap-lg">
              <div>
                <label className="font-mono-technical text-[10px] text-on-surface-variant block mb-sm">
                  RULE NAME *
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-body-base text-body-base text-on-surface text-[12px] outline-none focus:border-primary"
                  placeholder="e.g. Portfolio Epics → Full Governance"
                />
              </div>
              <div>
                <label className="font-mono-technical text-[10px] text-on-surface-variant block mb-sm">
                  PRIORITY (higher = evaluated first)
                </label>
                <input
                  type="number"
                  value={form.priority}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, priority: parseInt(e.target.value) || 100 }))
                  }
                  className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[12px] text-on-surface outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-lg">
              <div>
                <label className="font-mono-technical text-[10px] text-on-surface-variant block mb-sm">
                  SOURCE TOOL
                </label>
                <select
                  value={form.source}
                  onChange={(e) => {
                    lastFetchKey.current = "";
                    setSourceRefs([]);
                    setForm((f) => ({
                      ...f,
                      source: e.target.value,
                      eventType: EVENT_TYPES[e.target.value]?.[0] ?? "",
                      conditions: [],
                      connectorId: connectors.find((c) => c.type === e.target.value)?.id ?? "",
                      sourceProjectRef: "",
                    }));
                  }}
                  className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[12px] text-on-surface outline-none focus:border-primary"
                >
                  {["jira", "github", "gitlab"].map((s) => (
                    <option key={s} value={s}>
                      {s.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-mono-technical text-[10px] text-on-surface-variant block mb-sm">
                  EVENT TYPE
                </label>
                <select
                  value={form.eventType}
                  onChange={(e) => setForm((f) => ({ ...f, eventType: e.target.value }))}
                  className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[12px] text-on-surface outline-none focus:border-primary"
                >
                  {availableEventTypes.map((et) => (
                    <option key={et} value={et}>
                      {et}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Source project reference */}
            <div className="grid grid-cols-2 gap-lg">
              <div>
                <label className="font-mono-technical text-[10px] text-on-surface-variant block mb-sm">
                  CONNECTOR INSTANCE
                </label>
                <select
                  value={form.connectorId}
                  onChange={(e) => {
                    lastFetchKey.current = "";
                    setSourceRefs([]);
                    setForm((f) => ({ ...f, connectorId: e.target.value, sourceProjectRef: "" }));
                  }}
                  className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[12px] text-on-surface outline-none focus:border-primary"
                >
                  <option value="">— any connector —</option>
                  {connectors
                    .filter((c) => c.type === form.source && c.enabled)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="font-mono-technical text-[10px] text-on-surface-variant block mb-sm">
                  SOURCE PROJECT / REPO
                  {loadingRefs && <span className="ml-2 opacity-60">LOADING...</span>}
                  {!form.connectorId && <span className="ml-1 opacity-60">(select connector first)</span>}
                </label>
                {sourceRefs.length > 0 ? (
                  <select
                    value={form.sourceProjectRef}
                    onChange={(e) => setForm((f) => ({ ...f, sourceProjectRef: e.target.value }))}
                    className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[12px] text-on-surface outline-none focus:border-primary"
                  >
                    <option value="">— all projects (no filter) —</option>
                    {sourceRefs.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={form.sourceProjectRef}
                    onChange={(e) => setForm((f) => ({ ...f, sourceProjectRef: e.target.value }))}
                    placeholder={
                      form.source === "jira"
                        ? "e.g. BANK (Jira project key)"
                        : form.source === "github"
                          ? "e.g. org/repo-name"
                          : "e.g. group/project-path"
                    }
                    className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[12px] text-on-surface outline-none focus:border-primary"
                  />
                )}
              </div>
            </div>

            {/* Conditions */}
            <div>
              <div className="flex items-center justify-between mb-md">
                <label className="font-mono-technical text-[10px] text-on-surface-variant">
                  CONDITIONS (all must match)
                </label>
                <button
                  onClick={addCondition}
                  className="font-mono-technical text-[10px] text-primary hover:underline"
                >
                  + ADD CONDITION
                </button>
              </div>
              {form.conditions.length === 0 && (
                <p className="font-mono-technical text-[10px] text-on-surface-variant/50 italic">
                  No conditions — rule matches ALL events of this type. Add conditions to be
                  selective.
                </p>
              )}
              {form.conditions.map((cond, idx) => (
                <div key={idx} className="flex items-center gap-md mb-sm">
                  <select
                    value={cond.field}
                    onChange={(e) => updateCondition(idx, "field", e.target.value)}
                    className="bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[11px] text-on-surface outline-none focus:border-primary"
                  >
                    {availableFields.map((f) => (
                      <option key={f.field} value={f.field}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={cond.op}
                    onChange={(e) => updateCondition(idx, "op", e.target.value)}
                    className="bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[11px] text-on-surface outline-none focus:border-primary"
                  >
                    {OPS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={cond.value}
                    onChange={(e) => updateCondition(idx, "value", e.target.value)}
                    placeholder={
                      availableFields.find((f) => f.field === cond.field)?.hint ?? "value"
                    }
                    className="flex-1 bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[11px] text-on-surface outline-none focus:border-primary"
                  />
                  <button
                    onClick={() => removeCondition(idx)}
                    className="text-on-surface-variant hover:text-critical transition-colors"
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
              ))}
            </div>

            {/* Action */}
            <div>
              <label className="font-mono-technical text-[10px] text-on-surface-variant block mb-md">
                ACTION
              </label>
              <div className="grid grid-cols-3 gap-md">
                {(
                  Object.entries(ACTION_META) as [
                    TriggerAction,
                    (typeof ACTION_META)[TriggerAction],
                  ][]
                ).map(([action, meta]) => (
                  <button
                    key={action}
                    onClick={() => setForm((f) => ({ ...f, action }))}
                    className={`text-left p-md border transition-colors ${form.action === action ? `${meta.cls} border-opacity-100` : "border-border-muted hover:border-primary"}`}
                  >
                    <p className="font-body-bold text-body-bold text-[12px] mb-xs">{meta.label}</p>
                    <p className="font-mono-technical text-[10px] text-on-surface-variant">
                      {meta.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {saveError && (
              <p className="font-mono-technical text-[11px] text-critical">{saveError}</p>
            )}

            <div className="flex gap-md">
              <button
                onClick={() => void saveRule()}
                disabled={saving}
                className="flex items-center gap-sm px-xl py-sm bg-primary text-background font-mono-technical text-[11px] hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <>
                    <span className="w-3 h-3 border border-background/40 border-t-background rounded-full animate-spin" />
                    SAVING
                  </>
                ) : (
                  "SAVE RULE"
                )}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-xl py-sm border border-border-muted font-mono-technical text-[11px] text-on-surface-variant hover:border-primary transition-colors"
              >
                CANCEL
              </button>
            </div>
          </div>
        )}

        {/* Rules list */}
        {tab === "rules" && (
          <div className="space-y-sm">
            {connectors.length === 0 && (
              <div className="border border-tertiary/30 bg-tertiary/5 px-lg py-md">
                <p className="font-mono-technical text-[11px] text-tertiary">
                  No connectors registered. Register a Jira, GitHub, or GitLab connector first to
                  test trigger rules.
                </p>
              </div>
            )}
            {rules.length === 0 ? (
              <div className="bg-surface border border-border-muted p-xl text-center">
                <p className="font-mono-technical text-[12px] text-on-surface-variant mb-md">
                  No monitoring rules configured for this project.
                </p>
                <p className="font-body-base text-body-base text-on-surface-variant text-[12px]">
                  Add a rule to automatically detect risks, generate summaries, or create Jira tasks when delivery events occur.
                </p>
              </div>
            ) : (
              rules.map((rule) => {
                const conditionSummary =
                  rule.conditions.length > 0
                    ? rule.conditions.map((c) => `${c.field} ${c.op} "${c.value}"`).join(" AND ")
                    : `any ${rule.eventType.replace(".", " ")} event`;
                const actionMeta = ACTION_META[rule.action];
                const sourceLabel =
                  rule.source === "jira" ? "Jira" :
                  rule.source === "github" ? "GitHub" :
                  rule.source === "gitlab" ? "GitLab" : rule.source;
                const whenLabel = `${sourceLabel} ${rule.eventType.replace(".", " ")}`;
                return (
                  <div
                    key={rule.id}
                    className={`bg-surface border ${rule.enabled ? "border-border-muted hover:border-primary/40" : "border-border-muted opacity-50"} transition-colors`}
                  >
                    <div className="px-xl py-lg flex items-start gap-lg">
                      {/* Toggle */}
                      <button
                        onClick={() => void toggleRule(rule.id, rule.enabled)}
                        disabled={togglingId === rule.id}
                        className={`mt-1 w-10 h-6 rounded-full border-2 relative transition-colors shrink-0 ${rule.enabled ? "bg-primary border-primary" : "bg-surface-container-highest border-border-muted"}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-background transition-transform ${rule.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                      </button>

                      {/* Human-readable rule */}
                      <div className="flex-1 min-w-0">
                        <p className="font-body-bold text-body-bold text-on-surface text-[13px] mb-xs">
                          {rule.name}
                        </p>
                        {/* "When ... → do ..." sentence */}
                        <div className="flex items-center gap-xs flex-wrap font-mono-technical text-[10px] mb-sm">
                          <span className="text-on-surface-variant">When</span>
                          <span className="border border-border-muted px-1.5 py-0.5 text-on-surface">{whenLabel}</span>
                          {rule.conditions.length > 0 && (
                            <>
                              <span className="text-on-surface-variant">where</span>
                              <span className="text-on-surface-variant italic">{conditionSummary}</span>
                            </>
                          )}
                          <span className="text-on-surface-variant">→</span>
                          <span className={`border px-1.5 py-0.5 ${actionMeta?.cls ?? "text-on-surface border-border-muted"}`}>
                            {actionMeta?.label ?? rule.action}
                          </span>
                        </div>
                        {rule.sourceProjectRef && (
                          <p className="font-mono-technical text-[9px] text-on-surface-variant">
                            SOURCE: {rule.sourceProjectRef}
                          </p>
                        )}
                        {rule.lastRunAt && (
                          <p className="font-mono-technical text-[9px] text-on-surface-variant">
                            LAST RUN: {new Date(rule.lastRunAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            {rule.lastRunResult === "ok" ? " · OK" : ""}
                          </p>
                        )}
                        {rule.lastRunResult && rule.lastRunResult !== "ok" && (
                          <p className="font-mono-technical text-[10px] text-critical mt-xs">
                            {RETRY_MESSAGES[rule.lastRunResult] ?? rule.lastRunResult}
                          </p>
                        )}
                      </div>

                      <span className="font-mono-technical text-[9px] text-on-surface-variant shrink-0 mt-1">
                        P{rule.priority}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Evaluation log */}
        {tab === "log" && (
          <div className="bg-surface border border-border-muted overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low border-b border-border-muted">
                <tr>
                  {["SOURCE", "EVENT", "KEY", "MATCHED", "ACTION", "CASE", "TIME"].map((h) => (
                    <th
                      key={h}
                      className="px-lg py-md font-mono-technical text-[10px] text-on-surface-variant"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-muted">
                {evaluations.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-lg py-lg font-mono-technical text-[11px] text-on-surface-variant"
                    >
                      No events evaluated yet. Configure a connector and send a test event.
                    </td>
                  </tr>
                ) : (
                  evaluations.map((ev) => (
                    <tr
                      key={ev.id}
                      className="hover:bg-surface-container-highest transition-colors"
                    >
                      <td className="px-lg py-md">
                        <span className="px-2 py-0.5 bg-surface-container-high border border-border-muted font-mono-technical text-[10px] text-on-surface-variant">
                          {ev.sourceType.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-lg py-md font-mono-technical text-[11px] text-on-surface-variant">
                        {ev.eventType}
                      </td>
                      <td className="px-lg py-md font-mono-technical text-[11px] text-on-surface max-w-[160px] truncate">
                        {ev.eventKey}
                      </td>
                      <td className="px-lg py-md">
                        <span
                          className={`font-mono-technical text-[10px] ${ev.matched ? "text-primary" : "text-on-surface-variant"}`}
                        >
                          {ev.matched ? "✓ MATCHED" : "— SKIPPED"}
                        </span>
                      </td>
                      <td className="px-lg py-md">
                        {ev.action ? (
                          <span
                            className={`px-2 py-0.5 font-mono-technical text-[10px] border ${ACTION_META[ev.action]?.cls}`}
                          >
                            {ACTION_META[ev.action]?.label}
                          </span>
                        ) : (
                          <span className="text-on-surface-variant font-mono-technical text-[10px]">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-lg py-md font-mono-technical text-[10px] text-on-surface-variant">
                        {ev.caseId ? ev.caseId.slice(-8).toUpperCase() : "—"}
                      </td>
                      <td className="px-lg py-md font-mono-technical text-[10px] text-on-surface-variant">
                        {new Date(ev.evaluatedAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
