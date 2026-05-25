"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TemplateRow } from "./page";

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

const EFFORT_CFG: Record<string, { cls: string; label: string; tier: string; impact: string }> = {
  LOW: {
    cls: "border-primary/40 text-primary/80",
    label: "AGILE LITE",
    tier: "Minimal Governance",
    impact: "Fast-track delivery · reduced approval overhead",
  },
  MEDIUM: {
    cls: "border-tertiary/40 text-tertiary/80",
    label: "STANDARD",
    tier: "Balanced Governance",
    impact: "Enterprise-grade assurance · proportional controls",
  },
  HIGH: {
    cls: "border-critical/40 text-critical/80",
    label: "REGULATED",
    tier: "Enhanced Governance",
    impact: "Maximum regulatory coverage · full audit trail",
  },
  CUSTOM: {
    cls: "border-border-muted text-on-surface-variant",
    label: "CUSTOM",
    tier: "Custom Governance",
    impact: "Admin-configured gates and approval chains",
  },
};

const GATE_CATEGORY_COLORS: Record<string, string> = {
  regulatory: "text-critical border-critical/30 bg-critical/5",
  security: "text-tertiary border-tertiary/30 bg-tertiary/5",
  architecture: "text-primary border-primary/30 bg-primary/5",
  "ai-governance": "text-primary border-primary/30 bg-primary/10",
  technical: "text-on-surface border-border-muted",
  "change-management": "text-on-surface-variant border-border-muted",
  operational: "text-on-surface-variant border-border-muted",
};

