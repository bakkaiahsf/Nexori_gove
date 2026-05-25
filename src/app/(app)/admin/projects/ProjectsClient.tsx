"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AIControlMode, RegulatoryFramework } from "@prisma/client";
import type { ProjectSummary } from "./constants";

// ─── Types ───────────────────────────────────────────────────────────────────

type Classification = "public" | "internal" | "confidential" | "restricted";

type EpicData = {
  key: string;
  summary: string;
  description: string;
  issueType: string;
  status: string;
  priority?: string;
  labels: string[];
  components: string[];
  assignee?: string;
  reporter?: string;
  created?: string;
  duedate?: string | null;
};

type AISuggestion = {
  suggestedTemplate: string;
  suggestedFrameworks: RegulatoryFramework[];
  suggestedAiMode: AIControlMode;
  riskFactors: string[];
  rationale: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
};

type Connector = { id: string; type: string; name: string };

type JiraBoard = {
  id: number;
  name: string;
  type: string;
  projectKey?: string;
  projectName?: string;
};

type JiraIssueItem = {
  key: string;
  summary: string;
  issueType: string;
  status: string;
  labels: string[];
  priority?: string;
  assignee?: string;
};

type GovernanceTemplate = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  effort: string;
  stages: { stage: string; gateCategories: string[]; gateHints: string[] }[];
  suggestedFrameworks: string[];
  suggestedDomains: string[];
  isBuiltIn: boolean;
};

type ComposedGate = {
  gateId: string;
  slug: string;
  name: string;
  category: string;
  approverRoles: string[];
  slaHours: number;
  description: string | null;
  reason: string;
  suggestedExperts: {
    id: string;
    name: string | null;
    email: string;
    domains: string[];
    avgResolutionHours: number | null;
    activeApprovals: number;
  }[];
};

type CreatedCase = { caseId: string; title: string; gateCount: number };

// ─── Constants ───────────────────────────────────────────────────────────────

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

const WIZARD_STEPS = [
  { id: "source", label: "Source", icon: "input" },
  { id: "identity", label: "Identity", icon: "badge" },
  { id: "template", label: "Gov. Template", icon: "category" },
  { id: "frameworks", label: "Frameworks", icon: "policy" },
  { id: "aimode", label: "AI Mode", icon: "psychology" },
  { id: "review", label: "Review & Create", icon: "check_circle" },
];

