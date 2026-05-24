"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TemplateRow } from "./page";

function Icon({ name, size = 14, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <span className={`material-symbols-outlined select-none leading-none ${className}`} style={{ fontSize: size }}>
      {name}
    </span>
  );
}

const EFFORT_CFG: Record<string, { cls: string; label: string }> = {
  LOW: { cls: "border-primary/40 text-primary/80", label: "LOW EFFORT" },
  MEDIUM: { cls: "border-tertiary/40 text-tertiary/80", label: "MEDIUM EFFORT" },
  HIGH: { cls: "border-critical/40 text-critical/80", label: "HIGH EFFORT" },
  CUSTOM: { cls: "border-border-muted text-on-surface-variant", label: "CUSTOM" },
};

const GATE_CATEGORY_COLORS: Record<string, string> = {
  "regulatory": "text-critical border-critical/30 bg-critical/5",
  "security": "text-tertiary border-tertiary/30 bg-tertiary/5",
  "architecture": "text-primary border-primary/30 bg-primary/5",
  "ai-governance": "text-primary border-primary/30 bg-primary/10",
  "technical": "text-on-surface border-border-muted",
  "change-management": "text-on-surface-variant border-border-muted",
  "operational": "text-on-surface-variant border-border-muted",
};

function TemplateCard({ template }: { template: TemplateRow }) {
  const [expanded, setExpanded] = useState(false);
  const effort = EFFORT_CFG[template.effort] ?? EFFORT_CFG.MEDIUM;
  const totalGateHints = template.stages.reduce((acc, s) => acc + (s.gateHints?.length ?? 0), 0);

  return (
    <div className="bg-surface border border-border-muted hover:border-primary/40 transition-colors">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left p-lg space-y-md"
      >
        <div className="flex items-start gap-md">
          <div className="w-9 h-9 bg-surface-container-high border border-border-muted flex items-center justify-center shrink-0">
            <Icon name={template.icon ?? "category"} size={18} className="text-on-surface-variant" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-sm flex-wrap">
              <p className="font-body-bold text-body-bold text-on-surface text-[14px]">{template.name}</p>
              {template.isBuiltIn && (
                <span className="px-1.5 py-0.5 font-mono-technical text-[8px] border border-primary/30 text-primary/70">
                  BUILT-IN
                </span>
              )}
              <span className={`px-1.5 py-0.5 font-mono-technical text-[8px] border ${effort.cls}`}>
                {effort.label}
              </span>
            </div>
            <p className="font-mono-technical text-[10px] text-on-surface-variant mt-xs leading-snug">
              {template.description}
            </p>
          </div>
          <div className="flex items-center gap-sm shrink-0">
            {totalGateHints > 0 && (
              <span className="font-mono-technical text-[9px] text-on-surface-variant">
                ~{totalGateHints} gates
              </span>
            )}
            <Icon
              name={expanded ? "expand_less" : "expand_more"}
              size={16}
              className="text-on-surface-variant"
            />
          </div>
        </div>

        {/* Tags */}
        <div className="flex gap-xs flex-wrap">
          {template.suggestedFrameworks.map((f) => (
            <span key={f} className="px-1.5 py-0.5 font-mono-technical text-[8px] border border-border-muted text-on-surface-variant">
              {f.replace(/_/g, " ")}
            </span>
          ))}
          {template.suggestedDomains.map((d) => (
            <span key={d} className="px-1.5 py-0.5 font-mono-technical text-[8px] border border-border-muted text-on-surface-variant capitalize">
              {d}
            </span>
          ))}
        </div>
      </button>

      {expanded && template.stages.length > 0 && (
        <div className="px-lg pb-lg border-t border-border-muted pt-md space-y-md">
          <p className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest">
            GATE PIPELINE — STAGE BREAKDOWN
          </p>
          <div className="space-y-sm">
            {template.stages.map((s) => (
              <div key={s.stage} className="flex gap-lg">
                <div className="w-[120px] shrink-0">
                  <p className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest">
                    {s.stage.toUpperCase()}
                  </p>
                </div>
                <div className="flex-1 space-y-xs">
                  {s.gateCategories.length > 0 && (
                    <div className="flex gap-xs flex-wrap">
                      {s.gateCategories.map((cat) => (
                        <span
                          key={cat}
                          className={`px-1.5 py-0.5 font-mono-technical text-[8px] border ${GATE_CATEGORY_COLORS[cat] ?? "border-border-muted text-on-surface-variant"}`}
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  )}
                  {s.gateHints && s.gateHints.length > 0 && (
                    <div className="flex gap-xs flex-wrap">
                      {s.gateHints.map((hint) => (
                        <span key={hint} className="font-mono-technical text-[9px] text-on-surface-variant">
                          {hint}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {expanded && template.stages.length === 0 && (
        <div className="px-lg pb-lg border-t border-border-muted pt-md">
          <p className="font-mono-technical text-[10px] text-on-surface-variant">
            No stages defined. Gates are selected ad-hoc from the Gate Library when governance is activated.
          </p>
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
        <p className="font-mono-technical text-[10px] text-primary tracking-widest">NEW TEMPLATE</p>
        <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
          <Icon name="close" size={14} />
        </button>
      </div>

      <div>
        <label className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest block mb-xs">NAME *</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Cloud Migration Governance"
          className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[11px] outline-none focus:border-primary"
        />
      </div>
      <div>
        <label className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest block mb-xs">DESCRIPTION</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="What type of change does this template govern?"
          className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[11px] resize-none outline-none focus:border-primary"
        />
      </div>
      <div>
        <label className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest block mb-xs">GOVERNANCE EFFORT</label>
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
          {saving ? "CREATING…" : "CREATE TEMPLATE"}
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
          {templates.length} template{templates.length !== 1 ? "s" : ""} configured
        </p>
        <div className="flex-1" />
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-sm px-lg py-sm bg-primary text-background font-mono-technical text-[10px] hover:bg-primary/90 transition-colors"
        >
          <Icon name="add" size={12} className="text-background" />
          NEW TEMPLATE
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
