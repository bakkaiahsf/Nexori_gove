"use client";

import { useState } from "react";
import { CATEGORY_META, type GateWithStats } from "./constants";

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

const INTENSITY_CLS: Record<string, string> = {
  standard: "border-border-muted text-on-surface-variant",
  regulated: "border-primary text-primary bg-primary/10",
  enhanced: "border-tertiary text-tertiary bg-tertiary/10",
  critical: "border-critical text-critical bg-critical/10",
};

function GateCard({ gate }: { gate: GateWithStats }) {
  const [expanded, setExpanded] = useState(false);
  const catMeta = CATEGORY_META[gate.category] ?? {
    label: gate.category,
    color: "text-on-surface-variant border-border-muted",
  };

  return (
    <div
      className={`border transition-colors ${
        gate.enabled ? "border-border-muted" : "border-border-muted/40 opacity-60"
      } bg-surface`}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left p-lg flex items-start gap-md hover:bg-surface-container-highest transition-colors"
      >
        <div className="flex-1 min-w-0 space-y-xs">
          <div className="flex items-center gap-sm flex-wrap">
            <span className="font-body-bold text-body-bold text-on-surface text-[13px]">
              {gate.name}
            </span>
            {gate.isBuiltIn && (
              <span className="px-1.5 py-0.5 font-mono-technical text-[9px] border border-primary text-primary bg-primary/10">
                BUILT-IN
              </span>
            )}
            {!gate.enabled && (
              <span className="px-1.5 py-0.5 font-mono-technical text-[9px] border border-border-muted text-on-surface-variant">
                DISABLED
              </span>
            )}
          </div>
          <div className="flex items-center gap-sm flex-wrap">
            <span
              className={`px-1.5 py-0.5 font-mono-technical text-[9px] border ${catMeta.color}`}
            >
              {catMeta.label.toUpperCase()}
            </span>
            <span className="font-mono-technical text-[9px] text-on-surface-variant">
              {gate.slug}
            </span>
            <span className="font-mono-technical text-[9px] text-on-surface-variant">
              SLA: {gate.defaultSlaHours}h
            </span>
          </div>
        </div>
        <div className="flex items-center gap-sm shrink-0">
          <div className="flex gap-xs">
            {gate.intensityTriggers.map((t) => (
              <span
                key={t}
                className={`px-1 py-0.5 font-mono-technical text-[8px] border ${INTENSITY_CLS[t] ?? ""}`}
              >
                {t.toUpperCase()}
              </span>
            ))}
          </div>
          <Icon
            name={expanded ? "expand_less" : "expand_more"}
            size={16}
            className="text-on-surface-variant"
          />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border-muted p-lg space-y-md bg-surface-container-low">
          {gate.description && (
            <p className="font-mono-technical text-[11px] text-on-surface-variant leading-relaxed">
              {gate.description}
            </p>
          )}

          <div className="grid grid-cols-2 gap-md">
            <div>
              <p className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest mb-xs">
                REQUIRED EVIDENCE
              </p>
              {gate.requiredEvidence.length > 0 ? (
                <div className="flex flex-wrap gap-xs">
                  {gate.requiredEvidence.map((e) => (
                    <span
                      key={e}
                      className="px-2 py-0.5 font-mono-technical text-[9px] border border-border-muted text-on-surface-variant"
                    >
                      {e}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="font-mono-technical text-[10px] text-on-surface-variant/60">None</p>
              )}
            </div>
            <div>
              <p className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest mb-xs">
                APPROVER ROLES
              </p>
              {gate.approverRoles.length > 0 ? (
                <div className="flex flex-wrap gap-xs">
                  {gate.approverRoles.map((r) => (
                    <span
                      key={r}
                      className="px-2 py-0.5 font-mono-technical text-[9px] border border-tertiary text-tertiary bg-tertiary/10"
                    >
                      {r.toUpperCase()}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="font-mono-technical text-[10px] text-on-surface-variant/60">
                  Any approver
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-sm pt-sm border-t border-border-muted">
            <span className="font-mono-technical text-[9px] text-on-surface-variant/60">
              ID: {gate.id}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GateLibraryClient({
  gates,
  byCategory,
}: {
  gates: GateWithStats[];
  byCategory: Record<string, GateWithStats[]>;
}) {
  const [filter, setFilter] = useState<"all" | "enabled" | "custom">("all");
  const [search, setSearch] = useState("");

  const filtered = gates.filter((g) => {
    if (filter === "enabled" && !g.enabled) return false;
    if (filter === "custom" && g.isBuiltIn) return false;
    if (search && !g.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filteredByCategory: Record<string, GateWithStats[]> = {};
  for (const g of filtered) {
    (filteredByCategory[g.category] ??= []).push(g);
  }

  return (
    <div className="space-y-lg">
      {/* Filters */}
      <div className="flex items-center gap-md">
        <div className="flex gap-xs">
          {(["all", "enabled", "custom"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-md py-xs font-mono-technical text-[10px] border transition-colors ${
                filter === f
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border-muted text-on-surface-variant hover:border-primary/50"
              }`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search gates..."
          className="flex-1 bg-surface border border-border-muted px-md py-xs font-mono-technical text-[11px] text-on-surface outline-none focus:border-primary transition-colors"
        />
        <span className="font-mono-technical text-[10px] text-on-surface-variant">
          {filtered.length} gates
        </span>
      </div>

      {/* Gate categories */}
      {Object.keys(CATEGORY_META)
        .filter((cat) => filteredByCategory[cat]?.length)
        .map((cat) => {
          const catGates = filteredByCategory[cat]!;
          const meta = CATEGORY_META[cat]!;
          return (
            <div key={cat} className="space-y-xs">
              <div className="flex items-center gap-md">
                <span className={`px-2 py-0.5 font-mono-technical text-[9px] border ${meta.color}`}>
                  {meta.label.toUpperCase()}
                </span>
                <span className="font-mono-technical text-[9px] text-on-surface-variant/60">
                  {catGates.length} gates
                </span>
              </div>
              <div className="space-y-xs pl-md border-l-2 border-border-muted">
                {catGates.map((g) => (
                  <GateCard key={g.id} gate={g} />
                ))}
              </div>
            </div>
          );
        })}

      {filtered.length === 0 && (
        <div className="text-center py-xl">
          <p className="font-mono-technical text-[12px] text-on-surface-variant">
            No gates match the current filter.
          </p>
        </div>
      )}

      <div className="bg-surface-container-low border border-border-muted p-lg">
        <p className="font-mono-technical text-[9px] text-on-surface-variant">
          Gate definitions drive the adaptive pipeline composer. Built-in gates ship with NexoriOS.
          Custom gates can be created via the API ({"/api/governance/gate-library"}). The composer
          selects gates based on risk intensity and skip conditions evaluated at pipeline build
          time.
        </p>
      </div>
    </div>
  );
}
