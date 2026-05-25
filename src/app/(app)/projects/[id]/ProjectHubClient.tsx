"use client";

import { useState } from "react";
import Link from "next/link";

type TabId = "overview" | "readiness" | "items" | "evidence" | "timeline" | "intelligence" | "controls" | "sources";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "OVERVIEW" },
  { id: "readiness", label: "READINESS" },
  { id: "items", label: "ASSURANCE ITEMS" },
  { id: "evidence", label: "OPERATIONAL EVIDENCE" },
  { id: "timeline", label: "ACTIVITY TIMELINE" },
  { id: "intelligence", label: "INTELLIGENCE" },
  { id: "controls", label: "CONTROLS" },
  { id: "sources", label: "SOURCES" },
];

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
      style={{ fontSize: size }}
    >
      {name}
    </span>
  );
}

function StatCard({ label, value, sub, cls = "" }: { label: string; value: string | number; sub?: string; cls?: string }) {
  return (
    <div className="bg-surface border border-border-muted p-lg">
      <p className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest mb-xs">{label}</p>
      <p className={`font-bold leading-none ${cls || "text-on-surface"}`} style={{ fontSize: 28 }}>
        {value}
      </p>
      {sub && <p className="font-mono-technical text-[9px] text-on-surface-variant mt-xs">{sub}</p>}
    </div>
  );
}

const INTENSITY_CLS: Record<string, string> = {
  enhanced: "text-critical border-critical",
  regulated: "text-tertiary border-tertiary",
  standard: "text-primary border-primary",
  minimal: "text-on-surface-variant border-border-muted",
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
  GUARDRAIL_PUSHED: "Assurance rules pushed",
  EVIDENCE_SUBMITTED: "Evidence submitted",
  WAIVER_REQUESTED: "Risk acceptance requested",
  WAIVER_APPROVED: "Risk acceptance approved",
};

const MODE_LABELS: Record<string, { label: string; desc: string; cls: string }> = {
  HUMAN_ONLY: { label: "Human Only", desc: "All decisions manual, intelligence disabled", cls: "text-on-surface-variant border-border-muted" },
  AI_ASSIST: { label: "Assisted Intelligence", desc: "Intelligence suggests, human decides", cls: "text-primary border-primary" },
  AI_REVIEW: { label: "Review Intelligence", desc: "Intelligence flags risk, human approves", cls: "text-primary border-primary" },
  AI_CONTROLLED_ACTION: { label: "Governed Intelligence", desc: "Intelligence acts within policy bounds", cls: "text-tertiary border-tertiary" },
  EMERGENCY_LOCK: { label: "Emergency Lock", desc: "Intelligence immediately disabled", cls: "text-critical border-critical" },
};

const SOURCE_ICON: Record<string, string> = { github: "GH", gitlab: "GL", jira: "JI" };

