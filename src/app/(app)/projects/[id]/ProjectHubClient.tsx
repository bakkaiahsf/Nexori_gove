"use client";

import { useState } from "react";
import Link from "next/link";

type Board = {
  id: string;
  boardId: string;
  boardName: string;
  boardType: string;
  enabled: boolean;
  connector: { id: string; type: string; name: string; baseUrl: string };
};

type CaseSummary = {
  id: string;
  title: string;
  phase: string;
  status: string;
  ownedBy: string;
  sourceEpicKey: string | null;
  createdAt: string;
  approvedGates: number;
  totalGates: number;
  commentCount: number;
  riskScore: { compositeScore: number; intensity: string } | null;
  reducedFromBaseline: number;
};

type AISetting = { mode: string; setBy: string; setAt: string; reason: string | null } | null;

type TriggerRule = {
  id: string;
  name: string;
  source: string;
  eventType: string;
  action: string;
  enabled: boolean;
  sourceProjectRef: string | null;
  lastRunAt: string | null;
  lastRunResult: string | null;
};

type RecentEvent = {
  id: string;
  type: string;
  actorEmail: string | null;
  timestamp: string;
  resourceType: string | null;
};

type GuardrailPush = {
  id: string;
  framework: string;
  status: string;
  prUrl: string | null;
  generatedAt: string;
};

interface Props {
  projectId: string;
  projectKey: string;
  projectName: string;
  programName: string | null;
  frameworks: string[];
  boards: Board[];
  activeCases: CaseSummary[];
  totalCases: number;
  aiSetting: AISetting;
  triggerRules: TriggerRule[];
  recentEvents: RecentEvent[];
  guardrailPushes: GuardrailPush[];
}

function Icon({ name, size = 16, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <span
      className={`material-symbols-outlined select-none leading-none ${className}`}
      style={{ fontSize: size, fontVariationSettings: "'FILL' 1" }}
    >
      {name}
    </span>
  );
}

const INTENSITY_CLS: Record<string, string> = {
  enhanced: "text-critical border-critical bg-critical/10",
  regulated: "text-tertiary border-tertiary bg-tertiary/10",
  standard: "text-primary border-primary bg-primary/10",
  minimal: "text-on-surface-variant border-border-muted",
};

const MODE_LABELS: Record<string, { label: string; cls: string }> = {
  HUMAN_ONLY: { label: "Human Only", cls: "text-on-surface-variant border-border-muted" },
  AI_ASSIST: { label: "Assisted", cls: "text-primary border-primary" },
  AI_REVIEW: { label: "Review Mode", cls: "text-primary border-primary" },
  AI_CONTROLLED_ACTION: { label: "Governed", cls: "text-tertiary border-tertiary" },
  EMERGENCY_LOCK: { label: "Emergency Lock", cls: "text-critical border-critical" },
};

const EVENT_LABEL: Partial<Record<string, string>> = {
  CASE_CREATED: "Item created",
  CASE_RESOLVED: "Item resolved",
  CASE_REOPENED: "Item reopened",
  CASE_COMMENT_ADDED: "Comment added",
  GATE_APPROVED: "Check approved",
  GATE_REJECTED: "Check rejected",
  RISK_SCORED: "Risk assessed",
  PIPELINE_ADAPTED: "Pipeline optimized",
  AI_MODE_CHANGED: "Intelligence mode changed",
  EVIDENCE_SUBMITTED: "Evidence submitted",
  BOARD_ADDED: "Source linked",
  PROJECT_CREATED: "Project activated",
};

const SOURCE_ICON: Record<string, string> = { github: "GH", gitlab: "GL", jira: "JI" };

const SUMMARY_TYPES = [
  { id: "sprint", label: "Sprint Summary", desc: "What's happened this sprint" },
  { id: "weekly", label: "Weekly Summary", desc: "Weekly delivery confidence overview" },
  { id: "release", label: "Release Readiness", desc: "Ready for production?" },
  { id: "risk", label: "Risk Summary", desc: "Open risks and mitigations" },
  { id: "evidence", label: "Evidence Gaps", desc: "Missing or stale evidence" },
];

function SectionHeader({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="px-lg py-sm bg-surface-container-low border-b border-border-muted flex items-center justify-between">
      <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">{label}</p>
      {sub && <p className="font-mono-technical text-[9px] text-on-surface-variant">{sub}</p>}
    </div>
  );
}

