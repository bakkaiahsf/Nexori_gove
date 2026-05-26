"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Connector {
  id: string;
  type: string;
  name: string;
  baseUrl: string | null;
}

interface Program {
  id: string;
  name: string;
}

interface SourceEntry {
  connectorId: string;
  connectorName: string;
  connectorType: string;
  boardId: string;
  boardName: string;
  boardType: string;
}

interface Props {
  connectors: Connector[];
  programs: Program[];
}

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <span
      className="material-symbols-outlined select-none leading-none"
      style={{ fontSize: size, fontVariationSettings: "'FILL' 1" }}
    >
      {name}
    </span>
  );
}

const GOVERNANCE_PROFILES = [
  {
    id: "agile",
    label: "Agile Governance",
    description: "Lightweight default. Automatic risk detection, summaries, and evidence linking. Minimal overhead.",
    badge: "RECOMMENDED",
    badgeCls: "text-primary border-primary",
    icon: "rocket_launch",
  },
  {
    id: "regulated",
    label: "Regulated Delivery",
    description: "Adds mandatory evidence gates and regulatory review checkpoints for financial services.",
    badge: "REGULATED",
    badgeCls: "text-tertiary border-tertiary",
    icon: "account_balance",
  },
  {
    id: "ai_sensitive",
    label: "AI-Sensitive Delivery",
    description: "Full AI usage logging, model governance gates, and EU AI Act compliance controls.",
    badge: "AI ACT",
    badgeCls: "text-tertiary border-tertiary",
    icon: "psychology",
  },
  {
    id: "critical",
    label: "Critical Production Change",
    description: "Multi-approver sign-off, mandatory rollback plan, and release readiness verification.",
    badge: "HIGH RISK",
    badgeCls: "text-critical border-critical",
    icon: "warning",
  },
  {
    id: "third_party",
    label: "Third-Party Risk",
    description: "DORA Article 28 register, ICT vendor oversight, and supply chain evidence requirements.",
    badge: "DORA",
    badgeCls: "text-tertiary border-tertiary",
    icon: "link",
  },
  {
    id: "custom",
    label: "Custom Profile",
    description: "Configure your own gates, evidence requirements, and monitoring rules from scratch.",
    badge: "CUSTOM",
    badgeCls: "text-on-surface-variant border-border-muted",
    icon: "tune",
  },
];

const MONITORING_LEVELS = [
  {
    id: "manual",
    label: "Manual Only",
    description: "You run assessments and generate summaries when needed. No automatic monitoring.",
    icon: "person",
  },
  {
    id: "scheduled",
    label: "Scheduled Summary",
    description: "NexoriOS generates weekly or sprint-based delivery confidence summaries automatically.",
    icon: "schedule",
  },
  {
    id: "active",
    label: "Active Monitoring",
    description: "Monitoring rules watch Jira, GitHub, and GitLab and create alerts when risk is detected.",
    icon: "monitoring",
  },
  {
    id: "full_assisted",
    label: "Full Assisted Assurance",
    description: "NexoriOS creates Jira tasks, evidence requests, and risk notifications when configured conditions are met.",
    icon: "auto_mode",
    recommended: true,
  },
];

const NOTIFICATION_OPTIONS = [
  { id: "email_pm", label: "Notify project manager by email" },
  { id: "jira_issue", label: "Create Jira issue for alerts" },
  { id: "jira_comment", label: "Add Jira comment on risk items" },
  { id: "weekly_summary", label: "Weekly delivery summary" },
  { id: "sprint_summary", label: "Sprint readiness summary" },
  { id: "dashboard_only", label: "Dashboard only (no external notifications)" },
];

