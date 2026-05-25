"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { GovernanceEventType } from "@prisma/client";

interface Event {
  id: string;
  type: GovernanceEventType;
  actorEmail: string | null;
  timestamp: string;
  resourceId: string | null;
  resourceType: string | null;
}

interface Props {
  events: Event[];
  activeType?: string;
  activeFrom?: string;
  activeTo?: string;
}

const EVENT_TYPE_GROUPS: Record<string, GovernanceEventType[]> = {
  "Case Lifecycle": [
    "CASE_CREATED",
    "CASE_RESOLVED",
    "CASE_REOPENED",
    "CASE_COMMENT_ADDED",
    "CASE_ASSIGNED",
  ],
  "Gates & Approvals": [
    "GATE_CREATED",
    "GATE_OPENED",
    "GATE_APPROVED",
    "GATE_REJECTED",
    "GATE_SKIPPED",
    "APPROVAL_REQUESTED",
    "APPROVAL_GRANTED",
    "APPROVAL_REJECTED",
    "APPROVAL_INHERITED",
  ],
  "Evidence & Risk": [
    "EVIDENCE_SUBMITTED",
    "EVIDENCE_REQUESTED",
    "RISK_RAISED",
    "RISK_MITIGATED",
    "REGULATORY_MAPPING_ADDED",
  ],
  "AI Actions": ["AI_MODE_CHANGED", "AI_EMERGENCY_LOCK", "AI_INVOCATION"],
  "Connectors & Triggers": [
    "TRIGGER_MATCHED",
    "TRIGGER_SKIPPED",
    "CONNECTOR_EVENT_RECEIVED",
    "JIRA_WRITEBACK_COMPLETE",
  ],
};

export default function TimelineFilterBar({ events, activeType, activeFrom, activeTo }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [exporting, setExporting] = useState(false);

  const update = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  function clearFilters() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("type");
    params.delete("from");
    params.delete("to");
    router.push(`${pathname}?${params.toString()}`);
  }

  function exportCsv() {
    setExporting(true);
    try {
      const rows = [
        ["ID", "TYPE", "ACTOR", "TIMESTAMP", "RESOURCE_TYPE", "RESOURCE_ID"],
        ...events.map((e) => [
          e.id,
          e.type,
          e.actorEmail ?? "",
          e.timestamp,
          e.resourceType ?? "",
          e.resourceId ?? "",
        ]),
      ];
      const csv = rows.map((r) => r.join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `flight-recorder-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const hasFilters = activeType || activeFrom || activeTo;

  const inputCls =
    "bg-surface-container-low border border-border-muted px-md py-xs font-mono-technical text-[11px] text-on-surface outline-none focus:border-primary";

  return (
    <div className="px-xl py-md border-b border-border-muted bg-surface shrink-0">
      <div className="max-w-[900px] flex items-center gap-md flex-wrap">
        <span className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest shrink-0">
          FILTER
        </span>

        <select
          value={activeType ?? ""}
          onChange={(e) => update("type", e.target.value || undefined)}
          className={inputCls}
        >
          <option value="">All event types</option>
          {Object.entries(EVENT_TYPE_GROUPS).map(([group, types]) => (
            <optgroup key={group} label={group}>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        <input
          type="date"
          value={activeFrom ?? ""}
          onChange={(e) => update("from", e.target.value || undefined)}
          className={inputCls}
          title="From date"
        />
        <input
          type="date"
          value={activeTo ?? ""}
          onChange={(e) => update("to", e.target.value || undefined)}
          className={inputCls}
          title="To date"
        />

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="font-mono-technical text-[10px] text-on-surface-variant hover:text-critical transition-colors"
          >
            CLEAR
          </button>
        )}

        <div className="ml-auto">
          <button
            onClick={exportCsv}
            disabled={exporting || events.length === 0}
            className="flex items-center gap-xs px-md py-xs border border-border-muted font-mono-technical text-[10px] text-on-surface-variant hover:border-primary hover:text-on-surface transition-colors disabled:opacity-40"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
              download
            </span>
            EXPORT CSV ({events.length})
          </button>
        </div>
      </div>
    </div>
  );
}
