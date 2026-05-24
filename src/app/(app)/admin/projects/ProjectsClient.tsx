"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AIControlMode, RegulatoryFramework } from "@prisma/client";
import type { ProjectSummary } from "./constants";

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

const READINESS_CFG = {
  GO: {
    label: "GO",
    cls: "border-primary text-primary bg-primary/10",
    dot: "bg-primary",
    desc: "All gates cleared",
  },
  CONDITIONAL: {
    label: "CONDITIONAL",
    cls: "border-tertiary text-tertiary bg-tertiary/10",
    dot: "bg-tertiary animate-pulse",
    desc: "Gates pending approval",
  },
  NO_GO: {
    label: "NO_GO",
    cls: "border-critical text-critical bg-critical/10",
    dot: "bg-critical animate-pulse",
    desc: "Blocked — gates rejected",
  },
  SETUP: {
    label: "SETUP",
    cls: "border-border-muted text-on-surface-variant",
    dot: "bg-on-surface-variant/40",
    desc: "Not yet configured",
  },
};

const DOMAIN_OPTS = [
  { value: "banking", label: "Banking" },
  { value: "insurance", label: "Insurance" },
  { value: "fintech", label: "Fintech" },
  { value: "healthcare", label: "Healthcare" },
  { value: "government", label: "Government" },
  { value: "energy", label: "Energy" },
  { value: "retail", label: "Retail" },
  { value: "other", label: "Other" },
];

const FRAMEWORK_OPTS: { value: RegulatoryFramework; label: string; region: string }[] = [
  { value: RegulatoryFramework.DORA, label: "DORA", region: "EU · Financial" },
  { value: RegulatoryFramework.EU_AI_ACT, label: "EU AI Act", region: "EU · AI" },
  { value: RegulatoryFramework.SOC2, label: "SOC 2", region: "US/Global" },
  { value: RegulatoryFramework.ISO_27001, label: "ISO 27001", region: "Global" },
  { value: RegulatoryFramework.PCI_DSS, label: "PCI-DSS", region: "Global · Payments" },
  { value: RegulatoryFramework.GDPR, label: "GDPR", region: "EU · Privacy" },
];

const AI_MODE_OPTS: { value: AIControlMode; label: string; desc: string }[] = [
  {
    value: AIControlMode.HUMAN_ONLY,
    label: "Human Only",
    desc: "All decisions manual — no AI assistance",
  },
  {
    value: AIControlMode.AI_ASSIST,
    label: "AI Assist",
    desc: "AI suggests, human decides — default for most projects",
  },
  {
    value: AIControlMode.AI_REVIEW,
    label: "AI Review",
    desc: "AI reviews and flags risks, human approves",
  },
  {
    value: AIControlMode.AI_CONTROLLED_ACTION,
    label: "AI Controlled",
    desc: "AI acts within policy bounds — highly automated",
  },
];

// ─── Step definitions for the onboarding wizard ─────────────────────────────
const WIZARD_STEPS = [
  { id: "identity", label: "Identity", icon: "badge" },
  { id: "frameworks", label: "Frameworks", icon: "policy" },
  { id: "aimode", label: "AI Mode", icon: "psychology" },
  { id: "connectors", label: "Connectors", icon: "hub" },
  { id: "review", label: "Review & Create", icon: "check_circle" },
];