const CATEGORY_COLOR: Record<string, string> = {
  regulatory: "text-critical border-critical/30 bg-critical/5",
  security: "text-tertiary border-tertiary/30 bg-tertiary/5",
  architecture: "text-primary border-primary/30 bg-primary/5",
  "ai-governance": "text-primary border-primary/30 bg-primary/10",
  technical: "text-on-surface border-border-muted",
  "change-management": "text-on-surface-variant border-border-muted",
  operational: "text-on-surface-variant border-border-muted",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function ConfidenceBadge({ confidence }: { confidence: "HIGH" | "MEDIUM" | "LOW" }) {
  const cls =
    confidence === "HIGH"
      ? "text-primary border-primary bg-primary/10"
      : confidence === "MEDIUM"
        ? "text-tertiary border-tertiary bg-tertiary/10"
        : "text-on-surface-variant border-border-muted";
  return (
    <span className={`px-1.5 py-0.5 font-mono-technical text-[8px] border ${cls}`}>
      {confidence} CONFIDENCE
    </span>
  );
}

// ─── NewProjectWizard ─────────────────────────────────────────────────────────

function NewProjectWizard({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [created, setCreated] = useState<{ projectId: string; key: string; name: string } | null>(
    null
  );
  const [createdCase, setCreatedCase] = useState<CreatedCase | null>(null);

  // Step 0: Source
  const [importMode, setImportMode] = useState<"manual" | "jira">("manual");
  const [jiraInputMode, setJiraInputMode] = useState<"key" | "board">("key");
  const [jiraConnectors, setJiraConnectors] = useState<Connector[]>([]);
  const [importConnectorId, setImportConnectorId] = useState("");
  // Key mode
  const [importKey, setImportKey] = useState("");
  // Board mode
  const [boards, setBoards] = useState<JiraBoard[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<JiraBoard | null>(null);
  const [boardIssues, setBoardIssues] = useState<JiraIssueItem[]>([]);
  const [boardSearch, setBoardSearch] = useState("");
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [loadingIssues, setLoadingIssues] = useState(false);
  // Epic data
  const [epicData, setEpicData] = useState<EpicData | null>(null);
  const [fetchingEpic, setFetchingEpic] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [analyzingAI, setAnalyzingAI] = useState(false);
  const [aiApplied, setAiApplied] = useState(false);

  // Step 1: Identity
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [ownerEmail, setOwnerEmail] = useState(session?.user?.email ?? "");
  const [domain, setDomain] = useState("banking");
  const [classification, setClassification] = useState<Classification>("internal");
  const [type, setType] = useState<"project" | "program">("project");

  // Step 2: Template (fetched from API)
  const [apiTemplates, setApiTemplates] = useState<GovernanceTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("");

  // Step 3: Frameworks
  const [frameworks, setFrameworks] = useState<RegulatoryFramework[]>([RegulatoryFramework.DORA]);

  // Step 4: AI Mode
  const [aiMode, setAiMode] = useState<AIControlMode>(AIControlMode.AI_ASSIST);

  // Compose pipeline (runs after template selected + epicData present)
  const [composedGates, setComposedGates] = useState<ComposedGate[]>([]);
  const [composedSummary, setComposedSummary] = useState("");
  const [composingPipeline, setComposingPipeline] = useState(false);

  // Load templates from API
  useEffect(() => {
    setLoadingTemplates(true);
    fetch("/api/governance/templates")
      .then((res) => (res.ok ? (res.json() as Promise<{ templates: GovernanceTemplate[] }>) : null))
      .then((data) => {
        if (data?.templates) setApiTemplates(data.templates);
      })
      .finally(() => setLoadingTemplates(false));
  }, []);

  // Load Jira connectors when import mode is selected
  useEffect(() => {
    if (importMode !== "jira") return;
    fetch("/api/integrations")
      .then((res) => (res.ok ? (res.json() as Promise<{ connectors: Connector[] }>) : null))
      .then((data) => {
        const jira = data?.connectors.filter((c) => c.type === "jira") ?? [];
        setJiraConnectors(jira);
        if (jira.length > 0 && !importConnectorId) setImportConnectorId(jira[0].id);
      });
  }, [importMode, importConnectorId]);

  // Load boards when board mode is selected and connector is set
  useEffect(() => {
    if (importMode !== "jira" || jiraInputMode !== "board" || !importConnectorId) return;
    setLoadingBoards(true);
    setBoards([]);
    setSelectedBoard(null);
    setBoardIssues([]);
    fetch(`/api/integrations/jira/boards?connectorId=${importConnectorId}`)
      .then((res) => (res.ok ? (res.json() as Promise<{ boards: JiraBoard[] }>) : null))
      .then((data) => {
        if (data?.boards) setBoards(data.boards);
      })
      .finally(() => setLoadingBoards(false));
  }, [importMode, jiraInputMode, importConnectorId]);

  const analyzeEpic = useCallback(
    async (epic: EpicData) => {
      setAnalyzingAI(true);
      try {
        const res = await fetch("/api/governance/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: epic.summary,
            description: epic.description,
            issueType: epic.issueType,
            labels: epic.labels,
            components: epic.components,
            domain,
            source: "jira",
          }),
        });
        if (res.ok) setAiSuggestion((await res.json()) as AISuggestion);
      } finally {
        setAnalyzingAI(false);
      }
    },
    [domain]
  );

  async function fetchEpicByKey(epicKey: string) {
    if (!importConnectorId || !epicKey.trim()) return;
    setFetchingEpic(true);
    setFetchError("");
    setEpicData(null);
    setAiSuggestion(null);
    setAiApplied(false);
    setComposedGates([]);

    try {
      const res = await fetch(
        `/api/integrations/jira/epic?connectorId=${importConnectorId}&epicKey=${epicKey.trim()}`
      );
      if (!res.ok) {
        setFetchError(((await res.json()) as { error: string }).error || "Failed to fetch epic");
        return;
      }
      const data = (await res.json()) as EpicData;
      setEpicData(data);
      setName(data.summary);
      setDescription(data.description ?? "");
      setKey(autoKey(data.summary));
      if (data.reporter) setOwnerEmail(data.reporter);
      await analyzeEpic(data);
    } finally {
      setFetchingEpic(false);
    }
  }

  async function fetchBoardIssues() {
    if (!importConnectorId || !selectedBoard) return;
    setLoadingIssues(true);
    setBoardIssues([]);
    const params = new URLSearchParams({ connectorId: importConnectorId });
    if (selectedBoard.projectKey) params.set("projectKey", selectedBoard.projectKey);
    if (boardSearch) params.set("search", boardSearch);

    try {
      const res = await fetch(`/api/integrations/jira/issues?${params.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as { issues: JiraIssueItem[] };
        setBoardIssues(data.issues);
      }
    } finally {
      setLoadingIssues(false);
    }
  }

  // Auto-fetch issues when board is selected
  useEffect(() => {
    if (selectedBoard) void fetchBoardIssues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBoard]);

  function selectBoardIssue(issue: JiraIssueItem) {
    setImportKey(issue.key);
    void fetchEpicByKey(issue.key);
  }

  function applyAIRecommendations() {
    if (!aiSuggestion) return;
    setSelectedTemplate(aiSuggestion.suggestedTemplate);
    setFrameworks(aiSuggestion.suggestedFrameworks);
    setAiMode(aiSuggestion.suggestedAiMode);
    setAiApplied(true);
  }

  function handleNameChange(v: string) {
    setName(v);
    if (!key || key === autoKey(name)) setKey(autoKey(v));
  }

  function toggleFramework(f: RegulatoryFramework) {
    setFrameworks((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  }

  async function runCompose(templateId: string) {
    if (!epicData && !name) return;
    setComposingPipeline(true);
    setComposedGates([]);
    try {
      const res = await fetch("/api/governance/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: name || epicData?.summary || "",
          description: description || epicData?.description || "",
          issueType: epicData?.issueType,
          labels: epicData?.labels ?? [],
          components: epicData?.components ?? [],
          domain,
          templateId,
          frameworks,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { gates: ComposedGate[]; summary: string };
        setComposedGates(data.gates);
        setComposedSummary(data.summary);
      }
    } finally {
      setComposingPipeline(false);
    }
  }

  function handleTemplateSelect(tpl: GovernanceTemplate) {
    setSelectedTemplate(tpl.id);
    // Apply template's suggested frameworks if AI hasn't already applied
    if (!aiApplied && tpl.suggestedFrameworks.length > 0) {
      const valid = tpl.suggestedFrameworks.filter((f): f is RegulatoryFramework =>
        Object.values(RegulatoryFramework).includes(f as RegulatoryFramework)
      );
      if (valid.length > 0) setFrameworks(valid);
    }
    // Compose gate pipeline in background
    void runCompose(tpl.id);
  }

  const canNext =
    step === 0
      ? importMode === "manual" || epicData !== null
      : step === 1
        ? key.length >= 2 && name.length >= 3 && ownerEmail.includes("@")
        : step === 2
          ? selectedTemplate !== ""
          : step === 3
            ? frameworks.length > 0
            : true;

  async function create() {
    if (saving) return;
    setSaving(true);
    setSubmitError("");
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
        setSubmitError(typeof err.error === "string" ? err.error : "Failed to create project");
        setSaving(false);
        return;
      }
      const data = (await res.json()) as { projectId: string; key: string; name: string };
      setCreated(data);

      // If imported from Jira, auto-activate governance with composed gate pipeline
      if (epicData && data.projectId) {
        try {
          const activateRes = await fetch(`/api/projects/${data.projectId}/activate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: epicData.summary,
              description: epicData.description || undefined,
              phase: "initiation",
              epicKey: epicData.key,
              epicConnectorId: importConnectorId || undefined,
              templateId: selectedTemplate || undefined,
              composedGateSlugs: composedGates.map((g) => g.slug),
              activatedBy: session?.user?.email,
            }),
          });
          if (activateRes.ok) setCreatedCase((await activateRes.json()) as CreatedCase);
        } catch {
          // governance activation failure is non-blocking
        }
      }

      router.refresh();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Network error");
      setSaving(false);
    }
  }

  // ── Success screen ──────────────────────────────────────────────────────────

  if (created) {
    return (
      <div className="border border-primary bg-surface p-xl space-y-lg max-w-[720px] mx-auto">
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

        {createdCase && (
          <div className="bg-primary/5 border border-primary p-md space-y-sm">
            <p className="font-mono-technical text-[9px] text-primary tracking-widest">
              GOVERNANCE ACTIVATED
            </p>
            <p className="font-mono-technical text-[11px] text-on-surface">{createdCase.title}</p>
            <p className="font-mono-technical text-[9px] text-on-surface-variant">
              {createdCase.gateCount} governance gate{createdCase.gateCount !== 1 ? "s" : ""} opened
              — experts assigned by platform intelligence.
            </p>
            <div className="flex gap-sm pt-xs">
              {composedGates.slice(0, 5).map((g) => (
                <span
                  key={g.slug}
                  className={`px-1.5 py-0.5 font-mono-technical text-[8px] border ${CATEGORY_COLOR[g.category] ?? "border-border-muted text-on-surface-variant"}`}
                >
                  {g.name}
                </span>
              ))}
              {composedGates.length > 5 && (
                <span className="font-mono-technical text-[9px] text-on-surface-variant">
                  +{composedGates.length - 5} more
                </span>
              )}
            </div>
            <a
              href={`/cases?project=${created.key}`}
              className="inline-block mt-xs font-mono-technical text-[10px] text-primary border border-primary px-md py-xs hover:bg-primary/10 transition-colors"
            >
              VIEW GOVERNANCE CASE →
            </a>
          </div>
        )}

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
              className="flex items-start gap-md py-sm border-b border-border-muted last:border-0 hover:bg-surface-container-highest px-xs transition-colors"
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

  const activeTpl = apiTemplates.find((t) => t.id === selectedTemplate);

  // ── Wizard ──────────────────────────────────────────────────────────────────

  return (
    <div className="border border-border-muted bg-surface max-w-[760px] mx-auto">
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
            className={`flex items-center gap-xs px-md py-xs font-mono-technical text-[10px] border shrink-0 transition-colors ${i === step ? "border-primary bg-primary/10 text-primary" : i < step ? "border-primary/40 text-primary/60 cursor-pointer hover:bg-primary/5" : "border-border-muted text-on-surface-variant/40 cursor-default"}`}
          >
            <Icon name={s.icon} size={12} />
            {s.label}
          </button>
        ))}
      </div>

      {/* Step content */}
      <div className="p-xl space-y-lg min-h-[380px]">
        {/* ── Step 0: Source ──────────────────────────────────────────────── */}
        {step === 0 && (
          <div className="space-y-lg">
            <div>
              <p className="font-mono-technical text-[11px] text-on-surface mb-xs">
                How would you like to onboard this project?
              </p>
              <p className="font-mono-technical text-[9px] text-on-surface-variant">
                Import from a connected Jira instance to auto-fill identity fields, receive AI
                governance recommendations, and automatically open a governance case.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-sm">
              {(["manual", "jira"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setImportMode(mode)}
                  className={`flex flex-col items-center gap-sm p-lg border transition-colors ${importMode === mode ? "border-primary bg-primary/10" : "border-border-muted hover:border-primary/50"}`}
                >
                  <Icon
                    name={mode === "manual" ? "edit_note" : "cloud_download"}
                    size={24}
                    className={importMode === mode ? "text-primary" : "text-on-surface-variant"}
                  />
                  <div className="text-center">
                    <p
                      className={`font-mono-technical text-[11px] ${importMode === mode ? "text-primary" : "text-on-surface"}`}
                    >
                      {mode === "manual" ? "MANUAL SETUP" : "IMPORT FROM JIRA"}
                    </p>
                    <p className="font-mono-technical text-[9px] text-on-surface-variant mt-xs">
                      {mode === "manual"
                        ? "Fill in all project details manually"
                        : "Pull Portfolio Epic metadata + auto-open governance case"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-sm">
              {[
                { tool: "GitHub", hint: "Opens governance via PR webhook — configure in Admin → Connectors" },
                { tool: "GitLab", hint: "Opens governance via MR webhook — configure in Admin → Connectors" },
              ].map(({ tool, hint }) => (
                <div
                  key={tool}
                  className="flex-1 flex flex-col items-start gap-xs p-md border border-border-muted"
                >
                  <div className="flex items-center gap-xs w-full">
                    <Icon name="hub" size={14} className="text-on-surface-variant" />
                    <p className="font-mono-technical text-[9px] text-on-surface-variant flex-1">
                      {tool.toUpperCase()} IMPORT
                    </p>
                    <span className="font-mono-technical text-[8px] border border-primary/30 px-1 text-primary/70">
                      WEBHOOK
                    </span>
                  </div>
                  <p className="font-mono-technical text-[9px] text-on-surface-variant/60">{hint}</p>
                </div>
              ))}
            </div>

            {/* ── Jira import panel ──────────────────────────────────────── */}
            {importMode === "jira" && (
              <div className="border border-primary/20 bg-primary/5 p-lg space-y-md">
                <p className="font-mono-technical text-[9px] text-primary tracking-widest">
                  JIRA IMPORT
                </p>

                {jiraConnectors.length === 0 ? (
                  <div className="bg-tertiary/5 border border-tertiary/30 p-md">
                    <p className="font-mono-technical text-[10px] text-tertiary">
                      No Jira connectors registered.{" "}
                      <a href="/admin/connectors" className="underline">
                        Add a connector first →
                      </a>
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Connector selector + input mode toggle */}
                    <div className="flex gap-md items-end">
                      <div className="flex-1">
                        <label className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest block mb-xs">
                          JIRA CONNECTOR
                        </label>
                        {/* Single connector → show as badge, no dropdown */}
                        {jiraConnectors.length === 1 ? (
                          <div className="flex items-center gap-sm px-md py-sm border border-primary/40 bg-primary/5">
                            <span className="w-5 h-5 border border-primary bg-primary/10 flex items-center justify-center font-mono-technical text-[9px] text-primary shrink-0">J</span>
                            <span className="font-mono-technical text-[11px] text-on-surface flex-1">{jiraConnectors[0].name}</span>
                            <span className="font-mono-technical text-[9px] text-primary">ACTIVE</span>
                          </div>
                        ) : (
                          /* Multiple connectors → styled button list */
                          <div className="space-y-xs">
                            {jiraConnectors.map((c) => (
                              <button
                                key={c.id}
                                onClick={() => setImportConnectorId(c.id)}
                                className={`w-full text-left flex items-center gap-sm px-md py-sm border font-mono-technical text-[11px] transition-colors ${importConnectorId === c.id ? "border-primary bg-primary/5 text-on-surface" : "border-border-muted text-on-surface-variant hover:border-primary/50"}`}
                              >
                                <span className={`w-5 h-5 border flex items-center justify-center text-[9px] shrink-0 ${importConnectorId === c.id ? "border-primary text-primary" : "border-border-muted text-on-surface-variant"}`}>J</span>
                                <span className="flex-1">{c.name}</span>
                                {importConnectorId === c.id && <Icon name="check" size={12} className="text-primary shrink-0" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-xs">
                        {(["key", "board"] as const).map((m) => (
                          <button
                            key={m}
                            onClick={() => setJiraInputMode(m)}
                            className={`px-md py-sm font-mono-technical text-[10px] border transition-colors ${jiraInputMode === m ? "border-primary bg-primary/10 text-primary" : "border-border-muted text-on-surface-variant hover:border-primary/50"}`}
                          >
                            {m === "key" ? "ENTER KEY" : "BROWSE BOARDS"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* KEY mode */}
                    {jiraInputMode === "key" && (
                      <div>
                        <label className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest block mb-xs">
                          PORTFOLIO EPIC KEY
                        </label>
                        <div className="flex gap-xs">
                          <input
                            value={importKey}
                            onChange={(e) => setImportKey(e.target.value.toUpperCase())}
                            placeholder="e.g. BANK-120"
                            onKeyDown={(e) => e.key === "Enter" && void fetchEpicByKey(importKey)}
                            className="flex-1 bg-surface border border-border-muted px-md py-sm font-mono-technical text-[11px] outline-none focus:border-primary"
                          />
                          <button
                            onClick={() => void fetchEpicByKey(importKey)}
                            disabled={fetchingEpic || !importKey.trim()}
                            className="px-md py-sm bg-primary text-background font-mono-technical text-[10px] hover:bg-primary/90 disabled:opacity-40 flex items-center gap-xs"
                          >
                            {fetchingEpic ? (
                              <span className="w-3 h-3 border border-background/40 border-t-background rounded-full animate-spin" />
                            ) : (
                              <Icon name="download" size={12} className="text-background" />
                            )}
                            FETCH
                          </button>
                        </div>
                      </div>
                    )}

                    {/* BOARD mode */}
                    {jiraInputMode === "board" && (
                      <div className="space-y-md">
                        {loadingBoards && (
                          <div className="flex items-center gap-sm p-md border border-border-muted">
                            <span className="w-3 h-3 border border-primary/40 border-t-primary rounded-full animate-spin shrink-0" />
                            <p className="font-mono-technical text-[10px] text-on-surface-variant">
                              Loading boards from Jira…
                            </p>
                          </div>
                        )}
                        {!loadingBoards && boards.length === 0 && (
                          <p className="font-mono-technical text-[10px] text-on-surface-variant p-md border border-border-muted">
                            No boards found. Check connector permissions or switch to Enter Key
                            mode.
                          </p>
                        )}
                        {boards.length > 0 && !selectedBoard && (
                          <div className="space-y-xs">
                            <p className="font-mono-technical text-[9px] text-on-surface-variant">
                              Select a board to browse Portfolio Epics
                            </p>
                            <div className="max-h-[200px] overflow-y-auto space-y-xs custom-scrollbar">
                              {boards.map((b) => (
                                <button
                                  key={b.id}
                                  onClick={() => setSelectedBoard(b)}
                                  className="w-full text-left flex items-center gap-md p-sm border border-border-muted hover:border-primary/50 hover:bg-primary/5 transition-colors"
                                >
                                  <Icon
                                    name={b.type === "scrum" ? "sprint" : "view_kanban"}
                                    size={14}
                                    className="text-on-surface-variant shrink-0"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="font-mono-technical text-[11px] text-on-surface truncate">
                                      {b.name}
                                    </p>
                                    {b.projectName && (
                                      <p className="font-mono-technical text-[9px] text-on-surface-variant">
                                        {b.projectKey} · {b.projectName}
                                      </p>
                                    )}
                                  </div>
                                  <span className="font-mono-technical text-[8px] border border-border-muted text-on-surface-variant px-1 shrink-0">
                                    {b.type.toUpperCase()}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {selectedBoard && (
                          <div className="space-y-sm">
                            <div className="flex items-center gap-sm">
                              <button
                                onClick={() => {
                                  setSelectedBoard(null);
                                  setBoardIssues([]);
                                }}
                                className="text-on-surface-variant hover:text-on-surface"
                              >
                                <Icon name="arrow_back" size={14} />
                              </button>
                              <p className="font-mono-technical text-[11px] text-on-surface">
                                {selectedBoard.name}
                              </p>
                              <span className="font-mono-technical text-[9px] text-on-surface-variant">
                                {selectedBoard.projectKey}
                              </span>
                            </div>
                            <div className="flex gap-xs">
                              <input
                                value={boardSearch}
                                onChange={(e) => setBoardSearch(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && void fetchBoardIssues()}
                                placeholder="Search epics by keyword…"
                                className="flex-1 bg-surface border border-border-muted px-md py-xs font-mono-technical text-[10px] outline-none focus:border-primary"
                              />
                              <button
                                onClick={() => void fetchBoardIssues()}
                                disabled={loadingIssues}
                                className="px-md py-xs bg-surface border border-border-muted text-on-surface-variant font-mono-technical text-[9px] hover:border-primary disabled:opacity-40"
                              >
                                {loadingIssues ? (
                                  <span className="w-3 h-3 border border-primary/40 border-t-primary rounded-full animate-spin inline-block" />
                                ) : (
                                  "SEARCH"
                                )}
                              </button>
                            </div>
                            <div className="max-h-[220px] overflow-y-auto space-y-xs custom-scrollbar">
                              {loadingIssues && (
                                <p className="font-mono-technical text-[9px] text-on-surface-variant p-sm">
                                  Loading issues…
                                </p>
                              )}
                              {!loadingIssues && boardIssues.length === 0 && (
                                <p className="font-mono-technical text-[9px] text-on-surface-variant p-sm">
                                  No Portfolio Epics found. Try a different search or use Enter Key
                                  mode.
                                </p>
                              )}
                              {boardIssues.map((issue) => (
                                <button
                                  key={issue.key}
                                  onClick={() => selectBoardIssue(issue)}
                                  className={`w-full text-left flex items-start gap-md p-sm border transition-colors ${epicData?.key === issue.key ? "border-primary bg-primary/10" : "border-border-muted hover:border-primary/50 hover:bg-primary/5"}`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-sm flex-wrap">
                                      <span className="font-mono-technical text-[10px] text-primary">
                                        {issue.key}
                                      </span>
                                      <span className="font-mono-technical text-[8px] border border-border-muted text-on-surface-variant px-1">
                                        {issue.issueType}
                                      </span>
                                      <span
                                        className={`font-mono-technical text-[8px] ${issue.status.toLowerCase() === "done" ? "text-primary" : "text-on-surface-variant"}`}
                                      >
                                        {issue.status}
                                      </span>
                                    </div>
                                    <p className="font-mono-technical text-[10px] text-on-surface truncate mt-xs">
                                      {issue.summary}
                                    </p>
                                    {issue.labels.length > 0 && (
                                      <div className="flex gap-xs mt-xs flex-wrap">
                                        {issue.labels.slice(0, 3).map((l) => (
                                          <span
                                            key={l}
                                            className="font-mono-technical text-[8px] text-on-surface-variant"
                                          >
                                            {l}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  {fetchingEpic && importKey === issue.key && (
                                    <span className="w-3 h-3 border border-primary/40 border-t-primary rounded-full animate-spin shrink-0 mt-1" />
                                  )}
                                  {epicData?.key === issue.key && (
                                    <Icon
                                      name="check_circle"
                                      size={14}
                                      className="text-primary shrink-0 mt-1"
                                    />
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {fetchError && (
                      <div className="bg-critical/5 border border-critical/30 p-sm">
                        <p className="font-mono-technical text-[10px] text-critical">
                          {fetchError}
                        </p>
                      </div>
                    )}

                    {/* Epic loaded card */}
                    {epicData && (
                      <div className="space-y-md">
                        <div className="bg-surface border border-border-muted p-md space-y-sm">
                          <div className="flex items-center gap-sm flex-wrap">
                            <span className="font-mono-technical text-[10px] text-primary">
                              {epicData.key}
                            </span>
                            <span className="px-1.5 py-0.5 font-mono-technical text-[8px] border border-border-muted text-on-surface-variant">
                              {epicData.issueType.toUpperCase()}
                            </span>
                            <span className="px-1.5 py-0.5 font-mono-technical text-[8px] border border-primary/30 text-primary/70">
                              {epicData.status.toUpperCase()}
                            </span>
                          </div>
                          <p className="font-body-bold text-body-bold text-on-surface text-[13px]">
                            {epicData.summary}
                          </p>
                          {epicData.description && (
                            <p className="font-mono-technical text-[10px] text-on-surface-variant leading-relaxed line-clamp-3">
                              {epicData.description}
                            </p>
                          )}
                          {epicData.labels.length > 0 && (
                            <div className="flex gap-xs flex-wrap">
                              {epicData.labels.map((l) => (
                                <span
                                  key={l}
                                  className="px-1.5 py-0.5 font-mono-technical text-[8px] border border-border-muted text-on-surface-variant"
                                >
                                  {l}
                                </span>
                              ))}
                            </div>
                          )}
                          {epicData.reporter && (
                            <p className="font-mono-technical text-[9px] text-on-surface-variant">
                              Reporter: {epicData.reporter}
                              {epicData.duedate
                                ? ` · Due: ${new Date(epicData.duedate).toLocaleDateString()}`
                                : ""}
                            </p>
                          )}
                        </div>

                        {analyzingAI && (
                          <div className="flex items-center gap-sm p-md border border-primary/20 bg-primary/5">
                            <span className="w-3 h-3 border border-primary/40 border-t-primary rounded-full animate-spin shrink-0" />
                            <p className="font-mono-technical text-[10px] text-primary">
                              AI governance analysis running…
                            </p>
                          </div>
                        )}

                        {aiSuggestion && !analyzingAI && (
                          <div className="border border-primary bg-primary/5 p-md space-y-sm">
                            <div className="flex items-center justify-between">
                              <p className="font-mono-technical text-[9px] text-primary tracking-widest">
                                AI GOVERNANCE RECOMMENDATION
                              </p>
                              <ConfidenceBadge confidence={aiSuggestion.confidence} />
                            </div>
                            <div className="grid grid-cols-3 gap-sm">
                              {[
                                {
                                  label: "TEMPLATE",
                                  value:
                                    apiTemplates.find(
                                      (t) => t.id === aiSuggestion.suggestedTemplate
                                    )?.name ?? aiSuggestion.suggestedTemplate,
                                },
                                {
                                  label: "FRAMEWORKS",
                                  value:
                                    aiSuggestion.suggestedFrameworks
                                      .map((f) => f.replace(/_/g, " "))
                                      .join(" · ") || "—",
                                },
                                {
                                  label: "AI MODE",
                                  value: aiSuggestion.suggestedAiMode.replace(/_/g, " "),
                                },
                              ].map((item) => (
                                <div
                                  key={item.label}
                                  className="bg-surface border border-border-muted p-sm"
                                >
                                  <p className="font-mono-technical text-[8px] text-on-surface-variant tracking-widest mb-xs">
                                    {item.label}
                                  </p>
                                  <p className="font-mono-technical text-[10px] text-on-surface">
                                    {item.value}
                                  </p>
                                </div>
                              ))}
                            </div>
                            {aiSuggestion.riskFactors.length > 0 && (
                              <div className="flex gap-xs flex-wrap">
                                {aiSuggestion.riskFactors.map((r) => (
                                  <span
                                    key={r}
                                    className="px-1.5 py-0.5 font-mono-technical text-[9px] border border-critical/30 text-critical/80 bg-critical/5"
                                  >
                                    {r}
                                  </span>
                                ))}
                              </div>
                            )}
                            <p className="font-mono-technical text-[10px] text-on-surface-variant leading-relaxed">
                              {aiSuggestion.rationale}
                            </p>
                            {aiApplied ? (
                              <div className="flex items-center gap-sm p-sm bg-primary/10 border border-primary/30">
                                <Icon name="check_circle" size={12} className="text-primary" />
                                <p className="font-mono-technical text-[10px] text-primary">
                                  AI recommendations applied — template, frameworks and AI mode
                                  pre-selected
                                </p>
                              </div>
                            ) : (
                              <button
                                onClick={applyAIRecommendations}
                                className="w-full py-sm bg-primary text-background font-mono-technical text-[10px] hover:bg-primary/90 flex items-center justify-center gap-sm"
                              >
                                <Icon name="auto_awesome" size={12} className="text-background" />
                                APPLY AI RECOMMENDATIONS
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {importMode === "manual" && (
              <div className="bg-surface-container-low border border-border-muted p-md">
                <p className="font-mono-technical text-[9px] text-on-surface-variant">
                  Fill in project identity, select a governance template, choose frameworks, and set
                  AI mode in the following steps. All fields editable after creation.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Step 1: Identity ─────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-lg">
            {epicData && (
              <div className="flex items-center gap-sm p-sm bg-primary/5 border border-primary/20">
                <Icon name="cloud_download" size={12} className="text-primary" />
                <p className="font-mono-technical text-[9px] text-primary">
                  Pre-filled from Jira epic {epicData.key} — review and adjust as needed.
                </p>
              </div>
            )}
            <div className="flex gap-sm">
              {(["project", "program"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex-1 py-sm font-mono-technical text-[10px] border transition-colors ${type === t ? "border-primary bg-primary/10 text-primary" : "border-border-muted text-on-surface-variant hover:border-primary/50"}`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
            <p className="font-mono-technical text-[9px] text-on-surface-variant/60">
              {type === "program"
                ? "A program groups multiple related projects under one governance posture."
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
                className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[11px] outline-none focus:border-primary"
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
                className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[11px] outline-none focus:border-primary"
              />
              <p className="font-mono-technical text-[9px] text-on-surface-variant/60 mt-xs">
                Uppercase, numbers, hyphens only.
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
                  className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[11px] outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest block mb-xs">
                  INDUSTRY DOMAIN
                </label>
                <select
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[11px] outline-none focus:border-primary"
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
                    className={`py-sm font-mono-technical text-[10px] border transition-colors ${classification === c ? (c === "restricted" ? "border-critical bg-critical/10 text-critical" : c === "confidential" ? "border-tertiary bg-tertiary/10 text-tertiary" : "border-primary bg-primary/10 text-primary") : "border-border-muted text-on-surface-variant hover:border-primary/50"}`}
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
                rows={3}
                placeholder="Brief description of the change initiative…"
                className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[11px] resize-none outline-none focus:border-primary"
              />
            </div>
          </div>
        )}

        {/* ── Step 2: Governance Template ───────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-lg">
            <div>
              <p className="font-mono-technical text-[11px] text-on-surface mb-xs">
                Select the governance template for this {type}.
              </p>
              <p className="font-mono-technical text-[9px] text-on-surface-variant">
                Templates define which gate categories apply at each stage. Platform intelligence
                then selects specific gates from the Gate Library based on change characteristics.
                Nothing is hardcoded.
              </p>
            </div>

            {loadingTemplates && (
              <div className="flex items-center gap-sm p-md border border-border-muted">
                <span className="w-3 h-3 border border-primary/40 border-t-primary rounded-full animate-spin shrink-0" />
                <p className="font-mono-technical text-[10px] text-on-surface-variant">
                  Loading templates…
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-sm">
              {apiTemplates.map((tpl) => {
                const isSelected = selectedTemplate === tpl.id;
                const isAIRecommended = aiSuggestion?.suggestedTemplate === tpl.id;
                const totalHints = tpl.stages.reduce((a, s) => a + (s.gateHints?.length ?? 0), 0);

                return (
                  <button
                    key={tpl.id}
                    onClick={() => handleTemplateSelect(tpl)}
                    className={`text-left p-md border transition-colors space-y-sm relative ${isSelected ? "border-primary bg-primary/10" : "border-border-muted hover:border-primary/50"}`}
                  >
                    {isAIRecommended && (
                      <span className="absolute top-sm right-sm px-1.5 py-0.5 font-mono-technical text-[8px] border border-primary text-primary bg-primary/10">
                        AI RECOMMENDED
                      </span>
                    )}
                    <div className="flex items-center gap-sm">
                      <Icon
                        name={tpl.icon ?? "category"}
                        size={18}
                        className={isSelected ? "text-primary" : "text-on-surface-variant"}
                      />
                      <p
                        className={`font-mono-technical text-[11px] ${isSelected ? "text-primary" : "text-on-surface"}`}
                      >
                        {tpl.name}
                      </p>
                    </div>
                    <p className="font-mono-technical text-[9px] text-on-surface-variant leading-snug">
                      {tpl.description}
                    </p>
                    <div className="flex items-center gap-sm">
                      {tpl.effort !== "CUSTOM" && (
                        <span
                          className={`px-1.5 py-0.5 font-mono-technical text-[8px] border ${tpl.effort === "HIGH" ? "border-critical/40 text-critical/80" : tpl.effort === "MEDIUM" ? "border-tertiary/40 text-tertiary/80" : "border-primary/40 text-primary/80"}`}
                        >
                          {tpl.effort} EFFORT
                        </span>
                      )}
                      {totalHints > 0 && (
                        <span className="font-mono-technical text-[8px] text-on-surface-variant">
                          ~{totalHints} gates
                        </span>
                      )}
                      {!tpl.isBuiltIn && (
                        <span className="font-mono-technical text-[8px] border border-tertiary/30 text-tertiary/70 px-1">
                          CUSTOM
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected template stage breakdown */}
            {activeTpl && activeTpl.stages.length > 0 && (
              <div className="border border-primary/20 p-md space-y-sm">
                <div className="flex items-center justify-between">
                  <p className="font-mono-technical text-[9px] text-primary tracking-widest">
                    {activeTpl.name.toUpperCase()} — STAGE BREAKDOWN
                  </p>
                  {composingPipeline && (
                    <div className="flex items-center gap-xs">
                      <span className="w-2.5 h-2.5 border border-primary/40 border-t-primary rounded-full animate-spin" />
                      <p className="font-mono-technical text-[9px] text-primary">
                        Composing gate pipeline…
                      </p>
                    </div>
                  )}
                </div>
                <div className="space-y-xs">
                  {activeTpl.stages.map((s) => (
                    <div key={s.stage} className="flex gap-md">
                      <span className="font-mono-technical text-[9px] text-on-surface-variant w-[100px] shrink-0 pt-px">
                        {s.stage.toUpperCase()}
                      </span>
                      <div className="flex gap-xs flex-wrap">
                        {s.gateCategories.map((cat) => (
                          <span
                            key={cat}
                            className={`px-1.5 py-0.5 font-mono-technical text-[8px] border ${CATEGORY_COLOR[cat] ?? "border-border-muted text-on-surface-variant"}`}
                          >
                            {cat}
                          </span>
                        ))}
                        {s.gateHints?.map((hint) => (
                          <span
                            key={hint}
                            className="font-mono-technical text-[9px] text-on-surface-variant"
                          >
                            {hint}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Composed gate preview */}
            {composedGates.length > 0 && (
              <div className="border border-border-muted p-md space-y-sm">
                <p className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest">
                  AI COMPOSED PIPELINE — {composedGates.length} GATES FROM GATE LIBRARY
                </p>
                <p className="font-mono-technical text-[9px] text-on-surface-variant">
                  {composedSummary}
                </p>
                <div className="space-y-xs">
                  {composedGates.map((g) => (
                    <div
                      key={g.slug}
                      className="flex items-center gap-md py-xs border-b border-border-muted last:border-0"
                    >
                      <span
                        className={`px-1.5 py-0.5 font-mono-technical text-[8px] border shrink-0 ${CATEGORY_COLOR[g.category] ?? "border-border-muted text-on-surface-variant"}`}
                      >
                        {g.category}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono-technical text-[10px] text-on-surface">{g.name}</p>
                        {g.reason && (
                          <p className="font-mono-technical text-[9px] text-on-surface-variant truncate">
                            {g.reason}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-xs shrink-0">
                        {g.suggestedExperts.slice(0, 2).map((e) => (
                          <span
                            key={e.id}
                            className="font-mono-technical text-[8px] text-primary border border-primary/30 px-1"
                          >
                            {e.name ?? e.email.split("@")[0]}
                          </span>
                        ))}
                        {g.suggestedExperts.length === 0 && (
                          <span className="font-mono-technical text-[8px] text-on-surface-variant border border-border-muted px-1">
                            NO EXPERT
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Frameworks ───────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-lg">
            <div>
              <p className="font-mono-technical text-[11px] text-on-surface mb-xs">
                Select regulatory frameworks that apply to this {type}.
              </p>
              <p className="font-mono-technical text-[9px] text-on-surface-variant">
                These inform gate selection, evidence requirements, and AI governance
                recommendations. Changeable later in Admin → Frameworks.
              </p>
            </div>
            {aiApplied && (
              <div className="flex items-center gap-sm p-sm bg-primary/5 border border-primary/20">
                <Icon name="auto_awesome" size={12} className="text-primary" />
                <p className="font-mono-technical text-[9px] text-primary">
                  AI pre-selected frameworks based on the imported epic.
                </p>
              </div>
            )}
            <div className="space-y-sm">
              {FRAMEWORK_OPTS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => toggleFramework(f.value)}
                  className={`w-full text-left px-lg py-md border transition-colors flex items-center justify-between ${frameworks.includes(f.value) ? "border-primary bg-primary/10" : "border-border-muted hover:border-primary/50"}`}
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
          </div>
        )}

        {/* ── Step 4: AI Mode ──────────────────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-lg">
            <div>
              <p className="font-mono-technical text-[11px] text-on-surface mb-xs">
                Set the initial AI governance mode for this {type}.
              </p>
              <p className="font-mono-technical text-[9px] text-on-surface-variant">
                Controls AI autonomy level. Changeable at any time from the AI Control Center.
              </p>
            </div>
            {aiApplied && aiSuggestion && (
              <div className="flex items-center gap-sm p-sm bg-primary/5 border border-primary/20">
                <Icon name="auto_awesome" size={12} className="text-primary" />
                <p className="font-mono-technical text-[9px] text-primary">
                  AI recommends <strong>{aiSuggestion.suggestedAiMode.replace(/_/g, " ")}</strong>{" "}
                  for this change type.
                </p>
              </div>
            )}
            <div className="space-y-sm">
              {AI_MODE_OPTS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setAiMode(m.value)}
                  className={`w-full text-left px-lg py-md border transition-colors flex items-center justify-between ${aiMode === m.value ? "border-primary bg-primary/10" : "border-border-muted hover:border-primary/50"}`}
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

        {/* ── Step 5: Review ───────────────────────────────────────────────── */}
        {step === 5 && (
          <div className="space-y-lg">
            <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">
              REVIEW CONFIGURATION
            </p>
            <div className="border border-border-muted">
              {[
                {
                  label: "SOURCE",
                  value: importMode === "jira" && epicData ? `Jira ${epicData.key}` : "Manual",
                },
                { label: "TYPE", value: type.toUpperCase() },
                { label: "NAME", value: name },
                { label: "KEY", value: key },
                { label: "OWNER", value: ownerEmail },
                { label: "DOMAIN", value: domain.toUpperCase() },
                { label: "CLASSIFICATION", value: classification.toUpperCase() },
                { label: "GOV. TEMPLATE", value: activeTpl?.name ?? "None" },
                {
                  label: "FRAMEWORKS",
                  value: frameworks.map((f) => f.replace(/_/g, " ")).join(", ") || "None",
                },
                { label: "AI MODE", value: aiMode.replace(/_/g, " ") },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center px-lg py-sm border-b border-border-muted last:border-0"
                >
                  <span className="font-mono-technical text-[9px] text-on-surface-variant w-[150px] shrink-0 tracking-widest">
                    {row.label}
                  </span>
                  <span className="font-mono-technical text-[11px] text-on-surface">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Composed gate pipeline */}
            {composedGates.length > 0 && (
              <div className="border border-border-muted p-md space-y-sm">
                <p className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest">
                  GOVERNANCE GATE PIPELINE — {composedGates.length} GATES
                </p>
                <p className="font-mono-technical text-[9px] text-on-surface-variant">
                  {composedSummary}
                </p>
                <div className="space-y-xs">
                  {composedGates.map((g, i) => (
                    <div
                      key={g.slug}
                      className="flex items-center gap-md py-xs border-b border-border-muted last:border-0"
                    >
                      <span className="font-mono-technical text-[9px] text-on-surface-variant w-4 shrink-0">
                        {i + 1}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 font-mono-technical text-[8px] border shrink-0 ${CATEGORY_COLOR[g.category] ?? "border-border-muted text-on-surface-variant"}`}
                      >
                        {g.category}
                      </span>
                      <p className="font-mono-technical text-[10px] text-on-surface flex-1">
                        {g.name}
                      </p>
                      <div className="flex gap-xs">
                        {g.suggestedExperts.slice(0, 2).map((e) => (
                          <span
                            key={e.id}
                            className="font-mono-technical text-[8px] text-primary border border-primary/30 px-1"
                          >
                            {e.name ?? e.email.split("@")[0]}
                          </span>
                        ))}
                        {g.approverRoles.slice(0, 2).map((r) => (
                          <span
                            key={r}
                            className="font-mono-technical text-[8px] text-on-surface-variant border border-border-muted px-1"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {epicData && (
              <div className="bg-primary/5 border border-primary/30 p-md">
                <p className="font-mono-technical text-[9px] text-primary tracking-widest mb-xs">
                  GOVERNANCE WILL BE AUTOMATICALLY ACTIVATED
                </p>
                <p className="font-mono-technical text-[9px] text-on-surface-variant leading-relaxed">
                  Because this project was imported from Jira ({epicData.key}), a governance case
                  will be automatically opened and{" "}
                  {composedGates.length > 0
                    ? `${composedGates.length} gate${composedGates.length !== 1 ? "s" : ""} will be created`
                    : "gates will be created from the template"}{" "}
                  with expert assignments from platform intelligence.
                </p>
              </div>
            )}

            {submitError && (
              <p className="font-mono-technical text-[10px] text-critical">{submitError}</p>
            )}
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
            className="px-xl py-sm bg-primary text-background font-mono-technical text-[10px] hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            NEXT →
          </button>
        ) : (
          <button
            onClick={() => void create()}
            disabled={saving}
            className="flex items-center gap-sm px-xl py-sm bg-primary text-background font-mono-technical text-[10px] hover:bg-primary/90 disabled:opacity-40"
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

// ─── ProjectCard ─────────────────────────────────────────────────────────────

function ProjectCard({ project }: { project: ProjectSummary }) {
  const cfg = READINESS_CFG[project.readiness];
  const setupComplete = project.triggerRules > 0 && project.connectors.length > 0;

  return (
    <div
      className={`bg-surface border transition-colors ${project.readiness === "NO_GO" ? "border-critical/40" : "border-border-muted"} hover:border-primary/40 p-lg space-y-md`}
    >
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
        <div
          className={`px-2 py-1 font-mono-technical text-[10px] border flex items-center gap-xs shrink-0 ${cfg.cls}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </div>
      </div>

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

      {!setupComplete && (
        <div className="bg-tertiary/5 border border-tertiary/30 p-sm">
          <p className="font-mono-technical text-[9px] text-tertiary">
            {project.connectors.length === 0 && project.triggerRules === 0
              ? "No connectors or trigger rules — governance cannot be triggered automatically."
              : project.connectors.length === 0
                ? "No connectors — link Jira/GitHub/GitLab in Admin → Connectors."
                : "No trigger rules — define which events activate governance in Admin → Trigger Rules."}
          </p>
        </div>
      )}

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
          href={`/admin/projects/${project.id}`}
          className="flex-1 text-center py-xs font-mono-technical text-[10px] border border-border-muted text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
        >
          SYNC
        </a>
        <a
          href={`/release-readiness?project=${project.key}`}
          className={`flex-1 text-center py-xs font-mono-technical text-[10px] border transition-colors ${project.readiness === "NO_GO" ? "border-critical text-critical hover:bg-critical/10" : project.readiness === "GO" ? "border-primary text-primary hover:bg-primary/10" : "border-border-muted text-on-surface-variant hover:border-primary hover:text-primary"}`}
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

// ─── GovernanceGuide ─────────────────────────────────────────────────────────

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
              title: "Create or import the project",
              detail:
                "Admin creates manually or imports a Jira Portfolio Epic. The platform initialises AI Control, applies a governance template, composes a gate pipeline from the Gate Library, and assigns experts from Expert Profiles — all automatically.",
            },
            {
              n: "2",
              title: "Link tool connectors",
              detail:
                "Register Jira, GitHub, or GitLab instances in Admin → Connectors. Each gets a webhook URL. Future events from these tools flow into the governance engine automatically.",
            },
            {
              n: "3",
              title: "Define trigger rules per project",
              detail:
                "Configure which events activate governance (Portfolio Epics, PRs to main, labelled MRs). Non-matching events are silently logged as SKIP.",
            },
            {
              n: "4",
              title: "Platform intelligence composes the gate pipeline",
              detail:
                "Each triggered event runs: context enrichment → 11-dimension risk scoring → intensity classification → gate selection from the Gate Library → expert routing. Platform intelligence determines the right sign-offs for each change type.",
            },
            {
              n: "5",
              title: "Work through the gate pipeline",
              detail:
                "Sign-offs include: Data Architecture review, UI/UX review, Architect team sign-off, Product Owner functional approval, Security review, CISO sign-off, CAB approval — determined dynamically by the platform based on what changed.",
            },
            {
              n: "6",
              title: "Request waivers for blocked gates",
              detail:
                "If a gate cannot be cleared in time, request a waiver. AI generates residual risk + compensating controls. Waiver requires approver sign-off and is logged immutably.",
            },
            {
              n: "7",
              title: "GO — Release Readiness sign-off",
              detail:
                "GO = zero rejected gates, zero required-pending gates. Approvers digitally sign off. Audit export generated for regulators.",
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

// ─── Main export ─────────────────────────────────────────────────────────────

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
              className={`px-md py-xs font-mono-technical text-[10px] border transition-colors ${filterStatus === v ? "border-primary bg-primary/10 text-primary" : "border-border-muted text-on-surface-variant hover:border-primary/50"}`}
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