export default function ProjectHubClient({
  projectId,
  projectKey,
  projectName,
  programName,
  frameworks,
  boards,
  activeCases,
  totalCases,
  aiSetting,
  triggerRules,
  recentEvents,
  guardrailPushes,
}: Props) {
  const [syncingBoard, setSyncingBoard] = useState<string | null>(null);
  const [summaryType, setSummaryType] = useState("sprint");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Compute delivery confidence
  const pendingChecks = activeCases.reduce((acc, c) => acc + Math.max(0, c.totalGates - c.approvedGates), 0);
  const totalChecks = activeCases.reduce((acc, c) => acc + c.totalGates, 0);
  const approvedChecks = activeCases.reduce((acc, c) => acc + c.approvedGates, 0);
  const blockedCases = activeCases.filter((c) => c.approvedGates === 0 && c.totalGates > 0);
  const highRiskCases = activeCases.filter((c) => c.riskScore?.intensity === "enhanced" || c.riskScore?.intensity === "regulated");
  const totalSkipped = activeCases.reduce((acc, c) => acc + c.reducedFromBaseline, 0);

  // Compute simple verdict
  const verdict =
    highRiskCases.length > 0 && blockedCases.length > 0
      ? { label: "Blocked", cls: "text-critical border-critical bg-critical/10", icon: "cancel" }
      : pendingChecks > 2 || highRiskCases.length > 0
        ? { label: "Needs Attention", cls: "text-tertiary border-tertiary bg-tertiary/10", icon: "warning" }
        : activeCases.length === 0 || pendingChecks === 0
          ? { label: "Ready to Release", cls: "text-primary border-primary bg-primary/10", icon: "check_circle" }
          : { label: "On Track", cls: "text-primary border-primary bg-primary/10", icon: "trending_up" };

  // Compute "What Needs Attention" items
  const attentionItems: Array<{ type: string; label: string; link?: string; severity: "high" | "medium" | "low" }> = [];

  blockedCases.forEach((c) => {
    attentionItems.push({
      type: "BLOCKED ITEM",
      label: `${c.title} — no readiness checks cleared`,
      link: `/cases/${c.id}`,
      severity: "high",
    });
  });

  highRiskCases.forEach((c) => {
    if (!blockedCases.find((b) => b.id === c.id)) {
      attentionItems.push({
        type: "HIGH RISK",
        label: `${c.title} — ${c.riskScore?.intensity} risk`,
        link: `/cases/${c.id}`,
        severity: "medium",
      });
    }
  });

  if (boards.length === 0) {
    attentionItems.push({
      type: "NO SOURCES",
      label: "No delivery sources linked — connect Jira, GitHub, or GitLab",
      link: `/projects/start`,
      severity: "medium",
    });
  }

  activeCases.forEach((c) => {
    if (c.totalGates > 0 && c.approvedGates < c.totalGates && !blockedCases.find((b) => b.id === c.id)) {
      attentionItems.push({
        type: "PENDING",
        label: `${c.title} — ${c.totalGates - c.approvedGates} check${c.totalGates - c.approvedGates !== 1 ? "s" : ""} awaiting approval`,
        link: `/cases/${c.id}`,
        severity: "low",
      });
    }
  });

  const activeRules = triggerRules.filter((r) => r.enabled);

  async function handleSync(board: Board) {
    setSyncingBoard(board.id);
    try {
      await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, connectorId: board.connector.id, boardId: board.boardId }),
      });
    } finally {
      setSyncingBoard(null);
    }
  }

  async function generateSummary() {
    setSummaryLoading(true);
    setSummaryError(null);
    setSummaryText(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summaryType }),
      });
      const data = await res.json() as { summary?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to generate summary");
      setSummaryText(data.summary ?? "No summary generated.");
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Failed to generate summary");
    } finally {
      setSummaryLoading(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="max-w-[1100px] mx-auto p-xl space-y-xl">

        {/* ── A. Delivery Confidence ─────────────────────────────────── */}
        <section className="bg-surface border border-border-muted">
          <SectionHeader label="DELIVERY CONFIDENCE" />
          <div className="p-lg">
            <div className="flex items-center gap-xl">
              <div className={`flex items-center gap-md px-lg py-md border ${verdict.cls}`}>
                <Icon name={verdict.icon} size={20} className={verdict.cls.split(" ")[0]} />
                <span className="font-body-bold text-[16px]">{verdict.label}</span>
              </div>
              <div className="flex gap-xl font-mono-technical text-[10px] text-on-surface-variant">
                <div>
                  <p className="text-primary font-bold text-[18px] leading-none">{activeCases.length}</p>
                  <p className="mt-xs">ACTIVE ITEMS</p>
                </div>
                <div>
                  <p className={`font-bold text-[18px] leading-none ${pendingChecks > 0 ? "text-tertiary" : "text-on-surface"}`}>{pendingChecks}</p>
                  <p className="mt-xs">PENDING CHECKS</p>
                </div>
                <div>
                  <p className="font-bold text-[18px] leading-none text-on-surface">{totalChecks > 0 ? Math.round((approvedChecks / totalChecks) * 100) : 100}%</p>
                  <p className="mt-xs">CHECKS CLEARED</p>
                </div>
                {totalSkipped > 0 && (
                  <div>
                    <p className="font-bold text-[18px] leading-none text-primary">{totalSkipped}</p>
                    <p className="mt-xs">CHECKS OPTIMIZED</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="px-lg pb-lg flex flex-wrap gap-sm">
            <Link
              href={`/release-readiness?projectId=${projectId}`}
              className="px-md py-xs border border-primary text-primary font-mono-technical text-[10px] hover:bg-primary/10 transition-colors"
            >
              RELEASE READINESS →
            </Link>
            <Link
              href={`/cases?projectId=${projectId}`}
              className="px-md py-xs border border-border-muted text-on-surface-variant font-mono-technical text-[10px] hover:border-primary hover:text-primary transition-colors"
            >
              ALL ASSURANCE ITEMS →
            </Link>
          </div>
        </section>

        {/* ── B. What Needs Attention ─────────────────────────────────── */}
        <section className="bg-surface border border-border-muted">
          <SectionHeader
            label="WHAT NEEDS ATTENTION"
            sub={attentionItems.length === 0 ? "NOTHING — ALL CLEAR" : `${attentionItems.length} ITEM${attentionItems.length !== 1 ? "S" : ""}`}
          />
          {attentionItems.length === 0 ? (
            <div className="p-lg flex items-center gap-md">
              <Icon name="check_circle" size={18} className="text-primary" />
              <p className="font-mono-technical text-[11px] text-primary">
                No attention required. All delivery items are on track.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border-muted">
              {attentionItems.map((item, i) => (
                <div key={i} className="px-lg py-md flex items-start gap-md">
                  <span className={`mt-0.5 font-mono-technical text-[9px] border px-1.5 py-0.5 shrink-0 ${
                    item.severity === "high" ? "text-critical border-critical" :
                    item.severity === "medium" ? "text-tertiary border-tertiary" :
                    "text-on-surface-variant border-border-muted"
                  }`}>
                    {item.type}
                  </span>
                  <p className="font-mono-technical text-[11px] text-on-surface flex-1">{item.label}</p>
                  {item.link && (
                    <Link href={item.link} className="font-mono-technical text-[10px] text-primary hover:underline shrink-0">
                      REVIEW →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── C. Assurance Items ─────────────────────────────────────── */}
        <section className="bg-surface border border-border-muted">
          <SectionHeader label="ASSURANCE ITEMS" sub={`${activeCases.length} ACTIVE · ${totalCases} TOTAL`} />
          {activeCases.length === 0 ? (
            <div className="p-lg text-center">
              <p className="font-mono-technical text-[11px] text-on-surface-variant mb-md">No active assurance items.</p>
              <Link
                href="/cases"
                className="inline-block font-mono-technical text-[10px] text-primary hover:underline"
              >
                VIEW ALL ITEMS →
              </Link>
            </div>
          ) : (
            <>
              <div className="divide-y divide-border-muted">
                {activeCases.slice(0, 6).map((c) => {
                  const pct = c.totalGates > 0 ? Math.round((c.approvedGates / c.totalGates) * 100) : 100;
                  const intensityCls = INTENSITY_CLS[c.riskScore?.intensity ?? "minimal"] ?? "";
                  return (
                    <div key={c.id} className="px-lg py-md hover:bg-surface-container-low transition-colors">
                      <div className="flex items-start gap-md">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-sm flex-wrap mb-xs">
                            <span className="font-mono-technical text-[9px] border border-border-muted px-1.5 py-0.5 text-on-surface-variant">
                              {c.phase.replace("-", " ").toUpperCase()}
                            </span>
                            {c.riskScore && (
                              <span className={`font-mono-technical text-[9px] border px-1.5 py-0.5 ${intensityCls}`}>
                                {c.riskScore.intensity.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <p className="font-body-bold text-[13px] text-on-surface mb-xs truncate">{c.title}</p>
                          <div className="flex items-center gap-md">
                            <div className="flex-1 h-1 bg-surface-container-highest relative">
                              <div
                                className={`absolute top-0 left-0 h-full ${pct === 100 ? "bg-primary" : pct > 50 ? "bg-tertiary" : "bg-critical"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="font-mono-technical text-[9px] text-on-surface-variant shrink-0">
                              {c.approvedGates}/{c.totalGates}
                            </span>
                          </div>
                        </div>
                        <Link href={`/cases/${c.id}`} className="font-mono-technical text-[10px] text-primary hover:underline shrink-0 pt-1">
                          OPEN →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="px-lg py-md border-t border-border-muted">
                <Link href={`/cases?projectId=${projectId}`} className="font-mono-technical text-[10px] text-primary hover:underline">
                  VIEW ALL {totalCases} ASSURANCE ITEMS →
                </Link>
              </div>
            </>
          )}
        </section>

        {/* ── D. Source Links ─────────────────────────────────────────── */}
        <section className="bg-surface border border-border-muted">
          <SectionHeader label="DELIVERY SOURCES" sub={`${boards.length} CONNECTED`} />
          {boards.length === 0 ? (
            <div className="p-lg text-center space-y-md">
              <p className="font-mono-technical text-[11px] text-on-surface-variant">No sources linked yet.</p>
              <Link
                href="/projects/start"
                className="inline-block font-mono-technical text-[10px] text-primary hover:underline"
              >
                LINK A SOURCE →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border-muted">
              {boards.map((b) => (
                <div key={b.id} className="p-lg">
                  <div className="flex items-start justify-between mb-md">
                    <div className="flex items-center gap-md">
                      <div className="w-8 h-8 border border-border-muted flex items-center justify-center font-mono-technical text-[10px] text-primary shrink-0">
                        {SOURCE_ICON[b.connector.type] ?? b.connector.type.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-body-bold text-[12px] text-on-surface">{b.connector.name}</p>
                        <p className="font-mono-technical text-[9px] text-on-surface-variant truncate max-w-[180px]">{b.boardId}</p>
                      </div>
                    </div>
                    <span className={`font-mono-technical text-[9px] border px-1.5 py-0.5 ${b.enabled ? "text-primary border-primary" : "text-on-surface-variant border-border-muted"}`}>
                      {b.enabled ? "ACTIVE" : "DISABLED"}
                    </span>
                  </div>
                  <div className="flex gap-sm">
                    <button
                      disabled={syncingBoard === b.id}
                      onClick={() => handleSync(b)}
                      className="flex-1 py-xs border border-border-muted text-on-surface-variant font-mono-technical text-[10px] hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                    >
                      {syncingBoard === b.id ? "SYNCING..." : "SYNC NOW"}
                    </button>
                    {b.connector.baseUrl && (
                      <a
                        href={b.connector.baseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-md py-xs border border-border-muted text-on-surface-variant font-mono-technical text-[10px] hover:border-primary hover:text-primary transition-colors"
                      >
                        OPEN →
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── E. Monitoring & Schedule ─────────────────────────────────── */}
        <section className="bg-surface border border-border-muted">
          <SectionHeader label="MONITORING & SCHEDULE" sub={`${activeRules.length} ACTIVE RULES`} />
          <div className="p-lg space-y-lg">
            {/* AI Mode */}
            {aiSetting && (
              <div className="flex items-center gap-md">
                <span className="font-mono-technical text-[10px] text-on-surface-variant">INTELLIGENCE MODE</span>
                <span className={`font-mono-technical text-[9px] border px-1.5 py-0.5 ${(MODE_LABELS[aiSetting.mode] ?? MODE_LABELS.AI_ASSIST).cls}`}>
                  {(MODE_LABELS[aiSetting.mode] ?? { label: aiSetting.mode }).label.toUpperCase()}
                </span>
                <Link href={`/ai-control?projectId=${projectId}`} className="font-mono-technical text-[10px] text-on-surface-variant hover:text-primary transition-colors">
                  CHANGE →
                </Link>
              </div>
            )}

            {/* Monitoring rules */}
            {activeRules.length === 0 ? (
              <div>
                <p className="font-mono-technical text-[11px] text-on-surface-variant mb-md">No monitoring rules active.</p>
                <Link
                  href={`/admin/trigger-rules?project=${projectId}`}
                  className="font-mono-technical text-[10px] text-primary hover:underline"
                >
                  CONFIGURE MONITORING RULES →
                </Link>
              </div>
            ) : (
              <div className="space-y-xs">
                {activeRules.slice(0, 4).map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-xs border-b border-border-muted last:border-0">
                    <div className="flex items-center gap-md">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      <span className="font-mono-technical text-[10px] text-on-surface">{r.name}</span>
                    </div>
                    <span className="font-mono-technical text-[9px] text-on-surface-variant">{r.source.toUpperCase()} · {r.eventType}</span>
                  </div>
                ))}
                {activeRules.length > 4 && (
                  <Link href={`/admin/trigger-rules?project=${projectId}`} className="font-mono-technical text-[10px] text-on-surface-variant hover:text-primary transition-colors">
                    +{activeRules.length - 4} more rules →
                  </Link>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── F. Evidence & Frameworks ─────────────────────────────────── */}
        <section className="bg-surface border border-border-muted">
          <SectionHeader label="EVIDENCE & FRAMEWORKS" sub={`${frameworks.length} FRAMEWORK${frameworks.length !== 1 ? "S" : ""}`} />
          <div className="p-lg space-y-md">
            {frameworks.length > 0 ? (
              <div className="flex flex-wrap gap-xs">
                {frameworks.map((f) => (
                  <span key={f} className="px-2 py-1 font-mono-technical text-[10px] border border-primary/40 text-primary">
                    {f.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            ) : (
              <p className="font-mono-technical text-[11px] text-on-surface-variant">No regulatory frameworks mapped yet.</p>
            )}
            <Link
              href={`/evidence?projectId=${projectId}`}
              className="inline-flex items-center gap-sm font-mono-technical text-[10px] text-primary hover:underline"
            >
              <Icon name="inventory_2" size={12} className="text-primary" />
              OPEN EVIDENCE HUB →
            </Link>
          </div>
        </section>

        {/* ── G. Activity Timeline ─────────────────────────────────────── */}
        <section className="bg-surface border border-border-muted">
          <SectionHeader label="RECENT ACTIVITY" sub={`${recentEvents.length} EVENTS`} />
          {recentEvents.length === 0 ? (
            <div className="p-lg">
              <p className="font-mono-technical text-[11px] text-on-surface-variant">No activity recorded yet.</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-border-muted">
                {recentEvents.slice(0, 8).map((e) => (
                  <div key={e.id} className="px-lg py-sm flex items-center gap-md">
                    <span className="font-mono-technical text-[9px] text-on-surface-variant w-[130px] shrink-0">
                      {new Date(e.timestamp).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="font-mono-technical text-[10px] text-on-surface flex-1">
                      {EVENT_LABEL[e.type] ?? e.type.replace(/_/g, " ")}
                    </span>
                    {e.actorEmail && (
                      <span className="font-mono-technical text-[9px] text-on-surface-variant shrink-0 truncate max-w-[140px]">
                        {e.actorEmail}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="px-lg py-md border-t border-border-muted">
                <Link href={`/timeline?projectId=${projectId}`} className="font-mono-technical text-[10px] text-primary hover:underline">
                  FULL FLIGHT RECORDER →
                </Link>
              </div>
            </>
          )}
        </section>

        {/* ── H. Summary Generator ─────────────────────────────────────── */}
        <section className="bg-surface border border-border-muted">
          <SectionHeader label="SUMMARY GENERATOR" />
          <div className="p-lg space-y-lg">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-sm">
              {SUMMARY_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setSummaryType(t.id); setSummaryText(null); }}
                  className={`text-left border px-md py-sm transition-colors ${
                    summaryType === t.id
                      ? "border-primary bg-primary/5"
                      : "border-border-muted hover:border-primary/50"
                  }`}
                >
                  <p className="font-body-bold text-[12px] text-on-surface">{t.label}</p>
                  <p className="font-mono-technical text-[9px] text-on-surface-variant mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>

            <button
              onClick={generateSummary}
              disabled={summaryLoading}
              className="w-full px-xl py-md border border-primary text-primary font-mono-technical text-[11px] hover:bg-primary/10 transition-colors disabled:opacity-40"
            >
              {summaryLoading ? "GENERATING..." : `GENERATE ${SUMMARY_TYPES.find((t) => t.id === summaryType)?.label.toUpperCase()} →`}
            </button>

            {summaryError && (
              <p className="font-mono-technical text-[11px] text-critical">{summaryError}</p>
            )}

            {summaryText && (
              <div className="bg-surface-container-low border border-border-muted p-lg">
                <div className="flex items-center justify-between mb-md">
                  <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">
                    {SUMMARY_TYPES.find((t) => t.id === summaryType)?.label.toUpperCase()} — {projectKey}
                  </p>
                  <button
                    onClick={() => navigator.clipboard?.writeText(summaryText)}
                    className="font-mono-technical text-[9px] text-on-surface-variant hover:text-primary transition-colors"
                  >
                    COPY
                  </button>
                </div>
                <p className="font-mono-technical text-[11px] text-on-surface whitespace-pre-wrap leading-relaxed">
                  {summaryText}
                </p>
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