function TemplateCard({ template }: { template: TemplateRow }) {
  const [expanded, setExpanded] = useState(false);
  const effort = EFFORT_CFG[template.effort] ?? EFFORT_CFG.MEDIUM;
  const stageCount = template.stages.length;

  return (
    <div className="bg-surface border border-border-muted hover:border-primary/40 transition-colors">
      <button onClick={() => setExpanded((v) => !v)} className="w-full text-left p-lg">
        <div className="flex items-start gap-md">
          <div className="w-9 h-9 bg-surface-container-high border border-border-muted flex items-center justify-center shrink-0">
            <Icon
              name={template.icon ?? "category"}
              size={18}
              className="text-on-surface-variant"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-sm flex-wrap mb-xs">
              <p className="font-body-bold text-body-bold text-on-surface text-[14px]">
                {template.name}
              </p>
              {template.isBuiltIn && (
                <span className="px-1.5 py-0.5 font-mono-technical text-[8px] border border-primary/30 text-primary/70">
                  BUILT-IN
                </span>
              )}
              <span className={`px-1.5 py-0.5 font-mono-technical text-[8px] border font-bold ${effort.cls}`}>
                {effort.label}
              </span>
            </div>
            <p className="font-mono-technical text-[10px] text-on-surface-variant leading-snug mb-md">
              {template.description ?? effort.tier}
            </p>
            {/* Business outcome row */}
            <div className="flex items-center gap-md flex-wrap">
              <span className="flex items-center gap-xs font-mono-technical text-[9px] text-primary">
                <Icon name="trending_up" size={12} className="text-primary" />
                {effort.impact}
              </span>
              {stageCount > 0 && (
                <span className="font-mono-technical text-[9px] text-on-surface-variant">
                  {stageCount} delivery stage{stageCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-sm shrink-0">
            {/* Regulatory frameworks covered */}
            {template.suggestedFrameworks.length > 0 && (
              <div className="flex gap-xs">
                {template.suggestedFrameworks.slice(0, 3).map((f) => (
                  <span
                    key={f}
                    className="px-1.5 py-0.5 font-mono-technical text-[8px] border border-primary/30 text-primary/70"
                  >
                    {f.replace(/_/g, " ")}
                  </span>
                ))}
                {template.suggestedFrameworks.length > 3 && (
                  <span className="font-mono-technical text-[8px] text-on-surface-variant">
                    +{template.suggestedFrameworks.length - 3}
                  </span>
                )}
              </div>
            )}
            <Icon
              name={expanded ? "expand_less" : "expand_more"}
              size={16}
              className="text-on-surface-variant"
            />
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-lg pb-lg border-t border-border-muted pt-md space-y-md">
          <p className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest">
            GOVERNANCE INTENSITY DETAIL
          </p>
          <div className="grid grid-cols-2 gap-md">
            <div className="space-y-xs">
              <p className="font-mono-technical text-[9px] text-on-surface-variant">INTENSITY TIER</p>
              <p className="font-body-bold text-body-bold text-on-surface text-[13px]">{effort.tier}</p>
            </div>
            <div className="space-y-xs">
              <p className="font-mono-technical text-[9px] text-on-surface-variant">DELIVERY DOMAINS</p>
              <div className="flex gap-xs flex-wrap">
                {template.suggestedDomains.length > 0
                  ? template.suggestedDomains.map((d) => (
                      <span key={d} className={`px-1.5 py-0.5 font-mono-technical text-[8px] border ${GATE_CATEGORY_COLORS[d] ?? "border-border-muted text-on-surface-variant"} capitalize`}>
                        {d}
                      </span>
                    ))
                  : <span className="font-mono-technical text-[9px] text-on-surface-variant">All domains</span>
                }
              </div>
            </div>
            <div className="col-span-2 space-y-xs">
              <p className="font-mono-technical text-[9px] text-on-surface-variant">REGULATORY FRAMEWORKS COVERED</p>
              <div className="flex gap-xs flex-wrap">
                {template.suggestedFrameworks.length > 0
                  ? template.suggestedFrameworks.map((f) => (
                      <span key={f} className="px-1.5 py-0.5 font-mono-technical text-[8px] border border-primary/30 text-primary/70">
                        {f.replace(/_/g, " ")}
                      </span>
                    ))
                  : <span className="font-mono-technical text-[9px] text-on-surface-variant">Framework-agnostic</span>
                }
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NewTemplateForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [effort, setEffort] = useState("MEDIUM");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/governance/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          effort,
          stages: [],
          suggestedFrameworks: [],
          suggestedDomains: [],
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string | object };
        setError(typeof err.error === "string" ? err.error : "Failed to create template");
        return;
      }
      onClose();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-surface border border-primary/30 p-lg space-y-md max-w-[600px]">
      <div className="flex items-center justify-between">
        <p className="font-mono-technical text-[10px] text-primary tracking-widest">NEW GOVERNANCE PROFILE</p>
        <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
          <Icon name="close" size={14} />
        </button>
      </div>

      <div>
        <label className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest block mb-xs">
          NAME *
        </label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Cloud Migration Governance"
          className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[11px] outline-none focus:border-primary"
        />
      </div>
      <div>
        <label className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest block mb-xs">
          DESCRIPTION
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="What type of change does this template govern?"
          className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[11px] resize-none outline-none focus:border-primary"
        />
      </div>
      <div>
        <label className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest block mb-xs">
          GOVERNANCE EFFORT
        </label>
        <div className="flex gap-xs">
          {(["LOW", "MEDIUM", "HIGH", "CUSTOM"] as const).map((e) => (
            <button
              key={e}
              onClick={() => setEffort(e)}
              className={`flex-1 py-xs font-mono-technical text-[9px] border transition-colors ${effort === e ? "border-primary bg-primary/10 text-primary" : "border-border-muted text-on-surface-variant hover:border-primary/50"}`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="font-mono-technical text-[10px] text-critical">{error}</p>}
      <div className="flex items-center gap-sm pt-sm">
        <p className="font-mono-technical text-[9px] text-on-surface-variant flex-1">
          Stages and gate hints can be configured after creation.
        </p>
        <button
          onClick={() => void save()}
          disabled={saving || !name.trim()}
          className="px-xl py-sm bg-primary text-background font-mono-technical text-[10px] hover:bg-primary/90 disabled:opacity-40"
        >
          {saving ? "CREATING…" : "CREATE PROFILE"}
        </button>
      </div>
    </div>
  );
}

export default function TemplatesClient({ templates }: { templates: TemplateRow[] }) {
  const [showNew, setShowNew] = useState(false);

  return (
    <div className="space-y-lg">
      <div className="flex items-center gap-md">
        <p className="font-mono-technical text-[10px] text-on-surface-variant">
          {templates.length} profile{templates.length !== 1 ? "s" : ""} configured
        </p>
        <div className="flex-1" />
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-sm px-lg py-sm bg-primary text-background font-mono-technical text-[10px] hover:bg-primary/90 transition-colors"
        >
          <Icon name="add" size={12} className="text-background" />
          NEW PROFILE
        </button>
      </div>

      {showNew && <NewTemplateForm onClose={() => setShowNew(false)} />}

      <div className="space-y-sm">
        {templates.map((t) => (
          <TemplateCard key={t.id} template={t} />
        ))}
      </div>
    </div>
  );
}