function NewProjectWizard({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ key: string; name: string } | null>(null);

  // Form state
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ownerEmail, setOwnerEmail] = useState(session?.user?.email ?? "");
  const [domain, setDomain] = useState("banking");
  const [classification, setClassification] = useState<
    "public" | "internal" | "confidential" | "restricted"
  >("internal");
  const [type, setType] = useState<"project" | "program">("project");
  const [frameworks, setFrameworks] = useState<RegulatoryFramework[]>([RegulatoryFramework.DORA]);
  const [aiMode, setAiMode] = useState<AIControlMode>(AIControlMode.AI_ASSIST);

  const canNext =
    step === 0
      ? key.length >= 2 && name.length >= 3 && ownerEmail.includes("@")
      : step === 1
        ? frameworks.length > 0
        : true;

  function toggleFramework(f: RegulatoryFramework) {
    setFrameworks((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  }

  // Auto-generate key from name
  function handleNameChange(v: string) {
    setName(v);
    if (!key || key === autoKey(name)) {
      setKey(autoKey(v));
    }
  }

  function autoKey(n: string) {
    return n
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, "")
      .trim()
      .split(/\s+/)
      .slice(0, 4)
      .join("-")
      .slice(0, 20);
  }

  async function create() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          name,
          description: description || undefined,
          domain,
          classification,
          ownerEmail,
          type,
          frameworks,
          aiMode,
          createdBy: session?.user?.email,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string | object };
        setError(typeof err.error === "string" ? err.error : "Failed to create project");
        setSaving(false);
        return;
      }
      const data = (await res.json()) as { key: string; name: string };
      setCreated(data);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setSaving(false);
    }
  }

  if (created) {
    return (
      <div className="border border-primary bg-surface p-xl space-y-lg max-w-[640px] mx-auto">
        <div className="flex items-center gap-md">
          <div className="w-10 h-10 bg-primary flex items-center justify-center">
            <Icon name="check" size={20} className="text-background" />
          </div>
          <div>
            <p className="font-body-bold text-body-bold text-on-surface text-[14px]">
              {created.name}
            </p>
            <p className="font-mono-technical text-[10px] text-primary">{created.key} — CREATED</p>
          </div>
        </div>
        <div className="bg-surface-container-low border border-border-muted p-lg space-y-sm">
          <p className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest">
            NEXT STEPS
          </p>
          {[
            {
              step: "1",
              action: "Link tool connectors",
              href: "/admin/connectors",
              desc: "Connect Jira, GitHub, or GitLab to start receiving events",
            },
            {
              step: "2",
              action: "Configure trigger rules",
              href: "/admin/trigger-rules",
              desc: "Define which events activate governance for this project",
            },
            {
              step: "3",
              action: "Review gate library",
              href: "/admin/gate-library",
              desc: "Confirm which gates apply at each risk intensity",
            },
            {
              step: "4",
              action: "Register expert reviewers",
              href: "/admin/experts",
              desc: "Add governance reviewers for AI-assisted routing",
            },
          ].map((item) => (
            <a
              key={item.step}
              href={item.href}
              className="flex items-start gap-md py-sm border-b border-border-muted last:border-0 hover:bg-surface-container-highest transition-colors px-xs"
            >
              <span className="w-5 h-5 bg-primary/10 border border-primary text-primary font-mono-technical text-[9px] flex items-center justify-center shrink-0 mt-0.5">
                {item.step}
              </span>
              <div>
                <p className="font-mono-technical text-[10px] text-on-surface">{item.action}</p>
                <p className="font-mono-technical text-[9px] text-on-surface-variant leading-snug">
                  {item.desc}
                </p>
              </div>
            </a>
          ))}
        </div>
        <button
          onClick={onClose}
          className="w-full py-md bg-primary text-background font-mono-technical text-[10px] hover:bg-primary/90"
        >
          DONE
        </button>
      </div>
    );
  }

  return (
    <div className="border border-border-muted bg-surface max-w-[640px] mx-auto">
      {/* Wizard header */}
      <div className="px-xl py-lg border-b border-border-muted flex items-center justify-between">
        <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
          NEW {type.toUpperCase()} ONBOARDING
        </p>
        <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
          <Icon name="close" size={16} />
        </button>
      </div>

      {/* Step progress */}
      <div className="px-xl py-md border-b border-border-muted flex gap-xs overflow-x-auto">
        {WIZARD_STEPS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => i < step && setStep(i)}
            className={`flex items-center gap-xs px-md py-xs font-mono-technical text-[10px] border shrink-0 transition-colors ${
              i === step
                ? "border-primary bg-primary/10 text-primary"
                : i < step
                  ? "border-primary/40 text-primary/60 cursor-pointer hover:bg-primary/5"
                  : "border-border-muted text-on-surface-variant/40 cursor-default"
            }`}
          >
            <Icon name={s.icon} size={12} />
            {s.label}
          </button>
        ))}
      </div>

      {/* Step content */}
      <div className="p-xl space-y-lg min-h-[320px]">
        {/* Step 0: Identity */}
        {step === 0 && (
          <div className="space-y-lg">
            <div className="flex gap-sm">
              {(["project", "program"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex-1 py-sm font-mono-technical text-[10px] border transition-colors ${
                    type === t
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border-muted text-on-surface-variant hover:border-primary/50"
                  }`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
            <p className="font-mono-technical text-[9px] text-on-surface-variant/60">
              {type === "program"
                ? "A program groups multiple related projects under one governance posture (e.g. a regulatory change programme)."
                : "A project is a single delivery initiative with its own governance gates and evidence trail."}
            </p>
            <div>
              <label className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest block mb-xs">
                PROJECT NAME *
              </label>
              <input
                autoFocus
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. DORA ICT Risk Programme Q1-2026"
                className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[11px] text-on-surface outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest block mb-xs">
                PROJECT KEY * (auto-generated)
              </label>
              <input
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
                placeholder="e.g. DORA-Q1-26"
                maxLength={30}
                className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[11px] text-on-surface outline-none focus:border-primary transition-colors"
              />
              <p className="font-mono-technical text-[9px] text-on-surface-variant/60 mt-xs">
                Uppercase, numbers, hyphens only. Used as the unique identifier in webhooks and
                integrations.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-md">
              <div>
                <label className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest block mb-xs">
                  OWNER EMAIL *
                </label>
                <input
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="pm@enterprise.com"
                  className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[11px] text-on-surface outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest block mb-xs">
                  INDUSTRY DOMAIN
                </label>
                <select
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[11px] text-on-surface outline-none focus:border-primary transition-colors"
                >
                  {DOMAIN_OPTS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest block mb-xs">
                DATA CLASSIFICATION
              </label>
              <div className="grid grid-cols-4 gap-xs">
                {(["public", "internal", "confidential", "restricted"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setClassification(c)}
                    className={`py-sm font-mono-technical text-[10px] border transition-colors ${
                      classification === c
                        ? c === "restricted"
                          ? "border-critical bg-critical/10 text-critical"
                          : c === "confidential"
                            ? "border-tertiary bg-tertiary/10 text-tertiary"
                            : "border-primary bg-primary/10 text-primary"
                        : "border-border-muted text-on-surface-variant hover:border-primary/50"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest block mb-xs">
                DESCRIPTION (OPTIONAL)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Brief description of the change initiative or programme..."
                className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[11px] text-on-surface resize-none outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>
        )}

        {/* Step 1: Regulatory Frameworks */}
        {step === 1 && (
          <div className="space-y-lg">
            <div className="space-y-xs">
              <p className="font-mono-technical text-[11px] text-on-surface">
                Select the regulatory frameworks that apply to this {type}.
              </p>
              <p className="font-mono-technical text-[9px] text-on-surface-variant">
                The AI advisor will use these to suggest gate requirements, evidence types, and
                compliance controls. You can change this later in Admin → Frameworks.
              </p>
            </div>
            <div className="space-y-sm">
              {FRAMEWORK_OPTS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => toggleFramework(f.value)}
                  className={`w-full text-left px-lg py-md border transition-colors flex items-center justify-between ${
                    frameworks.includes(f.value)
                      ? "border-primary bg-primary/10"
                      : "border-border-muted hover:border-primary/50"
                  }`}
                >
                  <div>
                    <p className="font-body-bold text-body-bold text-on-surface text-[13px]">
                      {f.label}
                    </p>
                    <p className="font-mono-technical text-[9px] text-on-surface-variant">
                      {f.region}
                    </p>
                  </div>
                  {frameworks.includes(f.value) && (
                    <Icon name="check_circle" size={16} className="text-primary" />
                  )}
                </button>
              ))}
            </div>
            {domain === "banking" && (
              <div className="bg-primary/5 border border-primary/30 p-md">
                <p className="font-mono-technical text-[9px] text-primary">
                  AI RECOMMENDATION: Banking enterprises typically require DORA + SOC2 + ISO 27001.
                  If processing EU personal data, add GDPR.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 2: AI Mode */}
        {step === 2 && (
          <div className="space-y-lg">
            <div className="space-y-xs">
              <p className="font-mono-technical text-[11px] text-on-surface">
                Set the initial AI governance mode for this {type}.
              </p>
              <p className="font-mono-technical text-[9px] text-on-surface-variant">
                This controls how much AI autonomy is allowed. It can be changed at any time from
                the AI Control Center, and locked immediately in an emergency.
              </p>
            </div>
            <div className="space-y-sm">
              {AI_MODE_OPTS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setAiMode(m.value)}
                  className={`w-full text-left px-lg py-md border transition-colors flex items-center justify-between ${
                    aiMode === m.value
                      ? "border-primary bg-primary/10"
                      : "border-border-muted hover:border-primary/50"
                  }`}
                >
                  <div>
                    <p className="font-body-bold text-body-bold text-on-surface text-[13px]">
                      {m.label}
                    </p>
                    <p className="font-mono-technical text-[9px] text-on-surface-variant">
                      {m.desc}
                    </p>
                  </div>
                  {aiMode === m.value && (
                    <Icon name="check_circle" size={16} className="text-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Connectors */}
        {step === 3 && (
          <div className="space-y-lg">
            <p className="font-mono-technical text-[11px] text-on-surface">
              Connectors are configured globally and then assigned to projects via trigger rules.
            </p>
            <div className="bg-surface-container-low border border-border-muted p-lg space-y-md">
              {[
                {
                  icon: "J",
                  label: "Jira",
                  desc: "Portfolio Epics → governance cases. Sprint governance, change delivery.",
                  setup: "/admin/connectors",
                },
                {
                  icon: "GH",
                  label: "GitHub",
                  desc: "PRs to main/release → governance classification. File-pattern triggers.",
                  setup: "/admin/connectors",
                },
                {
                  icon: "GL",
                  label: "GitLab",
                  desc: "MRs with governance-required label → gate pipeline.",
                  setup: "/admin/connectors",
                },
              ].map((c) => (
                <div
                  key={c.label}
                  className="flex items-start gap-md py-sm border-b border-border-muted last:border-0"
                >
                  <div className="w-8 h-8 bg-surface border border-border-muted flex items-center justify-center shrink-0">
                    <span className="font-mono-technical text-[9px] text-on-surface-variant">
                      {c.icon}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-mono-technical text-[11px] text-on-surface">{c.label}</p>
                    <p className="font-mono-technical text-[9px] text-on-surface-variant leading-snug">
                      {c.desc}
                    </p>
                  </div>
                  <a
                    href={c.setup}
                    className="font-mono-technical text-[9px] text-primary border border-primary/30 px-md py-xs hover:bg-primary/10 transition-colors"
                  >
                    CONFIGURE
                  </a>
                </div>
              ))}
            </div>
            <div className="bg-surface-container-low border border-border-muted p-md">
              <p className="font-mono-technical text-[9px] text-on-surface-variant">
                After creating the project, go to Admin → Trigger Rules to define which events from
                your connected tools activate governance for THIS project specifically. You can
                scope rules by Jira project key, GitHub repository, or GitLab namespace.
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="space-y-lg">
            <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">
              REVIEW CONFIGURATION
            </p>
            <div className="space-y-sm border border-border-muted">
              {[
                { label: "TYPE", value: type.toUpperCase() },
                { label: "NAME", value: name },
                { label: "KEY", value: key },
                { label: "OWNER", value: ownerEmail },
                { label: "DOMAIN", value: domain.toUpperCase() },
                { label: "CLASSIFICATION", value: classification.toUpperCase() },
                {
                  label: "FRAMEWORKS",
                  value: frameworks.join(", ") || "None selected",
                },
                { label: "AI MODE", value: aiMode.replace(/_/g, " ") },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center px-lg py-sm border-b border-border-muted last:border-0"
                >
                  <span className="font-mono-technical text-[9px] text-on-surface-variant w-[140px] shrink-0 tracking-widest">
                    {row.label}
                  </span>
                  <span className="font-mono-technical text-[11px] text-on-surface">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
            {error && <p className="font-mono-technical text-[10px] text-critical">{error}</p>}
            <div className="bg-primary/5 border border-primary/30 p-md space-y-xs">
              <p className="font-mono-technical text-[9px] text-primary tracking-widest">
                WHAT HAPPENS NEXT
              </p>
              <p className="font-mono-technical text-[9px] text-on-surface-variant leading-relaxed">
                1. Project is created and a GovernanceEvent(PROJECT_CREATED) is logged to the flight
                recorder. 2. AI Control is initialised with {aiMode.replace(/_/g, " ")} mode. 3. You
                then configure trigger rules to activate governance from Jira/GitHub/GitLab. 4. As
                events arrive, the platform runs context enrichment → risk scoring → adaptive gate
                pipeline automatically.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-xl py-lg border-t border-border-muted flex items-center gap-sm">
        {step > 0 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="px-xl py-sm border border-border-muted text-on-surface-variant font-mono-technical text-[10px] hover:border-on-surface-variant"
          >
            ← BACK
          </button>
        )}
        <div className="flex-1" />
        {step < WIZARD_STEPS.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext}
            className="px-xl py-sm bg-primary text-background font-mono-technical text-[10px] hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            NEXT →
          </button>
        ) : (
          <button
            onClick={() => void create()}
            disabled={saving}
            className="flex items-center gap-sm px-xl py-sm bg-primary text-background font-mono-technical text-[10px] hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <>
                <span className="w-3 h-3 border border-background/40 border-t-background rounded-full animate-spin" />
                CREATING…
              </>
            ) : (
              <>
                <Icon name="add_circle" size={12} className="text-background" />
                CREATE {type.toUpperCase()}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: ProjectSummary }) {
  const cfg = READINESS_CFG[project.readiness];
  const setupComplete = project.triggerRules > 0 && project.connectors.length > 0;

  return (
    <div
      className={`bg-surface border transition-colors ${project.readiness === "NO_GO" ? "border-critical/40" : "border-border-muted"} hover:border-primary/40 p-lg space-y-md`}
    >
      {/* Header */}
      <div className="flex items-start gap-md">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-sm flex-wrap">
            <span className="font-body-bold text-body-bold text-on-surface text-[14px] truncate">
              {project.name}
            </span>
            {project.status === "active" && (
              <span className="px-1.5 py-0.5 font-mono-technical text-[8px] border border-primary text-primary bg-primary/10">
                ACTIVE
              </span>
            )}
          </div>
          <div className="flex items-center gap-sm mt-xs">
            <span className="font-mono-technical text-[10px] text-primary">{project.key}</span>
            {project.domain && (
              <span className="font-mono-technical text-[9px] text-on-surface-variant capitalize">
                · {project.domain}
              </span>
            )}
            <span className="font-mono-technical text-[9px] text-on-surface-variant">
              · {project.ownerEmail}
            </span>
          </div>
        </div>
        {/* Readiness badge */}
        <div
          className={`px-2 py-1 font-mono-technical text-[10px] border flex items-center gap-xs shrink-0 ${cfg.cls}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-xs">
        {[
          { label: "CASES", value: project.activeCases, warn: false },
          { label: "BLOCKED", value: project.blockedGates, warn: project.blockedGates > 0 },
          { label: "PENDING", value: project.pendingGates, warn: project.pendingGates > 0 },
          { label: "RULES", value: project.triggerRules, warn: project.triggerRules === 0 },
        ].map((m) => (
          <div
            key={m.label}
            className={`border p-xs text-center ${m.warn && m.value > 0 ? "border-critical/40 bg-critical/5" : m.warn ? "border-tertiary/40 bg-tertiary/5" : "border-border-muted"}`}
          >
            <p
              className={`font-mono-technical text-[16px] font-bold ${m.warn && m.value > 0 ? "text-critical" : m.warn ? "text-tertiary" : "text-on-surface"}`}
            >
              {m.value}
            </p>
            <p className="font-mono-technical text-[8px] text-on-surface-variant">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Connectors + Frameworks */}
      <div className="flex items-center gap-sm flex-wrap">
        {project.connectors.length > 0 ? (
          project.connectors.map((c) => (
            <span
              key={c}
              className="px-1.5 py-0.5 font-mono-technical text-[9px] border border-primary text-primary bg-primary/10"
            >
              {c.toUpperCase()}
            </span>
          ))
        ) : (
          <span className="px-1.5 py-0.5 font-mono-technical text-[9px] border border-tertiary text-tertiary">
            NO CONNECTORS
          </span>
        )}
        {project.frameworks.slice(0, 3).map((f) => (
          <span
            key={f}
            className="px-1.5 py-0.5 font-mono-technical text-[9px] border border-border-muted text-on-surface-variant"
          >
            {f.replace(/_/g, " ")}
          </span>
        ))}
        {project.frameworks.length > 3 && (
          <span className="font-mono-technical text-[9px] text-on-surface-variant/60">
            +{project.frameworks.length - 3} more
          </span>
        )}
      </div>

      {/* Setup warnings */}
      {!setupComplete && (
        <div className="bg-tertiary/5 border border-tertiary/30 p-sm">
          <p className="font-mono-technical text-[9px] text-tertiary">
            {project.connectors.length === 0 && project.triggerRules === 0
              ? "No connectors or trigger rules configured — governance cannot be triggered automatically."
              : project.connectors.length === 0
                ? "No connectors linked — link Jira/GitHub/GitLab in Admin → Connectors."
                : "No trigger rules — define which events activate governance in Admin → Trigger Rules."}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-sm pt-sm border-t border-border-muted">
        <a
          href={`/cases?project=${project.key}`}
          className="flex-1 text-center py-xs font-mono-technical text-[10px] border border-border-muted text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
        >
          VIEW CASES
        </a>
        <a
          href={`/orchestration?project=${project.key}`}
          className="flex-1 text-center py-xs font-mono-technical text-[10px] border border-border-muted text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
        >
          ORCHESTRATION
        </a>
        <a
          href={`/release-readiness?project=${project.key}`}
          className={`flex-1 text-center py-xs font-mono-technical text-[10px] border transition-colors ${
            project.readiness === "NO_GO"
              ? "border-critical text-critical hover:bg-critical/10"
              : project.readiness === "GO"
                ? "border-primary text-primary hover:bg-primary/10"
                : "border-border-muted text-on-surface-variant hover:border-primary hover:text-primary"
          }`}
        >
          {project.readiness === "GO"
            ? "GO ✓"
            : project.readiness === "NO_GO"
              ? "BLOCKED"
              : "READINESS"}
        </a>
      </div>
    </div>
  );
}

// ── Governance readiness guide panel ────────────────────────────────────────
function GovernanceGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border-muted bg-surface-container-low">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-xl py-md flex items-center justify-between hover:bg-surface-container-highest transition-colors"
      >
        <div className="flex items-center gap-md">
          <Icon name="route" size={16} className="text-primary" />
          <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
            HOW TO REACH GOVERNANCE GO &amp; SIGN-OFF
          </p>
        </div>
        <Icon
          name={open ? "expand_less" : "expand_more"}
          size={16}
          className="text-on-surface-variant"
        />
      </button>
      {open && (
        <div className="px-xl pb-xl space-y-md border-t border-border-muted pt-md">
          {[
            {
              n: "1",
              title: "Create or onboard the project",
              detail:
                "Admin creates the project with a unique key, owner, domain, and applicable frameworks (DORA, SOC2, etc.). The system initialises an AI Control setting and emits PROJECT_CREATED to the flight recorder.",
            },
            {
              n: "2",
              title: "Link tool connectors (Jira / GitHub / GitLab)",
              detail:
                "Go to Admin → Connectors. Register your Jira instance URL + API key, GitHub app, or GitLab webhook token. Each connector gets a webhook URL to paste into your tool. This makes events flow into NexoriOS.",
            },
            {
              n: "3",
              title: "Define trigger rules per project",
              detail:
                "Go to Admin → Trigger Rules. Create rules like: 'Jira Portfolio Epic in project BANK → FULL_PIPELINE' or 'GitHub PR to main with AI in changed files → FULL_PIPELINE'. Only matching events create governance cases.",
            },
            {
              n: "4",
              title: "AI context enrichment + risk scoring",
              detail:
                "When a matching event arrives, NexoriOS automatically: fetches Jira/GitHub context, scores across 11 dimensions, selects intensity (standard/regulated/enhanced/critical), and composes an adaptive gate pipeline.",
            },
            {
              n: "5",
              title: "Work through the gate pipeline",
              detail:
                "Each gate requires evidence upload + expert approval. Gates can inherit approvals from recent similar changes (skip conditions). AI routes each gate to the right expert based on domain and workload.",
            },
            {
              n: "6",
              title: "Request waivers for any blocked gate",
              detail:
                "If a gate cannot be cleared in time, request a waiver (emergency, time-limited, risk-accepted, or expedited). AI generates a residual risk statement and compensating controls. Waiver requires approver sign-off.",
            },
            {
              n: "7",
              title: "GO — Release Readiness sign-off",
              detail:
                "Release Readiness computes GO/CONDITIONAL/NO_GO across all active cases. GO means: zero rejected gates, zero required-pending gates. Approvers digitally sign off. The event is logged as a GovernanceEvent and included in the audit export.",
            },
          ].map((s) => (
            <div key={s.n} className="flex gap-md">
              <div className="w-6 h-6 bg-primary/10 border border-primary text-primary font-mono-technical text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                {s.n}
              </div>
              <div>
                <p className="font-mono-technical text-[11px] text-on-surface mb-xs">{s.title}</p>
                <p className="font-mono-technical text-[10px] text-on-surface-variant leading-relaxed">
                  {s.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProjectsClient({ projects }: { projects: ProjectSummary[] }) {
  const [showNew, setShowNew] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "no_go" | "setup">("all");

  const filtered = projects.filter((p) => {
    if (filterStatus === "no_go") return p.readiness === "NO_GO";
    if (filterStatus === "setup") return p.readiness === "SETUP";
    return true;
  });

  return (
    <div className="space-y-xl">
      <GovernanceGuide />

      {/* Actions bar */}
      <div className="flex items-center gap-md">
        <div className="flex gap-xs">
          {(
            [
              ["all", "ALL PROJECTS"],
              ["no_go", "BLOCKED"],
              ["setup", "NEEDS SETUP"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilterStatus(v)}
              className={`px-md py-xs font-mono-technical text-[10px] border transition-colors ${
                filterStatus === v
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border-muted text-on-surface-variant hover:border-primary/50"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-sm px-xl py-sm bg-primary text-background font-mono-technical text-[11px] hover:bg-primary/90 transition-colors"
        >
          <Icon name="add" size={14} className="text-background" />
          NEW PROJECT / PROGRAM
        </button>
      </div>

      {showNew && <NewProjectWizard onClose={() => setShowNew(false)} />}

      {filtered.length === 0 ? (
        <div className="border border-border-muted p-xl text-center space-y-md">
          <Icon name="folder_open" size={32} className="text-on-surface-variant/40 mx-auto block" />
          <p className="font-mono-technical text-[12px] text-on-surface-variant">
            {projects.length === 0
              ? "No projects yet. Click NEW PROJECT / PROGRAM to onboard your first one."
              : "No projects match the current filter."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-lg">
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