function StepHeader({ step, total, label }: { step: number; total: number; label: string }) {
  return (
    <div className="mb-xl">
      <div className="flex items-center gap-md mb-md">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 transition-all ${i < step ? "bg-primary" : i === step - 1 ? "bg-primary/60" : "bg-surface-container-high"}`}
          />
        ))}
      </div>
      <div className="flex items-center gap-md">
        <span className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">
          STEP {step} OF {total}
        </span>
        <span className="text-on-surface-variant">·</span>
        <span className="font-mono-technical text-[10px] text-primary tracking-widest">{label}</span>
      </div>
    </div>
  );
}

export default function StartWizard({ connectors, programs }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1 — source type
  const [sourceType, setSourceType] = useState<"create_new" | "jira" | "github" | "gitlab" | "existing">("create_new");

  // Step 2 — delivery sources
  const [sources, setSources] = useState<SourceEntry[]>([]);
  const [addingSource, setAddingSource] = useState(false);
  const [pendingConnector, setPendingConnector] = useState<Connector | null>(null);
  const [sourceItems, setSourceItems] = useState<Array<{ id: string; label: string }>>([]);
  const [sourceItemsLoading, setSourceItemsLoading] = useState(false);
  const [sourceItemsError, setSourceItemsError] = useState<string | null>(null);
  const [selectedSourceItem, setSelectedSourceItem] = useState("");

  // Step 3 — governance profile
  const [profile, setProfile] = useState("agile");

  // Step 4 — monitoring level
  const [monitoringLevel, setMonitoringLevel] = useState("full_assisted");

  // Step 5 — notifications
  const [notifications, setNotifications] = useState<string[]>(["weekly_summary", "sprint_summary"]);

  // Step 6 / submit
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Project name + key
  const [projectName, setProjectName] = useState("");
  const [projectKey, setProjectKey] = useState("");
  const [programId, setProgramId] = useState(programs[0]?.id ?? "");

  // Auto-generate key from name
  useEffect(() => {
    if (projectName) {
      const key = projectName
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 12);
      setProjectKey(key);
    }
  }, [projectName]);

  // Load source items when connector selected for adding
  useEffect(() => {
    if (!pendingConnector) return;
    setSourceItems([]);
    setSelectedSourceItem("");
    setSourceItemsError(null);
    setSourceItemsLoading(true);

    const url =
      pendingConnector.type === "github"
        ? `/api/integrations/github/repos?connectorId=${pendingConnector.id}`
        : pendingConnector.type === "gitlab"
          ? `/api/integrations/gitlab/projects?connectorId=${pendingConnector.id}`
          : `/api/integrations/jira/boards?connectorId=${pendingConnector.id}`;

    fetch(url)
      .then(async (r) => {
        const body = await r.json().catch(() => ({})) as Record<string, unknown>;
        if (!r.ok) {
          const errMsg = (body.error as string | undefined) ?? `${pendingConnector.type} returned ${r.status}`;
          const detail = body.detail as string | undefined;
          throw new Error(detail ? `${errMsg} — ${detail}` : errMsg);
        }
        return body;
      })
      .then((data) => {
        let items: Array<{ id: string; label: string }> = [];
        if (pendingConnector.type === "github" && Array.isArray(data.repos)) {
          items = (data.repos as Array<{ fullName: string }>).map((r) => ({ id: r.fullName, label: r.fullName }));
        } else if (pendingConnector.type === "gitlab" && Array.isArray(data.projects)) {
          items = (data.projects as Array<{ pathWithNamespace: string; name: string }>).map((r) => ({
            id: r.pathWithNamespace,
            label: `${r.name} (${r.pathWithNamespace})`,
          }));
        } else if (pendingConnector.type === "jira" && Array.isArray(data.boards)) {
          items = (data.boards as Array<{ id: number | string; name: string }>).map((b) => ({ id: String(b.id), label: b.name }));
        }
        setSourceItems(items);
        if (items.length > 0) setSelectedSourceItem(items[0].id);
        else setSourceItemsError(`No ${pendingConnector.type} projects found for this connector. Check the token has the right scopes.`);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Could not reach connector API";
        setSourceItemsError(msg);
      })
      .finally(() => setSourceItemsLoading(false));
  }, [pendingConnector]);

  function addSource() {
    if (!pendingConnector || !selectedSourceItem) return;
    const item = sourceItems.find((i) => i.id === selectedSourceItem);
    setSources((prev) => [
      ...prev,
      {
        connectorId: pendingConnector.id,
        connectorName: pendingConnector.name,
        connectorType: pendingConnector.type,
        boardId: selectedSourceItem,
        boardName: item?.label ?? selectedSourceItem,
        boardType: pendingConnector.type === "jira" ? "scrum" : "repo",
      },
    ]);
    setPendingConnector(null);
    setAddingSource(false);
  }

  function removeSource(boardId: string) {
    setSources((prev) => prev.filter((s) => s.boardId !== boardId));
  }

  function toggleNotification(id: string) {
    setNotifications((prev) =>
      prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]
    );
  }

  async function submit() {
    if (!projectName || !projectKey) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/projects/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName,
          projectKey,
          ownerEmail: "admin@nexori.io",
          programId: programId || undefined,
          sources: sources.map((s) => ({
            connectorId: s.connectorId,
            boardId: s.boardId,
            boardName: s.boardName,
            boardType: s.boardType,
          })),
          governanceProfile: profile,
          monitoringLevel,
          notificationPrefs: notifications,
        }),
      });
      const data = await res.json() as { id?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to create project");
      router.push(`/projects/${data.id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create project");
      setSubmitting(false);
    }
  }

  const selectedProfileMeta = GOVERNANCE_PROFILES.find((p) => p.id === profile)!;
  const selectedMonitoringMeta = MONITORING_LEVELS.find((m) => m.id === monitoringLevel)!;

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="max-w-[680px] mx-auto p-xl py-2xl">

        {/* ─── Step 1 — Project Source ─── */}
        {step === 1 && (
          <div>
            <StepHeader step={1} total={6} label="PROJECT SOURCE" />
            <h2 className="font-headline-md text-headline-md text-on-surface mb-sm">
              How are you starting?
            </h2>
            <p className="font-body-base text-body-base text-on-surface-variant text-[13px] mb-xl">
              Connect an existing tool or create a new project. NexoriOS will monitor it automatically once activated.
            </p>

            <div className="space-y-sm mb-xl">
              {[
                { id: "create_new" as const, label: "Create new project", sub: "Manual project — link sources in the next step", icon: "add_circle" },
                { id: "jira" as const, label: "Import from Jira", sub: "Pull project details from a Jira project or epic", icon: "view_kanban", disabled: connectors.filter((c) => c.type === "jira").length === 0, hint: "No Jira connector — configure in Admin" },
                { id: "github" as const, label: "Link GitHub repository", sub: "Monitor PRs, branches, and deployments", icon: "code", disabled: connectors.filter((c) => c.type === "github").length === 0, hint: "No GitHub connector — configure in Admin" },
                { id: "gitlab" as const, label: "Link GitLab project", sub: "Monitor merge requests and pipelines", icon: "merge", disabled: connectors.filter((c) => c.type === "gitlab").length === 0, hint: "No GitLab connector — configure in Admin" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => !opt.disabled && setSourceType(opt.id)}
                  disabled={opt.disabled}
                  className={`w-full text-left border px-lg py-md flex items-center gap-lg transition-colors ${
                    sourceType === opt.id
                      ? "border-primary bg-primary/5 text-on-surface"
                      : opt.disabled
                        ? "border-border-muted opacity-40 cursor-not-allowed"
                        : "border-border-muted hover:border-primary/50 text-on-surface"
                  }`}
                >
                  <Icon name={opt.icon} size={22} />
                  <div className="flex-1 min-w-0">
                    <p className="font-body-bold text-body-bold text-[13px]">{opt.label}</p>
                    <p className="font-mono-technical text-[10px] text-on-surface-variant mt-0.5">
                      {opt.disabled && opt.hint ? opt.hint : opt.sub}
                    </p>
                  </div>
                  {sourceType === opt.id && (
                    <Icon name="check_circle" size={16} />
                  )}
                </button>
              ))}
            </div>

            {/* Project name + key */}
            <div className="space-y-md mb-xl">
              <div className="space-y-xs">
                <label className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">PROJECT NAME</label>
                <input
                  className="w-full bg-surface-container-low border border-border-muted px-md py-sm text-[13px] text-on-surface focus:outline-none focus:border-primary"
                  placeholder="e.g. Salesforce AI Pipeline v2"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-md">
                <div className="space-y-xs">
                  <label className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">PROJECT KEY</label>
                  <input
                    className="w-full bg-surface-container-low border border-border-muted px-md py-sm text-[13px] text-on-surface uppercase focus:outline-none focus:border-primary font-mono-technical"
                    placeholder="SAF-AI"
                    value={projectKey}
                    onChange={(e) => setProjectKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 12))}
                  />
                </div>
                {programs.length > 0 && (
                  <div className="space-y-xs">
                    <label className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">PROGRAMME</label>
                    <select
                      className="w-full bg-surface-container-low border border-border-muted px-md py-sm text-[13px] text-on-surface focus:outline-none focus:border-primary"
                      value={programId}
                      onChange={(e) => setProgramId(e.target.value)}
                    >
                      <option value="">No programme</option>
                      {programs.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!projectName || !projectKey}
              className="w-full px-xl py-md border border-primary text-primary font-mono-technical text-[11px] hover:bg-primary/10 transition-colors disabled:opacity-40"
            >
              NEXT: DELIVERY SOURCES →
            </button>
          </div>
        )}

        {/* ─── Step 2 — Delivery Sources ─── */}
        {step === 2 && (
          <div>
            <StepHeader step={2} total={6} label="DELIVERY SOURCES" />
            <h2 className="font-headline-md text-headline-md text-on-surface mb-sm">
              Link your delivery tools
            </h2>
            <p className="font-body-base text-body-base text-on-surface-variant text-[13px] mb-xl">
              NexoriOS monitors these sources automatically. You can add more later from the Project Hub.
            </p>

            {/* Linked sources */}
            {sources.length > 0 && (
              <div className="space-y-sm mb-lg">
                {sources.map((s) => (
                  <div key={s.boardId} className="flex items-center justify-between border border-primary/30 bg-primary/5 px-md py-sm">
                    <div className="flex items-center gap-md">
                      <span className="font-mono-technical text-[9px] border px-1.5 py-0.5 text-primary border-primary">
                        {s.connectorType.toUpperCase()}
                      </span>
                      <span className="font-body-bold text-[12px] text-on-surface">{s.boardName}</span>
                      <span className="font-mono-technical text-[10px] text-on-surface-variant">{s.connectorName}</span>
                    </div>
                    <button
                      onClick={() => removeSource(s.boardId)}
                      className="font-mono-technical text-[10px] text-critical hover:underline"
                    >
                      REMOVE
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add source UI */}
            {addingSource ? (
              <div className="border border-border-muted p-lg space-y-md mb-lg">
                <div className="space-y-xs">
                  <label className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">SELECT CONNECTOR</label>
                  <div className="grid grid-cols-2 gap-sm">
                    {connectors
                      .filter((c) => c.type === "jira" || c.type === "github" || c.type === "gitlab")
                      .map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setPendingConnector(c)}
                          className={`text-left border px-md py-sm flex items-center gap-md transition-colors ${
                            pendingConnector?.id === c.id
                              ? "border-primary bg-primary/5"
                              : "border-border-muted hover:border-primary/50"
                          }`}
                        >
                          <span className="font-mono-technical text-[9px] border px-1 py-0.5 text-on-surface-variant border-border-muted">
                            {c.type.toUpperCase()}
                          </span>
                          <span className="font-body-bold text-[12px] text-on-surface truncate">{c.name}</span>
                        </button>
                      ))}
                  </div>
                </div>

                {pendingConnector && (
                  <div className="space-y-xs">
                    <label className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">
                      SELECT {pendingConnector.type === "jira" ? "BOARD" : "REPOSITORY"}
                    </label>
                    {sourceItemsLoading ? (
                      <p className="font-mono-technical text-[10px] text-on-surface-variant animate-pulse">
                        Connecting to {pendingConnector.name}...
                      </p>
                    ) : sourceItemsError ? (
                      <div className="space-y-xs">
                        <div className="flex items-start gap-sm border border-critical/40 bg-critical/5 px-md py-sm">
                          <span className="material-symbols-outlined text-critical shrink-0" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}>error</span>
                          <p className="font-mono-technical text-[10px] text-critical leading-relaxed">{sourceItemsError}</p>
                        </div>
                        <a
                          href="/admin/connectors"
                          className="inline-flex items-center gap-xs font-mono-technical text-[10px] text-primary hover:underline"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>settings</span>
                          Fix connector credentials in Admin → Connectors →
                        </a>
                      </div>
                    ) : sourceItems.length === 0 ? (
                      <p className="font-mono-technical text-[10px] text-on-surface-variant">
                        Select a connector above to load available {pendingConnector.type === "jira" ? "boards" : "repositories"}.
                      </p>
                    ) : (
                      <select
                        className="w-full bg-surface-container-low border border-border-muted px-md py-sm text-[13px] text-on-surface focus:outline-none focus:border-primary"
                        value={selectedSourceItem}
                        onChange={(e) => setSelectedSourceItem(e.target.value)}
                      >
                        {sourceItems.map((i) => (
                          <option key={i.id} value={i.id}>{i.label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                <div className="flex gap-sm">
                  <button
                    onClick={addSource}
                    disabled={!pendingConnector || !selectedSourceItem}
                    className="px-lg py-sm border border-primary text-primary font-mono-technical text-[10px] hover:bg-primary/10 transition-colors disabled:opacity-40"
                  >
                    ADD SOURCE
                  </button>
                  <button
                    onClick={() => { setAddingSource(false); setPendingConnector(null); setSourceItemsError(null); setSourceItems([]); }}
                    className="px-lg py-sm border border-border-muted text-on-surface-variant font-mono-technical text-[10px] hover:border-primary/50 transition-colors"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingSource(true)}
                className="w-full border border-dashed border-border-muted px-lg py-md font-mono-technical text-[11px] text-on-surface-variant hover:border-primary hover:text-primary transition-colors mb-lg flex items-center justify-center gap-sm"
              >
                <Icon name="add" size={14} />
                ADD DELIVERY SOURCE (JIRA · GITHUB · GITLAB)
              </button>
            )}

            <p className="font-mono-technical text-[10px] text-on-surface-variant mb-xl">
              Confluence and policy document sources can be added from the Project Hub after activation.
            </p>

            <div className="flex gap-sm">
              <button
                onClick={() => setStep(1)}
                className="px-xl py-md border border-border-muted text-on-surface-variant font-mono-technical text-[11px] hover:border-primary/50 transition-colors"
              >
                ← BACK
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 px-xl py-md border border-primary text-primary font-mono-technical text-[11px] hover:bg-primary/10 transition-colors"
              >
                NEXT: GOVERNANCE PROFILE →
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 3 — Governance Profile ─── */}
        {step === 3 && (
          <div>
            <StepHeader step={3} total={6} label="GOVERNANCE PROFILE" />
            <h2 className="font-headline-md text-headline-md text-on-surface mb-sm">
              Choose your governance approach
            </h2>
            <p className="font-body-base text-body-base text-on-surface-variant text-[13px] mb-xl">
              Agile Governance is the default — lightweight and low-overhead. Switch only if your project requires more controls.
            </p>

            <div className="space-y-sm mb-xl">
              {GOVERNANCE_PROFILES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProfile(p.id)}
                  className={`w-full text-left border px-lg py-md flex items-start gap-lg transition-colors ${
                    profile === p.id
                      ? "border-primary bg-primary/5"
                      : "border-border-muted hover:border-primary/50"
                  }`}
                >
                  <Icon name={p.icon} size={20} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-md mb-xs">
                      <span className="font-body-bold text-body-bold text-[13px] text-on-surface">
                        {p.label}
                      </span>
                      <span className={`font-mono-technical text-[9px] border px-1.5 py-0.5 ${p.badgeCls}`}>
                        {p.badge}
                      </span>
                    </div>
                    <p className="font-mono-technical text-[10px] text-on-surface-variant">{p.description}</p>
                  </div>
                  {profile === p.id && (
                    <Icon name="check_circle" size={16} />
                  )}
                </button>
              ))}
            </div>

            <div className="flex gap-sm">
              <button
                onClick={() => setStep(2)}
                className="px-xl py-md border border-border-muted text-on-surface-variant font-mono-technical text-[11px] hover:border-primary/50 transition-colors"
              >
                ← BACK
              </button>
              <button
                onClick={() => setStep(4)}
                className="flex-1 px-xl py-md border border-primary text-primary font-mono-technical text-[11px] hover:bg-primary/10 transition-colors"
              >
                NEXT: MONITORING LEVEL →
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 4 — Monitoring Level ─── */}
        {step === 4 && (
          <div>
            <StepHeader step={4} total={6} label="MONITORING LEVEL" />
            <h2 className="font-headline-md text-headline-md text-on-surface mb-sm">
              How active should monitoring be?
            </h2>
            <p className="font-body-base text-body-base text-on-surface-variant text-[13px] mb-xl">
              You can change this at any time from the Project Hub.
            </p>

            <div className="space-y-sm mb-xl">
              {MONITORING_LEVELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMonitoringLevel(m.id)}
                  className={`w-full text-left border px-lg py-md flex items-start gap-lg transition-colors ${
                    monitoringLevel === m.id
                      ? "border-primary bg-primary/5"
                      : "border-border-muted hover:border-primary/50"
                  }`}
                >
                  <Icon name={m.icon} size={20} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-md mb-xs">
                      <span className="font-body-bold text-body-bold text-[13px] text-on-surface">
                        {m.label}
                      </span>
                      {m.recommended && (
                        <span className="font-mono-technical text-[9px] border px-1.5 py-0.5 text-primary border-primary">
                          RECOMMENDED
                        </span>
                      )}
                    </div>
                    <p className="font-mono-technical text-[10px] text-on-surface-variant">{m.description}</p>
                  </div>
                  {monitoringLevel === m.id && (
                    <Icon name="check_circle" size={16} />
                  )}
                </button>
              ))}
            </div>

            <div className="flex gap-sm">
              <button
                onClick={() => setStep(3)}
                className="px-xl py-md border border-border-muted text-on-surface-variant font-mono-technical text-[11px] hover:border-primary/50 transition-colors"
              >
                ← BACK
              </button>
              <button
                onClick={() => setStep(5)}
                className="flex-1 px-xl py-md border border-primary text-primary font-mono-technical text-[11px] hover:bg-primary/10 transition-colors"
              >
                NEXT: NOTIFICATIONS →
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 5 — Notifications ─── */}
        {step === 5 && (
          <div>
            <StepHeader step={5} total={6} label="NOTIFICATIONS" />
            <h2 className="font-headline-md text-headline-md text-on-surface mb-sm">
              How should NexoriOS notify your team?
            </h2>
            <p className="font-body-base text-body-base text-on-surface-variant text-[13px] mb-xl">
              Select all that apply. These can be changed later in the Project Hub.
            </p>

            <div className="space-y-sm mb-xl">
              {NOTIFICATION_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-center gap-lg border px-lg py-md cursor-pointer transition-colors ${
                    notifications.includes(opt.id)
                      ? "border-primary bg-primary/5"
                      : "border-border-muted hover:border-primary/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={notifications.includes(opt.id)}
                    onChange={() => toggleNotification(opt.id)}
                    className="accent-primary w-4 h-4"
                  />
                  <span className="font-body-bold text-[13px] text-on-surface">{opt.label}</span>
                </label>
              ))}
            </div>

            <div className="bg-surface-container-low border border-border-muted px-lg py-md mb-xl">
              <p className="font-mono-technical text-[10px] text-on-surface-variant">
                Slack / Teams integration and email configuration are available in Admin → Connectors.
              </p>
            </div>

            <div className="flex gap-sm">
              <button
                onClick={() => setStep(4)}
                className="px-xl py-md border border-border-muted text-on-surface-variant font-mono-technical text-[11px] hover:border-primary/50 transition-colors"
              >
                ← BACK
              </button>
              <button
                onClick={() => setStep(6)}
                className="flex-1 px-xl py-md border border-primary text-primary font-mono-technical text-[11px] hover:bg-primary/10 transition-colors"
              >
                NEXT: CONFIRM →
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 6 — Confirmation ─── */}
        {step === 6 && (
          <div>
            <StepHeader step={6} total={6} label="CONFIRM & ACTIVATE" />
            <h2 className="font-headline-md text-headline-md text-on-surface mb-sm">
              Ready to activate monitoring
            </h2>
            <p className="font-body-base text-body-base text-on-surface-variant text-[13px] mb-xl">
              Review your setup. NexoriOS will start monitoring once you click Activate.
            </p>

            <div className="space-y-md mb-xl">
              {/* Project */}
              <div className="border border-border-muted">
                <div className="px-lg py-sm bg-surface-container-low border-b border-border-muted">
                  <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">PROJECT</p>
                </div>
                <div className="px-lg py-md space-y-xs">
                  <p className="font-body-bold text-[14px] text-on-surface">{projectName}</p>
                  <p className="font-mono-technical text-[10px] text-on-surface-variant">
                    KEY: {projectKey}
                    {programId && programs.find((p) => p.id === programId) && (
                      <> · PROGRAMME: {programs.find((p) => p.id === programId)?.name}</>
                    )}
                  </p>
                </div>
              </div>

              {/* Sources */}
              <div className="border border-border-muted">
                <div className="px-lg py-sm bg-surface-container-low border-b border-border-muted">
                  <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">
                    DELIVERY SOURCES ({sources.length})
                  </p>
                </div>
                <div className="px-lg py-md">
                  {sources.length === 0 ? (
                    <p className="font-mono-technical text-[10px] text-on-surface-variant">
                      No sources linked — you can add them from the Project Hub
                    </p>
                  ) : (
                    <div className="space-y-xs">
                      {sources.map((s) => (
                        <div key={s.boardId} className="flex items-center gap-md">
                          <span className="font-mono-technical text-[9px] border px-1 py-0.5 text-on-surface-variant border-border-muted">
                            {s.connectorType.toUpperCase()}
                          </span>
                          <span className="font-body-bold text-[12px] text-on-surface">{s.boardName}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Profile + Monitoring */}
              <div className="border border-border-muted">
                <div className="px-lg py-sm bg-surface-container-low border-b border-border-muted">
                  <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">GOVERNANCE & MONITORING</p>
                </div>
                <div className="px-lg py-md space-y-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-mono-technical text-[10px] text-on-surface-variant">Governance Profile</span>
                    <span className="font-body-bold text-[12px] text-on-surface">{selectedProfileMeta.label}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono-technical text-[10px] text-on-surface-variant">Monitoring Level</span>
                    <span className="font-body-bold text-[12px] text-on-surface">{selectedMonitoringMeta.label}</span>
                  </div>
                </div>
              </div>

              {/* What NexoriOS will do automatically */}
              <div className="border border-primary/30 bg-primary/5">
                <div className="px-lg py-sm border-b border-primary/20">
                  <p className="font-mono-technical text-[10px] text-primary tracking-widest">NEXORI WILL DO AUTOMATICALLY</p>
                </div>
                <div className="px-lg py-md space-y-xs">
                  {[
                    "Monitor linked sources for delivery risks",
                    "Detect missing evidence and stale approvals",
                    monitoringLevel !== "manual" ? "Generate delivery confidence scores" : null,
                    monitoringLevel === "scheduled" || monitoringLevel === "active" || monitoringLevel === "full_assisted" ? "Send weekly and sprint summaries" : null,
                    monitoringLevel === "active" || monitoringLevel === "full_assisted" ? "Alert on trigger rule matches" : null,
                    monitoringLevel === "full_assisted" ? "Create Jira tasks for required actions" : null,
                    notifications.includes("email_pm") ? "Notify project manager by email" : null,
                  ]
                    .filter(Boolean)
                    .map((item, i) => (
                      <div key={i} className="flex items-center gap-md">
                        <Icon name="check" size={12} />
                        <span className="font-mono-technical text-[10px] text-on-surface-variant">{item}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* What requires human approval */}
              <div className="border border-border-muted">
                <div className="px-lg py-sm bg-surface-container-low border-b border-border-muted">
                  <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">REQUIRES HUMAN APPROVAL</p>
                </div>
                <div className="px-lg py-md space-y-xs">
                  {[
                    "Final release decision",
                    "Risk acceptance sign-off",
                    "AI mode escalation",
                    profile === "regulated" || profile === "ai_sensitive" ? "Regulatory sign-off" : null,
                    profile === "critical" || profile === "regulated" ? "Security sign-off" : null,
                  ]
                    .filter(Boolean)
                    .map((item, i) => (
                      <div key={i} className="flex items-center gap-md">
                        <Icon name="person" size={12} />
                        <span className="font-mono-technical text-[10px] text-on-surface-variant">{item}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {submitError && (
              <p className="font-mono-technical text-[11px] text-critical mb-md">{submitError}</p>
            )}

            <div className="flex gap-sm">
              <button
                onClick={() => setStep(5)}
                className="px-xl py-md border border-border-muted text-on-surface-variant font-mono-technical text-[11px] hover:border-primary/50 transition-colors"
              >
                ← BACK
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                className="flex-1 px-xl py-lg bg-primary text-on-primary font-mono-technical text-[12px] hover:brightness-110 transition-all disabled:opacity-50 tracking-widest"
              >
                {submitting ? "ACTIVATING..." : "ACTIVATE PROJECT MONITORING →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
