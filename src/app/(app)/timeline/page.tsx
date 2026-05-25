import prisma from "@/lib/db";
import { getGovernanceEvents, DEMO_PROJECT_KEY } from "@/lib/governance";
import { GovernanceEventType } from "@prisma/client";

export const dynamic = "force-dynamic";

const EVENT_BADGE: Record<GovernanceEventType, { label: string; cls: string; dot: string }> = {
  PROJECT_CREATED: {
    label: "PROJECT",
    cls: "bg-primary/20 text-primary border border-primary",
    dot: "bg-primary border-primary",
  },
  GATE_CREATED: {
    label: "GATE",
    cls: "bg-primary/20 text-primary border border-primary",
    dot: "bg-primary border-primary",
  },
  GATE_OPENED: {
    label: "GATE OPEN",
    cls: "bg-tertiary/20 text-tertiary border border-tertiary",
    dot: "bg-tertiary border-tertiary",
  },
  GATE_APPROVED: {
    label: "APPROVED",
    cls: "bg-primary/20 text-primary border border-primary",
    dot: "bg-primary border-primary",
  },
  GATE_REJECTED: {
    label: "REJECTED",
    cls: "bg-critical text-on-error",
    dot: "bg-critical border-critical",
  },
  EVIDENCE_SUBMITTED: {
    label: "EVIDENCE",
    cls: "bg-primary/20 text-primary border border-primary",
    dot: "bg-primary border-primary",
  },
  APPROVAL_REQUESTED: {
    label: "PENDING",
    cls: "bg-tertiary/20 text-tertiary border border-tertiary",
    dot: "bg-tertiary border-tertiary",
  },
  APPROVAL_GRANTED: {
    label: "APPROVED",
    cls: "bg-primary/20 text-primary border border-primary",
    dot: "bg-primary border-primary",
  },
  APPROVAL_REJECTED: {
    label: "REJECTED",
    cls: "bg-critical text-on-error",
    dot: "bg-critical border-critical",
  },
  AI_MODE_CHANGED: {
    label: "AI ACTION",
    cls: "bg-primary/20 text-primary border border-primary",
    dot: "bg-primary border-primary",
  },
  AI_EMERGENCY_LOCK: {
    label: "EMERGENCY",
    cls: "bg-critical text-on-error",
    dot: "bg-critical border-critical",
  },
  AI_INVOCATION: {
    label: "AI CALL",
    cls: "bg-primary/20 text-primary border border-primary",
    dot: "bg-primary border-primary",
  },
  RISK_RAISED: {
    label: "RISK",
    cls: "bg-tertiary/20 text-tertiary border border-tertiary",
    dot: "bg-tertiary border-tertiary",
  },
  RISK_MITIGATED: {
    label: "MITIGATED",
    cls: "bg-primary/20 text-primary border border-primary",
    dot: "bg-primary border-primary",
  },
  REGULATORY_MAPPING_ADDED: {
    label: "REG MAP",
    cls: "bg-primary/20 text-primary border border-primary",
    dot: "bg-primary border-primary",
  },
  THIRD_PARTY_REGISTERED: {
    label: "3RD PARTY",
    cls: "bg-primary/20 text-primary border border-primary",
    dot: "bg-primary border-primary",
  },
  CONTEXT_ENRICHED: {
    label: "CONTEXT",
    cls: "bg-primary/10 text-primary border border-primary",
    dot: "bg-primary border-primary",
  },
  RISK_SCORED: {
    label: "SCORED",
    cls: "bg-tertiary/20 text-tertiary border border-tertiary",
    dot: "bg-tertiary border-tertiary",
  },
  PIPELINE_ADAPTED: {
    label: "PIPELINE",
    cls: "bg-primary/20 text-primary border border-primary",
    dot: "bg-primary border-primary",
  },
  GATE_SKIPPED: {
    label: "SKIPPED",
    cls: "bg-surface-container-highest text-on-surface-variant border border-border-muted",
    dot: "bg-on-surface-variant border-border-muted",
  },
  APPROVAL_INHERITED: {
    label: "INHERITED",
    cls: "bg-primary/10 text-primary border border-primary",
    dot: "bg-primary border-primary",
  },
  WAIVER_REQUESTED: {
    label: "WAIVER",
    cls: "bg-tertiary/20 text-tertiary border border-tertiary",
    dot: "bg-tertiary border-tertiary",
  },
  WAIVER_APPROVED: {
    label: "WAIVER OK",
    cls: "bg-primary/20 text-primary border border-primary",
    dot: "bg-primary border-primary",
  },
  JIRA_WRITEBACK_COMPLETE: {
    label: "JIRA SYNC",
    cls: "bg-primary/10 text-primary border border-primary",
    dot: "bg-primary border-primary",
  },
  CASE_CREATED: {
    label: "CASE OPENED",
    cls: "bg-primary/10 text-primary border border-primary",
    dot: "bg-primary border-primary",
  },
  TRIGGER_MATCHED: {
    label: "TRIGGERED",
    cls: "bg-primary/20 text-primary border border-primary",
    dot: "bg-primary border-primary",
  },
  TRIGGER_SKIPPED: {
    label: "NO MATCH",
    cls: "bg-surface-container-highest text-on-surface-variant border border-border-muted",
    dot: "bg-on-surface-variant border-border-muted",
  },
  CONNECTOR_EVENT_RECEIVED: {
    label: "CONNECTOR",
    cls: "bg-primary/10 text-primary border border-primary",
    dot: "bg-primary border-primary",
  },
  PROGRAM_CREATED: {
    label: "PROGRAM",
    cls: "bg-primary/10 text-primary border border-primary",
    dot: "bg-primary border-primary",
  },
  PROJECT_ASSIGNED_TO_PROGRAM: {
    label: "ASSIGNED",
    cls: "bg-primary/10 text-primary border border-primary",
    dot: "bg-primary border-primary",
  },
  BOARD_ADDED: {
    label: "BOARD",
    cls: "bg-primary/10 text-primary border border-primary",
    dot: "bg-primary border-primary",
  },
  GUARDRAIL_PUSHED: {
    label: "GUARDRAIL",
    cls: "bg-tertiary/20 text-tertiary border border-tertiary",
    dot: "bg-tertiary border-tertiary",
  },
  GUARDRAIL_MERGED: {
    label: "MERGED",
    cls: "bg-primary/20 text-primary border border-primary",
    dot: "bg-primary border-primary",
  },
  GUARDRAIL_REJECTED: {
    label: "REJECTED",
    cls: "bg-critical text-on-error",
    dot: "bg-critical border-critical",
  },
  EXCEPTION_STORY_CREATED: {
    label: "EXCEPTION",
    cls: "bg-tertiary/20 text-tertiary border border-tertiary",
    dot: "bg-tertiary border-tertiary",
  },
  GATE_BUNDLE_APPLIED: {
    label: "BUNDLE",
    cls: "bg-primary/10 text-primary border border-primary",
    dot: "bg-primary border-primary",
  },
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function eventTitle(type: GovernanceEventType, payload: unknown): string {
  const p = asRecord(payload);
  switch (type) {
    case "GATE_APPROVED":
      return p?.gateName ? `Gate Approved: ${p.gateName}` : "Governance Gate Approved";
    case "GATE_REJECTED":
      return p?.gateName ? `Gate Rejected: ${p.gateName}` : "Governance Gate Rejected";
    case "GATE_OPENED":
      return "Governance Gate Opened for Review";
    case "GATE_CREATED":
      return "Governance Gate Created";
    case "APPROVAL_GRANTED":
      return p?.gateName ? `Approval Granted: ${p.gateName}` : "Approval Request Granted";
    case "APPROVAL_REQUESTED":
      return "Approval Request Raised";
    case "APPROVAL_REJECTED":
      return "Approval Request Rejected";
    case "AI_MODE_CHANGED":
      return p?.newMode
        ? `AI Mode → ${String(p.newMode).replace(/_/g, " ")}`
        : "AI Control Mode Changed";
    case "AI_EMERGENCY_LOCK":
      return "Emergency AI Lock Engaged";
    case "AI_INVOCATION":
      return "AI Invocation Logged";
    case "RISK_RAISED":
      return "Risk Item Raised to Register";
    case "RISK_MITIGATED":
      return "Risk Item Mitigated";
    case "EVIDENCE_SUBMITTED":
      return "Evidence Item Submitted";
    case "REGULATORY_MAPPING_ADDED":
      return "Regulatory Mapping Added";
    case "THIRD_PARTY_REGISTERED":
      return p?.vendorName
        ? `Third-Party: ${String(p.vendorName)}`
        : "Third-Party Dependency Registered";
    case "PROJECT_CREATED":
      return "Project Created";
    default:
      return String(type).replace(/_/g, " ");
  }
}

function eventDetail(
  type: GovernanceEventType,
  payload: unknown,
  actorEmail: string | null
): string {
  const p = asRecord(payload);
  const by = actorEmail ?? "system";
  switch (type) {
    case "AI_MODE_CHANGED":
      return `Mode transition by ${by}. ${p?.reason ? `Reason: ${String(p.reason)}` : "Policy-driven mode update."}`;
    case "APPROVAL_GRANTED":
      return `Approved by ${by}. ${p?.notes ? String(p.notes) : "Governance gate compliance confirmed."}`;
    case "APPROVAL_REQUESTED":
      return `Request submitted by ${by}. Awaiting authorised approver review.`;
    case "RISK_RAISED":
      return `Risk logged by ${by}. Added to active risk register for triage.`;
    case "RISK_MITIGATED":
      return `Risk closed by ${by}. Mitigation evidence recorded in vault.`;
    case "EVIDENCE_SUBMITTED":
      return `Evidence submitted by ${by}. Immutable SHA-256 hash recorded.`;
    case "REGULATORY_MAPPING_ADDED":
      return `Control mapped by ${by}. Regulatory alignment verified and indexed.`;
    case "THIRD_PARTY_REGISTERED":
      return `Registered by ${by} per DORA Article 28 third-party obligation.`;
    case "GATE_APPROVED":
      return `Gate approved by ${by}. Delivery checkpoint cleared.`;
    case "GATE_REJECTED":
      return `Gate rejected by ${by}. Remediation required before proceeding.`;
    case "PROJECT_CREATED":
      return `Project initialised by ${by}. Governance framework activated.`;
    default:
      return `Recorded by ${by} in the immutable governance flight recorder.`;
  }
}

export default async function Timeline() {
  const project = await prisma.project.findUnique({
    where: { key: DEMO_PROJECT_KEY },
    select: { id: true },
  });

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="font-mono-technical text-on-surface-variant text-[12px]">
          No project — run: <code className="text-primary">npx prisma db seed</code>
        </p>
      </div>
    );
  }

  const events = await getGovernanceEvents(project.id, 50);

  // Group events by calendar date
  const grouped = events.reduce<Record<string, typeof events>>((acc, e) => {
    const d = new Date(e.timestamp).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    (acc[d] ??= []).push(e);
    return acc;
  }, {});

  const dateGroups = Object.entries(grouped);

  return (
    <>
      {/* ── Top Bar ── */}
      <header className="h-16 px-xl flex items-center justify-between border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <div className="flex items-center gap-xl">
          <h1 className="font-headline-md text-headline-md text-on-surface">Flight Recorder</h1>
          <span className="text-on-surface-variant font-body-base text-body-base">
            Evidence Vault · Append-Only
          </span>
        </div>
        <div className="flex items-center gap-lg">
          <div className="text-right">
            <p className="font-mono-technical text-[10px] text-on-surface-variant">EVENTS LOGGED</p>
            <p className="font-body-bold text-body-bold text-primary">
              {String(events.length).padStart(3, "0")} IMMUTABLE
            </p>
          </div>
          <div className="font-mono-technical text-[10px] text-on-surface-variant border border-border-muted px-2 py-1">
            {DEMO_PROJECT_KEY}
          </div>
        </div>
      </header>

      {/* ── Timeline Canvas ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-xl py-xl">
        <div className="max-w-[900px]">
          {dateGroups.length === 0 ? (
            <p className="font-mono-technical text-[11px] text-primary">No events recorded.</p>
          ) : (
            dateGroups.map(([date, dayEvents]) => (
              <div key={date} className="mb-xl">
                <div className="font-mono-technical text-[10px] text-on-surface-variant mb-lg uppercase tracking-widest border-b border-border-muted pb-xs">
                  {date} — {dayEvents.length} EVENT{dayEvents.length !== 1 ? "S" : ""}
                </div>
                {dayEvents.map((e, i) => {
                  const meta = EVENT_BADGE[e.type] ?? EVENT_BADGE.PROJECT_CREATED;
                  return (
                    <div key={e.id} className="flex gap-lg mb-lg relative">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-3 h-3 rounded-full border-2 mt-1 shrink-0 ${meta.dot}`}
                        />
                        {i < dayEvents.length - 1 && (
                          <div className="flex-1 w-px bg-border-muted mt-1" />
                        )}
                      </div>
                      <div className="flex-1 bg-surface border border-border-muted p-lg hover:border-on-surface-variant transition-colors cursor-pointer">
                        <div className="flex items-start justify-between mb-sm">
                          <div className="flex items-center gap-md">
                            <span
                              className={`px-2 py-0.5 font-mono-technical text-[10px] uppercase ${meta.cls}`}
                            >
                              {meta.label}
                            </span>
                            <h4 className="font-body-bold text-body-bold text-on-surface">
                              {eventTitle(e.type, e.payload)}
                            </h4>
                          </div>
                          <span className="font-mono-technical text-[11px] text-on-surface-variant shrink-0 ml-md">
                            {new Date(e.timestamp).toLocaleTimeString("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </span>
                        </div>
                        {e.actorEmail && (
                          <p className="font-mono-technical text-[11px] text-on-surface-variant mb-sm">
                            Actor: {e.actorEmail}
                            {e.resourceType && ` · Resource: ${e.resourceType}`}
                            {e.resourceId && ` #${e.resourceId.slice(-6).toUpperCase()}`}
                          </p>
                        )}
                        <p className="font-body-base text-body-base text-on-surface-variant">
                          {eventDetail(e.type, e.payload, e.actorEmail ?? null)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Status Footer ── */}
      <footer className="h-8 bg-surface-container-low border-t border-border-muted flex items-center justify-between px-xl font-mono-technical text-[10px] text-on-surface-variant shrink-0">
        <div className="flex items-center gap-xl">
          <div className="flex items-center gap-xs">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>STREAM STATUS: LIVE RECORDING</span>
          </div>
          <span>EVENTS: {events.length} / IMMUTABLE LEDGER</span>
        </div>
        <span className="font-bold text-on-surface">v0.1.0-MVP</span>
      </footer>
    </>
  );
}