export default function ProjectHubClient({
  projectId,
  projectKey,
  frameworks,
  boards,
  activeCases,
  totalCases,
  aiSetting,
  triggerRules,
  recentEvents,
  guardrailPushes,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [syncingBoard, setSyncingBoard] = useState<string | null>(null);

  const pendingChecks = activeCases.reduce((acc, c) => acc + (c.totalGates - c.approvedGates), 0);
  const blockedCases = activeCases.filter((c) => c.approvedGates === 0 && c.totalGates > 0);
  const totalSkipped = activeCases.reduce((acc, c) => acc + c.reducedFromBaseline, 0);

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

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-border-muted bg-surface overflow-x-auto shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-lg py-md font-mono-technical text-[10px] tracking-widest border-b-2 whitespace-nowrap transition-colors shrink-0 ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-xl">
        <div className="max-w-[1200px] mx-auto">

          {/* ── OVERVIEW ── */}
          {activeTab === "overview" && (
            <div className="space-y-lg">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-lg">
                <StatCard label="ACTIVE ITEMS" value={activeCases.length} sub={`${totalCases} total`} cls="text-primary" />
                <StatCard label="PENDING CHECKS" value={pendingChecks} sub="awaiting action" cls={pendingChecks > 0 ? "text-tertiary" : "text-on-surface"} />
                <StatCard label="FRAMEWORKS" value={frameworks.length} sub={frameworks.slice(0, 2).join(", ")} />
                <StatCard label="SOURCES" value={boards.length} sub={`${boards.filter(b => b.enabled).length} active`} cls="text-primary" />
              </div>

              {totalSkipped > 0 && (
                <div className="border border-primary/30 bg-surface p-lg flex items-center gap-lg">
                  <Icon name="trending_down" size={20} className="text-primary shrink-0" />
                  <div>
                    <p className="font-mono-technical text-[11px] text-primary font-bold">
                      {totalSkipped} CHECKS OPTIMIZED BY ADAPTIVE ENGINE
                    </p>
                    <p className="font-mono-technical text-[10px] text-on-surface-variant mt-xs">
                      Estimated ≈{totalSkipped * 2}h returned to delivery teams
                    </p>
                  </div>
                </div>
              )}

              {blockedCases.length > 0 && (
                <div className="border border-critical/30 bg-surface p-lg">
                  <p className="font-mono-technical text-[10px] text-critical tracking-widest mb-md">
                    {blockedCases.length} ITEM{blockedCases.length !== 1 ? "S" : ""} NEED ATTENTION
                  </p>
                  <div className="space-y-xs">
                    {blockedCases.slice(0, 3).map((c) => (
                      <div key={c.id} className="flex items-center justify-between py-xs border-b border-border-muted last:border-0">
                        <span className="font-mono-technical text-[11px] text-on-surface truncate flex-1 mr-md">{c.title}</span>
                        <Link href={`/cases/${c.id}`} className="font-mono-technical text-[10px] text-primary shrink-0 hover:underline">
                          REVIEW →
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <section className="bg-surface border border-border-muted">
                <div className="px-lg py-md border-b border-border-muted flex items-center gap-md">
                  <Icon name="history" size={14} />
                  <span className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">RECENT ACTIVITY</span>
                </div>
                <div className="divide-y divide-border-muted">
                  {recentEvents.length === 0 ? (
                    <p className="p-lg font-mono-technical text-[11px] text-on-surface-variant">No recent activity.</p>
                  ) : (
                    recentEvents.slice(0, 8).map((e) => (
                      <div key={e.id} className="px-lg py-sm flex items-center gap-md">
                        <span className="font-mono-technical text-[9px] text-on-surface-variant w-[140px] shrink-0">
                          {new Date(e.timestamp).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="font-mono-technical text-[10px] text-on-surface flex-1">
                          {EVENT_LABEL[e.type] ?? e.type.replace(/_/g, " ")}
                        </span>
                        {e.actorEmail && (
                          <span className="font-mono-technical text-[9px] text-on-surface-variant shrink-0">{e.actorEmail}</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
                <div className="px-lg py-md border-t border-border-muted">
                  <Link href={`/timeline?projectId=${projectId}`} className="font-mono-technical text-[10px] text-primary hover:underline">
                    FULL ACTIVITY TIMELINE →
                  </Link>
                </div>
              </section>
            </div>
          )}

          {/* ── READINESS ── */}
          {activeTab === "readiness" && (
            <div className="space-y-lg">
              {activeCases.length === 0 ? (
                <div className="border border-border-muted p-xl text-center">
                  <p className="font-mono-technical text-[11px] text-on-surface-variant">No active assurance items.</p>
                </div>
              ) : (
                <>
                  <div className={`border-2 p-lg flex items-center gap-lg ${blockedCases.length > 0 ? "border-critical/60 bg-critical/5" : "border-primary/60 bg-primary/5"}`}>
                    <div className={`w-14 h-14 border-2 flex items-center justify-center shrink-0 ${blockedCases.length > 0 ? "border-critical" : "border-primary"}`}>
                      <Icon name={blockedCases.length > 0 ? "cancel" : "check_circle"} size={24} className={blockedCases.length > 0 ? "text-critical" : "text-primary"} />
                    </div>
                    <div>
                      <p className={`font-mono-technical text-[18px] font-bold ${blockedCases.length > 0 ? "text-critical" : "text-primary"}`}>
                        {blockedCases.length > 0 ? "NEEDS ATTENTION" : "PROCEEDING WITH CONFIDENCE"}
                      </p>
                      <p className="font-mono-technical text-[10px] text-on-surface-variant mt-xs">
                        {activeCases.length} active item{activeCases.length !== 1 ? "s" : ""} · {pendingChecks} pending check{pendingChecks !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-md">
                    {activeCases.map((c) => {
                      const pct = c.totalGates > 0 ? Math.round((c.approvedGates / c.totalGates) * 100) : 100;
                      const cls = INTENSITY_CLS[c.riskScore?.intensity ?? "minimal"] ?? "";
                      return (
                        <div key={c.id} className="bg-surface border border-border-muted p-lg">
                          <div className="flex items-start justify-between gap-md mb-md">
                            <div className="flex-1 min-w-0">
                              <p className="font-body-bold text-body-bold text-on-surface text-[13px] truncate">{c.title}</p>
                              <div className="flex flex-wrap gap-xs mt-xs">
                                <span className="font-mono-technical text-[9px] border border-border-muted px-1.5 py-0.5 text-on-surface-variant">
                                  {c.phase.replace("-", " ").toUpperCase()}
                                </span>
                                {c.riskScore && (
                                  <span className={`font-mono-technical text-[9px] border px-1.5 py-0.5 ${cls}`}>
                                    {c.riskScore.intensity.toUpperCase()}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Link href={`/cases/${c.id}`} className="font-mono-technical text-[10px] text-primary hover:underline shrink-0">
                              DETAIL →
                            </Link>
                          </div>
                          <div className="flex items-center gap-md">
                            <div className="flex-1 h-1.5 bg-surface-container-highest relative">
                              <div
                                className={`absolute top-0 left-0 h-full transition-all ${pct === 100 ? "bg-primary" : pct > 50 ? "bg-tertiary" : "bg-critical"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="font-mono-technical text-[10px] text-on-surface-variant shrink-0">
                              {c.approvedGates}/{c.totalGates} CLEARED
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="flex gap-md">
                <Link
                  href={`/release-readiness?projectId=${projectId}`}
                  className="px-lg py-sm border border-primary text-primary font-mono-technical text-[10px] hover:bg-primary/10 transition-colors"
                >
                  FULL READINESS ASSESSMENT →
                </Link>
              </div>
            </div>
          )}

          {/* ── ASSURANCE ITEMS ── */}
          {activeTab === "items" && (
            <div className="space-y-lg">
              <div className="flex items-center justify-between mb-md">
                <span className="font-mono-technical text-[10px] text-on-surface-variant">
                  {activeCases.length} ACTIVE · {totalCases} TOTAL
                </span>
                <Link
                  href="/cases/new"
                  className="px-md py-xs border border-primary text-primary font-mono-technical text-[10px] hover:bg-primary/10 transition-colors"
                >
                  + NEW ITEM
                </Link>
              </div>

              {activeCases.length === 0 ? (
                <div className="border border-border-muted p-xl text-center">
                  <p className="font-mono-technical text-[11px] text-on-surface-variant">No active assurance items.</p>
                </div>
              ) : (
                <div className="space-y-md">
                  {activeCases.map((c) => {
                    const pct = c.totalGates > 0 ? Math.round((c.approvedGates / c.totalGates) * 100) : 100;
                    const cls = INTENSITY_CLS[c.riskScore?.intensity ?? "minimal"] ?? "";
                    return (
                      <div key={c.id} className="bg-surface border border-border-muted p-lg hover:border-primary/40 transition-colors">
                        <div className="flex items-start justify-between gap-md mb-sm">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-sm flex-wrap mb-xs">
                              <span className="font-mono-technical text-[9px] border border-border-muted px-1.5 py-0.5 text-on-surface-variant">
                                {c.phase.replace("-", " ").toUpperCase()}
                              </span>
                              {c.riskScore && (
                                <span className={`font-mono-technical text-[9px] border px-1.5 py-0.5 ${cls}`}>
                                  {c.riskScore.intensity.toUpperCase()}
                                </span>
                              )}
                              {c.commentCount > 0 && (
                                <span className="font-mono-technical text-[9px] border border-border-muted px-1.5 py-0.5 text-on-surface-variant">
                                  {c.commentCount} COMMENTS
                                </span>
                              )}
                            </div>
                            <p className="font-body-bold text-body-bold text-on-surface text-[13px] truncate">{c.title}</p>
                            <p className="font-mono-technical text-[9px] text-on-surface-variant mt-xs">
                              OWNER: {c.ownedBy}
                              {c.sourceEpicKey && ` · ${c.sourceEpicKey}`}
                            </p>
                          </div>
                          <Link
                            href={`/cases/${c.id}`}
                            className="font-mono-technical text-[10px] text-primary hover:underline shrink-0"
                          >
                            DETAIL →
                          </Link>
                        </div>
                        <div className="flex items-center gap-md mt-sm">
                          <div className="flex-1 h-1 bg-surface-container-highest relative">
                            <div
                              className={`absolute top-0 left-0 h-full transition-all ${pct === 100 ? "bg-primary" : pct > 50 ? "bg-tertiary" : "bg-critical"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="font-mono-technical text-[9px] text-on-surface-variant shrink-0">
                            {c.approvedGates}/{c.totalGates}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <Link
                href={`/cases?projectId=${projectId}`}
                className="font-mono-technical text-[10px] text-primary hover:underline"
              >
                VIEW ALL ASSURANCE ITEMS →
              </Link>
            </div>
          )}

          {/* ── OPERATIONAL EVIDENCE ── */}
          {activeTab === "evidence" && (
            <div className="space-y-lg">
              <div className="grid grid-cols-3 gap-lg">
                <StatCard label="FRAMEWORKS COVERED" value={frameworks.length} />
                <StatCard label="LINKED SOURCES" value={boards.length} />
                <StatCard label="ACTIVE ITEMS" value={activeCases.length} sub="evidence scope" />
              </div>
              <div className="border border-border-muted p-lg">
                <p className="font-mono-technical text-[10px] text-on-surface-variant mb-md">FRAMEWORKS</p>
                <div className="flex flex-wrap gap-xs">
                  {frameworks.map((f) => (
                    <span key={f} className="px-2 py-0.5 font-mono-technical text-[10px] border border-primary/40 text-primary">
                      {f.replace(/_/g, " ")}
                    </span>
                  ))}
                  {frameworks.length === 0 && (
                    <span className="font-mono-technical text-[10px] text-on-surface-variant">No frameworks configured</span>
                  )}
                </div>
              </div>
              <Link
                href={`/evidence?projectId=${projectId}`}
                className="inline-flex items-center gap-sm px-lg py-sm border border-primary text-primary font-mono-technical text-[10px] hover:bg-primary/10 transition-colors"
              >
                <Icon name="inventory_2" size={14} />
                OPEN EVIDENCE HUB →
              </Link>
            </div>
          )}

          {/* ── ACTIVITY TIMELINE ── */}
          {activeTab === "timeline" && (
            <div className="space-y-lg">
              <section className="bg-surface border border-border-muted">
                <div className="px-lg py-md border-b border-border-muted flex items-center gap-md">
                  <Icon name="history" size={14} />
                  <span className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">RECENT DECISIONS</span>
                </div>
                <div className="divide-y divide-border-muted">
                  {recentEvents.map((e) => (
                    <div key={e.id} className="px-lg py-sm flex items-start gap-md">
                      <span className="font-mono-technical text-[9px] text-on-surface-variant w-[140px] shrink-0 pt-0.5">
                        {new Date(e.timestamp).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono-technical text-[10px] text-on-surface">
                          {EVENT_LABEL[e.type] ?? e.type.replace(/_/g, " ")}
                        </p>
                        {e.actorEmail && (
                          <p className="font-mono-technical text-[9px] text-on-surface-variant mt-0.5">{e.actorEmail}</p>
                        )}
                      </div>
                      {e.resourceType && (
                        <span className="font-mono-technical text-[9px] border border-border-muted px-1.5 py-0.5 text-on-surface-variant shrink-0">
                          {e.resourceType}
                        </span>
                      )}
                    </div>
                  ))}
                  {recentEvents.length === 0 && (
                    <p className="p-lg font-mono-technical text-[11px] text-on-surface-variant">No activity recorded.</p>
                  )}
                </div>
              </section>
              <Link
                href={`/timeline?projectId=${projectId}`}
                className="inline-flex items-center gap-sm px-lg py-sm border border-primary text-primary font-mono-technical text-[10px] hover:bg-primary/10 transition-colors"
              >
                <Icon name="history" size={14} />
                FULL ACTIVITY TIMELINE →
              </Link>
            </div>
          )}

          {/* ── INTELLIGENCE ── */}
          {activeTab === "intelligence" && (
            <div className="space-y-lg">
              <section className="bg-surface border border-border-muted">
                <div className="px-lg py-md border-b border-border-muted flex items-center gap-md">
                  <Icon name="policy" size={14} />
                  <span className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">ASSURANCE RULES SYNC</span>
                </div>
                <div className="divide-y divide-border-muted">
                  {guardrailPushes.length === 0 ? (
                    <p className="p-lg font-mono-technical text-[11px] text-on-surface-variant">
                      No assurance rules pushed yet.
                    </p>
                  ) : (
                    guardrailPushes.map((g) => (
                      <div key={g.id} className="px-lg py-sm flex items-center gap-md">
                        <span className={`font-mono-technical text-[9px] border px-1.5 py-0.5 shrink-0 ${
                          g.status === "MERGED" ? "border-primary text-primary" :
                          g.status === "FAILED" ? "border-critical text-critical" :
                          "border-tertiary text-tertiary"
                        }`}>
                          {g.status}
                        </span>
                        <span className="font-mono-technical text-[10px] text-on-surface flex-1">
                          {g.framework.replace(/_/g, " ")}
                        </span>
                        {g.prUrl && (
                          <a href={g.prUrl} target="_blank" rel="noopener noreferrer" className="font-mono-technical text-[9px] text-primary hover:underline shrink-0">
                            VIEW PR →
                          </a>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="bg-surface border border-border-muted p-lg">
                <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest mb-md">TRIGGER RULES</p>
                {triggerRules.length === 0 ? (
                  <p className="font-mono-technical text-[11px] text-on-surface-variant">No trigger rules configured.</p>
                ) : (
                  <div className="space-y-xs">
                    {triggerRules.slice(0, 5).map((r) => (
                      <div key={r.id} className="flex items-center justify-between py-xs border-b border-border-muted last:border-0">
                        <div className="flex items-center gap-md">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.enabled ? "bg-primary" : "bg-border-muted"}`} />
                          <span className="font-mono-technical text-[10px] text-on-surface">{r.name}</span>
                        </div>
                        <div className="flex items-center gap-md">
                          <span className="font-mono-technical text-[9px] text-on-surface-variant">{r.source.toUpperCase()} · {r.eventType}</span>
                          <span className="font-mono-technical text-[9px] border border-border-muted px-1 py-0.5 text-on-surface-variant">{r.action}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <Link
                href={`/intelligence?projectId=${projectId}`}
                className="inline-flex items-center gap-sm px-lg py-sm border border-primary text-primary font-mono-technical text-[10px] hover:bg-primary/10 transition-colors"
              >
                <Icon name="psychology" size={14} />
                OPEN ASSURANCE INTELLIGENCE →
              </Link>
            </div>
          )}

          {/* ── CONTROLS ── */}
          {activeTab === "controls" && (
            <div className="space-y-lg">
              <section className="bg-surface border border-border-muted p-lg">
                <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest mb-lg">
                  INTELLIGENCE MODE
                </p>
                {aiSetting ? (
                  <>
                    {(() => {
                      const m = MODE_LABELS[aiSetting.mode] ?? { label: aiSetting.mode, desc: "", cls: "text-on-surface border-border-muted" };
                      return (
                        <div className="space-y-md">
                          <div className={`inline-flex items-center gap-sm px-md py-sm border font-mono-technical text-[11px] ${m.cls}`}>
                            <Icon name="security" size={14} />
                            {m.label.toUpperCase()}
                          </div>
                          <p className="font-mono-technical text-[11px] text-on-surface-variant">{m.desc}</p>
                          <div className="flex gap-xl font-mono-technical text-[10px] text-on-surface-variant">
                            <span>SET BY: {aiSetting.setBy}</span>
                            <span>AT: {new Date(aiSetting.setAt).toLocaleDateString("en-GB")}</span>
                          </div>
                          {aiSetting.reason && (
                            <p className="font-mono-technical text-[10px] text-on-surface border-l-2 border-primary pl-md">
                              {aiSetting.reason}
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <p className="font-mono-technical text-[11px] text-on-surface-variant">
                    Intelligence controls not yet configured for this project.
                  </p>
                )}
              </section>
              <Link
                href={`/ai-control?projectId=${projectId}`}
                className="inline-flex items-center gap-sm px-lg py-sm border border-primary text-primary font-mono-technical text-[10px] hover:bg-primary/10 transition-colors"
              >
                <Icon name="security" size={14} />
                MANAGE INTELLIGENCE CONTROLS →
              </Link>
            </div>
          )}

          {/* ── SOURCES ── */}
          {activeTab === "sources" && (
            <div className="space-y-lg">
              {boards.length === 0 ? (
                <div className="border border-border-muted p-xl text-center space-y-md">
                  <p className="font-mono-technical text-[11px] text-on-surface-variant">No source connections yet.</p>
                  <Link
                    href={`/admin/projects/${projectId}`}
                    className="inline-block font-mono-technical text-[10px] text-primary hover:underline"
                  >
                    CONFIGURE SYNC →
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
                  {boards.map((b) => (
                    <div key={b.id} className={`border p-lg ${b.enabled ? "border-border-muted" : "border-border-muted opacity-50"}`}>
                      <div className="flex items-start justify-between mb-md">
                        <div className="flex items-center gap-md">
                          <div className="w-8 h-8 border border-border-muted flex items-center justify-center font-mono-technical text-[10px] text-primary shrink-0">
                            {SOURCE_ICON[b.connector.type] ?? b.connector.type.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-body-bold text-body-bold text-on-surface text-[12px]">{b.connector.name}</p>
                            <p className="font-mono-technical text-[9px] text-on-surface-variant">{b.boardId}</p>
                          </div>
                        </div>
                        <span className={`font-mono-technical text-[9px] border px-1.5 py-0.5 ${b.enabled ? "border-primary text-primary" : "border-border-muted text-on-surface-variant"}`}>
                          {b.enabled ? "ACTIVE" : "DISABLED"}
                        </span>
                      </div>
                      <div className="flex gap-sm mt-md">
                        <button
                          disabled={syncingBoard === b.id}
                          onClick={() => handleSync(b)}
                          className="flex-1 py-xs border border-primary text-primary font-mono-technical text-[10px] hover:bg-primary/10 transition-colors disabled:opacity-50"
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
              <Link
                href={`/admin/projects/${projectId}`}
                className="font-mono-technical text-[10px] text-primary hover:underline"
              >
                CONFIGURE SYNC & SOURCES →
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
