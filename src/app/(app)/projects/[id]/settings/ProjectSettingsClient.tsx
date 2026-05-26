"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Board = {
  id: string;
  boardId: string;
  boardName: string;
  boardType: string;
  enabled: boolean;
  labelTag: string;
  riskOverride: string;
  connector: { id: string; type: string; name: string; baseUrl: string };
};

type RagSource = {
  id: string;
  type: string;
  name: string;
  config: Record<string, string>;
  enabled: boolean;
  lastIndexedAt: string | null;
};

type Connector = { id: string; type: string; name: string; baseUrl: string };
type Program = { id: string; name: string };

type ProjectInfo = {
  id: string;
  key: string;
  name: string;
  description: string;
  ownerEmail: string;
  status: string;
  governanceProfile: string;
  programId: string | null;
  programName: string | null;
};

interface Props {
  project: ProjectInfo;
  boards: Board[];
  ragSources: RagSource[];
  connectors: Connector[];
  programs: Program[];
}

function Icon({ name, size = 16, fill = false, className = "" }: { name: string; size?: number; fill?: boolean; className?: string }) {
  return (
    <span
      className={`material-symbols-outlined select-none leading-none ${className}`}
      style={{ fontSize: size, fontVariationSettings: fill ? "'FILL' 1" : "'FILL' 0" }}
    >
      {name}
    </span>
  );
}

const PROFILES = [
  {
    id: "agile",
    label: "Agile Governance",
    badge: "DEFAULT",
    badgeCls: "text-primary border-primary",
    desc: "Lightweight monitoring. Auto risk detection, summaries, and evidence linking. Minimal overhead.",
    icon: "rocket_launch",
    gates: ["Risk Assessment", "Evidence Check", "Release Sign-off"],
    aiMode: "AI_ASSIST",
  },
  {
    id: "regulated",
    label: "Regulated Delivery",
    badge: "REGULATED",
    badgeCls: "text-tertiary border-tertiary",
    desc: "Mandatory evidence gates and regulatory review checkpoints for financial services.",
    icon: "account_balance",
    gates: ["Risk Assessment", "Regulatory Evidence", "Legal Review", "Senior Approver Sign-off", "Release Readiness"],
    aiMode: "AI_REVIEW",
  },
  {
    id: "ai_sensitive",
    label: "AI-Sensitive Delivery",
    badge: "AI ACT",
    badgeCls: "text-tertiary border-tertiary",
    desc: "Full AI usage logging, model governance gates, and EU AI Act compliance controls.",
    icon: "psychology",
    gates: ["AI Risk Assessment", "Model Card Review", "Bias & Fairness Check", "AI Act Compliance Gate", "Human Oversight Sign-off"],
    aiMode: "AI_REVIEW",
  },
  {
    id: "critical",
    label: "Critical Production Change",
    badge: "HIGH RISK",
    badgeCls: "text-critical border-critical",
    desc: "Multi-approver sign-off, mandatory rollback plan, and release readiness verification.",
    icon: "warning",
    gates: ["Risk Assessment", "Architecture Review", "Security Review", "Rollback Plan", "Multi-approver Sign-off", "Release Readiness", "Post-deploy Monitoring"],
    aiMode: "AI_REVIEW",
  },
  {
    id: "third_party",
    label: "Third-Party Risk",
    badge: "DORA",
    badgeCls: "text-tertiary border-tertiary",
    desc: "DORA Article 28 register, ICT vendor oversight, and supply chain evidence requirements.",
    icon: "link",
    gates: ["Vendor Risk Assessment", "DORA Article 28 Register", "Contract Evidence", "Exit Plan Review", "Concentration Risk Check"],
    aiMode: "AI_REVIEW",
  },
  {
    id: "custom",
    label: "Custom Profile",
    badge: "CUSTOM",
    badgeCls: "text-on-surface-variant border-border-muted",
    desc: "Configure your own gates, evidence requirements, and monitoring rules from scratch.",
    icon: "tune",
    gates: ["Custom gate 1", "Custom gate 2"],
    aiMode: "AI_ASSIST",
  },
];

const SOURCE_ICON: Record<string, string> = { github: "GH", gitlab: "GL", jira: "JI" };
const SOURCE_COLOR: Record<string, string> = {
  github: "text-on-surface border-border-muted",
  gitlab: "text-tertiary border-tertiary/40",
  jira: "text-primary border-primary/40",
};

const RAG_TYPE_META: Record<string, { icon: string; label: string; placeholder: string; configKey: string; hint: string }> = {
  "confluence": { icon: "description", label: "Confluence Space", placeholder: "REGPOL", configKey: "spaceKey", hint: "Confluence space key, e.g. REGPOL, COMPLDOCS" },
  "github-path": { icon: "code", label: "GitHub Path", placeholder: "docs/regulatory", configKey: "repoPath", hint: "Path inside the linked GitHub repo, e.g. docs/policy/" },
  "gitlab-path": { icon: "merge", label: "GitLab Path", placeholder: "compliance/policies", configKey: "repoPath", hint: "Path inside the linked GitLab project, e.g. compliance/" },
  "url": { icon: "link", label: "External URL", placeholder: "https://policy.example.com/dora.pdf", configKey: "url", hint: "Direct link to a policy document (PDF, web page)" },
  "policy-corpus": { icon: "inventory_2", label: "Policy Corpus", placeholder: "internal-dora-pack", configKey: "corpusId", hint: "NexoriOS policy corpus ID from Admin → Policy & Frameworks" },
};

const tabs = ["sources", "rag", "profile", "general", "danger"] as const;
type Tab = typeof tabs[number];

const TAB_LABELS: Record<Tab, string> = {
  sources: "Delivery Sources",
  rag: "AI Knowledge Sources",
  profile: "Governance Profile",
  general: "General",
  danger: "Danger Zone",
};

export default function ProjectSettingsClient({ project, boards: initialBoards, ragSources: initialRag, connectors, programs }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("sources");
  const [boards, setBoards] = useState<Board[]>(initialBoards);
  const [ragSources, setRagSources] = useState<RagSource[]>(initialRag);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // General tab form
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [ownerEmail, setOwnerEmail] = useState(project.ownerEmail);
  const [programId, setProgramId] = useState(project.programId ?? "");
  const [profile, setProfile] = useState(project.governanceProfile);

  // Add source state
  const [addingSource, setAddingSource] = useState(false);
  const [newSourceConnector, setNewSourceConnector] = useState<Connector | null>(null);
  const [sourceItems, setSourceItems] = useState<Array<{ id: string; label: string }>>([]);
  const [sourceItemsLoading, setSourceItemsLoading] = useState(false);
  const [sourceItemsError, setSourceItemsError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState("");
  const [newLabelTag, setNewLabelTag] = useState("");
  const [newRiskOverride, setNewRiskOverride] = useState("");
  const lastFetchKey = useRef("");

  // Add RAG source state
  const [addingRag, setAddingRag] = useState(false);
  const [ragType, setRagType] = useState("confluence");
  const [ragName, setRagName] = useState("");
  const [ragConfigVal, setRagConfigVal] = useState("");
  const [ragConnectorId, setRagConnectorId] = useState("");
  const [savingRag, setSavingRag] = useState(false);

  // Archive / delete
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // Board edit inline
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [boardEditLabel, setBoardEditLabel] = useState("");
  const [boardEditRisk, setBoardEditRisk] = useState("");

  useEffect(() => {
    if (!newSourceConnector) return;
    const key = newSourceConnector.id;
    if (lastFetchKey.current === key) return;
    lastFetchKey.current = key;
    setSourceItems([]);
    setSourceItemsError(null);
    setSourceItemsLoading(true);

    const url =
      newSourceConnector.type === "github"
        ? `/api/integrations/github/repos?connectorId=${newSourceConnector.id}`
        : newSourceConnector.type === "gitlab"
          ? `/api/integrations/gitlab/projects?connectorId=${newSourceConnector.id}`
          : `/api/integrations/jira/boards?connectorId=${newSourceConnector.id}`;

    fetch(url)
      .then(async (r) => {
        const body = await r.json().catch(() => ({})) as Record<string, unknown>;
        if (!r.ok) throw new Error((body.error as string | undefined) ?? `${newSourceConnector.type} error ${r.status}`);
        return body;
      })
      .then((data) => {
        let items: Array<{ id: string; label: string }> = [];
        if (newSourceConnector.type === "github" && Array.isArray(data.repos)) {
          items = (data.repos as Array<{ fullName: string }>).map((r) => ({ id: r.fullName, label: r.fullName }));
        } else if (newSourceConnector.type === "gitlab" && Array.isArray(data.projects)) {
          items = (data.projects as Array<{ pathWithNamespace: string; name: string }>).map((p) => ({
            id: p.pathWithNamespace,
            label: `${p.name} (${p.pathWithNamespace})`,
          }));
        } else if (newSourceConnector.type === "jira" && Array.isArray(data.boards)) {
          items = (data.boards as Array<{ id: number | string; name: string }>).map((b) => ({ id: String(b.id), label: b.name }));
        }
        setSourceItems(items);
        if (items.length > 0) setSelectedItem(items[0].id);
        else setSourceItemsError(`No ${newSourceConnector.type} items found. Check connector token scopes.`);
      })
      .catch((err: unknown) => setSourceItemsError(err instanceof Error ? err.message : "Could not load items"))
      .finally(() => setSourceItemsLoading(false));
  }, [newSourceConnector]);

  async function addBoard() {
    if (!newSourceConnector || !selectedItem) return;
    const item = sourceItems.find((i) => i.id === selectedItem);
    const res = await fetch(`/api/admin/projects/${project.id}/boards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        connectorId: newSourceConnector.id,
        boardId: selectedItem,
        boardName: item?.label ?? selectedItem,
        boardType: newSourceConnector.type === "jira" ? "scrum" : "repo",
        labelTag: newLabelTag || undefined,
        riskOverride: newRiskOverride || undefined,
      }),
    });
    if (res.ok) {
      const created = await res.json() as Board;
      setBoards((prev) => [...prev, created]);
      setAddingSource(false);
      setNewSourceConnector(null);
      setSourceItems([]);
      setNewLabelTag("");
      setNewRiskOverride("");
      lastFetchKey.current = "";
    }
  }

  async function removeBoard(boardId: string) {
    await fetch(`/api/admin/projects/${project.id}/boards`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boardId }),
    });
    setBoards((prev) => prev.filter((b) => b.id !== boardId));
  }

  async function saveBoardEdit(boardId: string) {
    const res = await fetch(`/api/admin/projects/${project.id}/boards`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boardId, labelTag: boardEditLabel, riskOverride: boardEditRisk || null }),
    });
    if (res.ok) {
      const updated = await res.json() as Board;
      setBoards((prev) => prev.map((b) => b.id === updated.id ? { ...updated, labelTag: updated.labelTag ?? "", riskOverride: updated.riskOverride ?? "" } : b));
      setEditingBoardId(null);
    }
  }

  async function addRagSource() {
    const meta = RAG_TYPE_META[ragType];
    if (!ragName || !ragConfigVal) return;
    setSavingRag(true);
    const config: Record<string, string> = { [meta.configKey]: ragConfigVal };
    if (ragConnectorId) config.connectorId = ragConnectorId;
    const res = await fetch(`/api/projects/${project.id}/rag-sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: ragType, name: ragName, config, enabled: true }),
    });
    if (res.ok) {
      const created = await res.json() as RagSource;
      setRagSources((prev) => [...prev, created]);
      setAddingRag(false);
      setRagName("");
      setRagConfigVal("");
      setRagConnectorId("");
    }
    setSavingRag(false);
  }

  async function removeRagSource(sourceId: string) {
    await fetch(`/api/projects/${project.id}/rag-sources/${sourceId}`, { method: "DELETE" });
    setRagSources((prev) => prev.filter((s) => s.id !== sourceId));
  }

  async function toggleRagSource(sourceId: string, enabled: boolean) {
    await fetch(`/api/projects/${project.id}/rag-sources/${sourceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    });
    setRagSources((prev) => prev.map((s) => s.id === sourceId ? { ...s, enabled: !enabled } : s));
  }

  async function saveGeneral() {
    setSaving(true);
    setSaveMsg(null);
    const res = await fetch(`/api/admin/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, ownerEmail, programId: programId || null }),
    });
    setSaving(false);
    setSaveMsg(res.ok ? "Saved" : "Failed to save");
    setTimeout(() => setSaveMsg(null), 2000);
    if (res.ok) router.refresh();
  }

  async function saveProfile() {
    setSaving(true);
    setSaveMsg(null);
    const res = await fetch(`/api/admin/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ governanceProfile: profile }),
    });
    setSaving(false);
    setSaveMsg(res.ok ? "Profile updated" : "Failed");
    setTimeout(() => setSaveMsg(null), 2000);
    if (res.ok) router.refresh();
  }

  async function archiveProject() {
    setArchiving(true);
    const res = await fetch(`/api/admin/projects/${project.id}`, { method: "DELETE" });
    setArchiving(false);
    if (res.ok) {
      router.push("/projects");
      router.refresh();
    }
  }

  const selectedProfile = PROFILES.find((p) => p.id === profile) ?? PROFILES[0];

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      {/* Tab bar */}
      <div className="flex border-b border-border-muted px-xl bg-surface shrink-0">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-lg py-md font-mono-technical text-[10px] tracking-widest border-b-2 transition-colors ${
              tab === t
                ? "border-primary text-primary"
                : t === "danger"
                  ? "border-transparent text-critical/50 hover:text-critical"
                  : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {TAB_LABELS[t].toUpperCase()}
          </button>
        ))}
        {saveMsg && (
          <span className="ml-auto self-center font-mono-technical text-[10px] text-primary">{saveMsg}</span>
        )}
      </div>

      <div className="max-w-[900px] mx-auto p-xl space-y-xl">

        {/* ── SOURCES TAB ── */}
        {tab === "sources" && (
          <section className="space-y-lg">
            <div>
              <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest mb-xs">DELIVERY SOURCES</p>
              <p className="font-body-base text-[12px] text-on-surface-variant">
                Connect Jira boards, GitHub repos, and GitLab projects. A single project can have multiple boards across different tools.
                Use <strong>Label Tags</strong> to auto-tag governance items by their source (e.g. &quot;payments&quot;, &quot;core-banking&quot;).
              </p>
            </div>

            {/* Current boards */}
            <div className="bg-surface border border-border-muted divide-y divide-border-muted">
              {boards.length === 0 && (
                <div className="p-lg text-center">
                  <p className="font-mono-technical text-[11px] text-on-surface-variant">No delivery sources linked.</p>
                </div>
              )}
              {boards.map((b) => (
                <div key={b.id} className="px-lg py-md">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-md">
                      <div className={`w-8 h-8 border flex items-center justify-center font-mono-technical text-[10px] shrink-0 ${SOURCE_COLOR[b.connector.type] ?? ""}`}>
                        {SOURCE_ICON[b.connector.type] ?? b.connector.type.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-body-bold text-[13px] text-on-surface">{b.boardName}</p>
                        <p className="font-mono-technical text-[9px] text-on-surface-variant">{b.connector.name} · {b.boardType}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-sm">
                      {b.labelTag && (
                        <span className="font-mono-technical text-[9px] border border-primary/40 text-primary px-1.5 py-0.5">
                          #{b.labelTag}
                        </span>
                      )}
                      {b.riskOverride && (
                        <span className={`font-mono-technical text-[9px] border px-1.5 py-0.5 ${b.riskOverride === "high" ? "text-critical border-critical" : "text-tertiary border-tertiary"}`}>
                          {b.riskOverride.toUpperCase()} RISK
                        </span>
                      )}
                      <button
                        onClick={() => { setEditingBoardId(b.id === editingBoardId ? null : b.id); setBoardEditLabel(b.labelTag); setBoardEditRisk(b.riskOverride); }}
                        className="font-mono-technical text-[9px] text-on-surface-variant hover:text-primary transition-colors"
                      >
                        EDIT
                      </button>
                      <button
                        onClick={() => removeBoard(b.id)}
                        className="font-mono-technical text-[9px] text-on-surface-variant hover:text-critical transition-colors"
                      >
                        REMOVE
                      </button>
                    </div>
                  </div>

                  {/* Inline edit panel */}
                  {editingBoardId === b.id && (
                    <div className="mt-md pt-md border-t border-border-muted grid grid-cols-2 gap-md">
                      <div>
                        <label className="font-mono-technical text-[9px] text-on-surface-variant block mb-xs">
                          LABEL TAG
                          <span className="ml-1 opacity-60">— auto-tags all items from this board</span>
                        </label>
                        <input
                          value={boardEditLabel}
                          onChange={(e) => setBoardEditLabel(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                          placeholder="e.g. payments, core-banking, ai-engine"
                          className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[11px] text-on-surface outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="font-mono-technical text-[9px] text-on-surface-variant block mb-xs">
                          RISK OVERRIDE
                          <span className="ml-1 opacity-60">— forces risk level for all items</span>
                        </label>
                        <select
                          value={boardEditRisk}
                          onChange={(e) => setBoardEditRisk(e.target.value)}
                          className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[11px] text-on-surface outline-none focus:border-primary"
                        >
                          <option value="">— no override, AI scores normally —</option>
                          <option value="high">HIGH — all items from this board are high risk</option>
                          <option value="medium">MEDIUM — floor all items at medium risk</option>
                        </select>
                      </div>
                      <div className="col-span-2 flex gap-sm">
                        <button onClick={() => saveBoardEdit(b.id)} className="px-md py-xs border border-primary text-primary font-mono-technical text-[10px] hover:bg-primary/10 transition-colors">
                          SAVE
                        </button>
                        <button onClick={() => setEditingBoardId(null)} className="px-md py-xs border border-border-muted text-on-surface-variant font-mono-technical text-[10px] transition-colors">
                          CANCEL
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add source panel */}
            {addingSource ? (
              <div className="bg-surface border border-primary/30 p-lg space-y-lg">
                <p className="font-mono-technical text-[10px] text-primary tracking-widest">ADD DELIVERY SOURCE</p>

                <div>
                  <label className="font-mono-technical text-[9px] text-on-surface-variant block mb-sm">SELECT CONNECTOR</label>
                  <div className="grid grid-cols-2 gap-sm">
                    {connectors.filter((c) => ["jira", "github", "gitlab"].includes(c.type)).map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          lastFetchKey.current = "";
                          setSourceItems([]);
                          setSourceItemsError(null);
                          setNewSourceConnector(c);
                          setSelectedItem("");
                        }}
                        className={`flex items-center gap-md p-md border text-left transition-colors ${
                          newSourceConnector?.id === c.id
                            ? "border-primary bg-primary/5"
                            : "border-border-muted hover:border-primary/50"
                        }`}
                      >
                        <span className={`w-7 h-7 border flex items-center justify-center font-mono-technical text-[9px] shrink-0 ${SOURCE_COLOR[c.type] ?? ""}`}>
                          {SOURCE_ICON[c.type] ?? c.type.slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <p className="font-mono-technical text-[10px] text-on-surface">{c.name}</p>
                          <p className="font-mono-technical text-[9px] text-on-surface-variant">{c.type.toUpperCase()}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {newSourceConnector && (
                  <>
                    <div>
                      <label className="font-mono-technical text-[9px] text-on-surface-variant block mb-sm">
                        SELECT {newSourceConnector.type === "jira" ? "BOARD" : "REPOSITORY"}
                        {sourceItemsLoading && <span className="ml-2 opacity-60 animate-pulse">LOADING...</span>}
                      </label>
                      {sourceItemsError ? (
                        <div className="space-y-xs">
                          <div className="flex items-start gap-sm border border-critical/40 bg-critical/5 px-md py-sm">
                            <Icon name="error" size={13} fill className="text-critical shrink-0 mt-0.5" />
                            <p className="font-mono-technical text-[10px] text-critical">{sourceItemsError}</p>
                          </div>
                          <a href="/admin/connectors" className="inline-flex items-center gap-xs font-mono-technical text-[10px] text-primary hover:underline">
                            <Icon name="settings" size={12} /> Fix in Admin → Connectors →
                          </a>
                        </div>
                      ) : sourceItems.length > 0 ? (
                        <select
                          value={selectedItem}
                          onChange={(e) => setSelectedItem(e.target.value)}
                          className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[12px] text-on-surface outline-none focus:border-primary"
                        >
                          {sourceItems.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
                        </select>
                      ) : !sourceItemsLoading && (
                        <p className="font-mono-technical text-[10px] text-on-surface-variant">No items found for this connector.</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-md">
                      <div>
                        <label className="font-mono-technical text-[9px] text-on-surface-variant block mb-sm">
                          LABEL TAG <span className="opacity-60">(optional — e.g. payments)</span>
                        </label>
                        <input
                          value={newLabelTag}
                          onChange={(e) => setNewLabelTag(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                          placeholder="e.g. payments, core-banking"
                          className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[11px] text-on-surface outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="font-mono-technical text-[9px] text-on-surface-variant block mb-sm">
                          RISK OVERRIDE <span className="opacity-60">(optional)</span>
                        </label>
                        <select
                          value={newRiskOverride}
                          onChange={(e) => setNewRiskOverride(e.target.value)}
                          className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[11px] text-on-surface outline-none focus:border-primary"
                        >
                          <option value="">— AI scores normally —</option>
                          <option value="high">HIGH — force high risk on all items</option>
                          <option value="medium">MEDIUM — floor at medium risk</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}

                <div className="flex gap-sm">
                  <button
                    onClick={addBoard}
                    disabled={!newSourceConnector || !selectedItem}
                    className="px-lg py-sm border border-primary text-primary font-mono-technical text-[10px] hover:bg-primary/10 transition-colors disabled:opacity-40"
                  >
                    ADD SOURCE
                  </button>
                  <button
                    onClick={() => { setAddingSource(false); setNewSourceConnector(null); setSourceItems([]); setSourceItemsError(null); lastFetchKey.current = ""; }}
                    className="px-lg py-sm border border-border-muted text-on-surface-variant font-mono-technical text-[10px] transition-colors"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingSource(true)}
                className="flex items-center gap-sm px-lg py-sm border border-dashed border-primary/40 text-primary font-mono-technical text-[10px] hover:border-primary hover:bg-primary/5 transition-colors w-full justify-center"
              >
                <Icon name="add" size={14} /> ADD DELIVERY SOURCE
              </button>
            )}

            <div className="bg-surface-container-low border border-border-muted px-lg py-md">
              <p className="font-mono-technical text-[10px] text-on-surface-variant">
                <strong>Label Tags</strong> — when set on a board, all governance items from that board are automatically tagged (e.g. &quot;payments&quot;).
                Use this to filter items, scope monitoring rules, and build board-specific reports.
                <br />
                <strong>Risk Override</strong> — forces a minimum risk level for all items from a board. Useful for production-hotfix or critical-path boards.
              </p>
            </div>
          </section>
        )}

        {/* ── RAG SOURCES TAB ── */}
        {tab === "rag" && (
          <section className="space-y-lg">
            <div>
              <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest mb-xs">AI KNOWLEDGE SOURCES</p>
              <p className="font-body-base text-[12px] text-on-surface-variant">
                Configure which documents, spaces, and repositories power the AI intelligence for this project.
                When Assurance Intelligence answers questions or generates summaries, it searches these sources first.
              </p>
            </div>

            <div className="bg-surface border border-border-muted divide-y divide-border-muted">
              {ragSources.length === 0 && (
                <div className="p-lg text-center">
                  <p className="font-mono-technical text-[11px] text-on-surface-variant">
                    No AI knowledge sources configured. Add a Confluence space, GitHub path, or policy URL to ground AI responses.
                  </p>
                </div>
              )}
              {ragSources.map((s) => {
                const meta = RAG_TYPE_META[s.type];
                return (
                  <div key={s.id} className="px-lg py-md flex items-center justify-between">
                    <div className="flex items-center gap-md">
                      <Icon name={meta?.icon ?? "description"} size={16} className={s.enabled ? "text-primary" : "text-on-surface-variant"} />
                      <div>
                        <p className="font-body-bold text-[12px] text-on-surface">{s.name}</p>
                        <p className="font-mono-technical text-[9px] text-on-surface-variant">
                          {meta?.label ?? s.type} · {Object.values(s.config).join(", ")}
                        </p>
                        {s.lastIndexedAt && (
                          <p className="font-mono-technical text-[9px] text-on-surface-variant">
                            Last indexed {new Date(s.lastIndexedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-sm">
                      <button
                        onClick={() => toggleRagSource(s.id, s.enabled)}
                        className={`font-mono-technical text-[9px] border px-1.5 py-0.5 transition-colors ${s.enabled ? "text-primary border-primary hover:bg-primary/10" : "text-on-surface-variant border-border-muted hover:border-primary hover:text-primary"}`}
                      >
                        {s.enabled ? "ACTIVE" : "DISABLED"}
                      </button>
                      <button onClick={() => removeRagSource(s.id)} className="font-mono-technical text-[9px] text-on-surface-variant hover:text-critical transition-colors">
                        REMOVE
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {addingRag ? (
              <div className="bg-surface border border-primary/30 p-lg space-y-lg">
                <p className="font-mono-technical text-[10px] text-primary tracking-widest">ADD AI KNOWLEDGE SOURCE</p>

                <div className="grid grid-cols-3 gap-sm">
                  {Object.entries(RAG_TYPE_META).map(([type, meta]) => (
                    <button
                      key={type}
                      onClick={() => { setRagType(type); setRagConfigVal(""); }}
                      className={`flex flex-col items-center gap-xs p-md border text-center transition-colors ${ragType === type ? "border-primary bg-primary/5" : "border-border-muted hover:border-primary/50"}`}
                    >
                      <Icon name={meta.icon} size={16} className={ragType === type ? "text-primary" : "text-on-surface-variant"} />
                      <p className="font-mono-technical text-[10px] text-on-surface">{meta.label}</p>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-md">
                  <div>
                    <label className="font-mono-technical text-[9px] text-on-surface-variant block mb-sm">SOURCE NAME *</label>
                    <input
                      value={ragName}
                      onChange={(e) => setRagName(e.target.value)}
                      placeholder="e.g. DORA Policy Space, Regulatory GitHub Docs"
                      className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[11px] text-on-surface outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="font-mono-technical text-[9px] text-on-surface-variant block mb-sm">
                      {RAG_TYPE_META[ragType]?.label.toUpperCase()} *
                    </label>
                    <input
                      value={ragConfigVal}
                      onChange={(e) => setRagConfigVal(e.target.value)}
                      placeholder={RAG_TYPE_META[ragType]?.placeholder}
                      className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[11px] text-on-surface outline-none focus:border-primary"
                    />
                    <p className="font-mono-technical text-[9px] text-on-surface-variant mt-xs">{RAG_TYPE_META[ragType]?.hint}</p>
                  </div>
                  {(ragType === "github-path" || ragType === "gitlab-path" || ragType === "confluence") && (
                    <div className="col-span-2">
                      <label className="font-mono-technical text-[9px] text-on-surface-variant block mb-sm">CONNECTOR (optional — uses linked connector)</label>
                      <select
                        value={ragConnectorId}
                        onChange={(e) => setRagConnectorId(e.target.value)}
                        className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[11px] text-on-surface outline-none focus:border-primary"
                      >
                        <option value="">— auto-detect from project sources —</option>
                        {connectors
                          .filter((c) => ragType === "confluence" ? c.type === "jira" : ragType.startsWith("github") ? c.type === "github" : c.type === "gitlab")
                          .map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex gap-sm">
                  <button
                    onClick={addRagSource}
                    disabled={savingRag || !ragName || !ragConfigVal}
                    className="px-lg py-sm border border-primary text-primary font-mono-technical text-[10px] hover:bg-primary/10 transition-colors disabled:opacity-40"
                  >
                    {savingRag ? "SAVING..." : "ADD SOURCE"}
                  </button>
                  <button onClick={() => setAddingRag(false)} className="px-lg py-sm border border-border-muted text-on-surface-variant font-mono-technical text-[10px]">
                    CANCEL
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingRag(true)}
                className="flex items-center gap-sm px-lg py-sm border border-dashed border-primary/40 text-primary font-mono-technical text-[10px] hover:border-primary hover:bg-primary/5 transition-colors w-full justify-center"
              >
                <Icon name="add" size={14} /> ADD AI KNOWLEDGE SOURCE
              </button>
            )}
          </section>
        )}

        {/* ── GOVERNANCE PROFILE TAB ── */}
        {tab === "profile" && (
          <section className="space-y-lg">
            <div>
              <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest mb-xs">GOVERNANCE PROFILE</p>
              <p className="font-body-base text-[12px] text-on-surface-variant">
                The governance profile determines which readiness checks are created for each assurance item.
                Changing the profile applies to new items — existing items keep their current gate pipeline.
              </p>
            </div>

            <div className="space-y-sm">
              {PROFILES.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setProfile(p.id)}
                  className={`border p-lg cursor-pointer transition-colors ${profile === p.id ? "border-primary bg-primary/5" : "border-border-muted hover:border-primary/30"}`}
                >
                  <div className="flex items-start justify-between mb-md">
                    <div className="flex items-center gap-md">
                      <Icon name={p.icon} size={18} fill={profile === p.id} className={profile === p.id ? "text-primary" : "text-on-surface-variant"} />
                      <div>
                        <div className="flex items-center gap-sm">
                          <p className="font-body-bold text-[14px] text-on-surface">{p.label}</p>
                          <span className={`font-mono-technical text-[9px] border px-1.5 py-0.5 ${p.badgeCls}`}>{p.badge}</span>
                        </div>
                        <p className="font-mono-technical text-[10px] text-on-surface-variant mt-xs">{p.desc}</p>
                      </div>
                    </div>
                    {profile === p.id && <Icon name="check_circle" size={18} fill className="text-primary shrink-0" />}
                  </div>

                  {/* Gate pipeline preview */}
                  <div className="flex flex-wrap gap-xs mt-sm">
                    {p.gates.map((g, i) => (
                      <div key={g} className="flex items-center gap-xs">
                        <span className={`font-mono-technical text-[9px] border px-1.5 py-0.5 ${profile === p.id ? "border-primary/40 text-primary" : "border-border-muted text-on-surface-variant"}`}>
                          {g}
                        </span>
                        {i < p.gates.length - 1 && <Icon name="arrow_forward" size={10} className="text-on-surface-variant/40" />}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {profile !== project.governanceProfile && (
              <div className="flex items-center gap-md border border-tertiary/40 bg-tertiary/5 px-lg py-md">
                <Icon name="info" size={14} className="text-tertiary shrink-0" />
                <p className="font-mono-technical text-[10px] text-tertiary flex-1">
                  Changing from <strong>{project.governanceProfile.replace("_", " ").toUpperCase()}</strong> to <strong>{selectedProfile.label.toUpperCase()}</strong>.
                  New assurance items will use the {selectedProfile.label} gate pipeline.
                </p>
                <button
                  onClick={saveProfile}
                  disabled={saving}
                  className="px-lg py-sm border border-primary text-primary font-mono-technical text-[10px] hover:bg-primary/10 transition-colors shrink-0 disabled:opacity-40"
                >
                  {saving ? "SAVING..." : "SAVE PROFILE"}
                </button>
              </div>
            )}
          </section>
        )}

        {/* ── GENERAL TAB ── */}
        {tab === "general" && (
          <section className="space-y-lg">
            <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">PROJECT DETAILS</p>
            <div className="bg-surface border border-border-muted p-lg space-y-lg">
              <div className="grid grid-cols-2 gap-lg">
                <div>
                  <label className="font-mono-technical text-[9px] text-on-surface-variant block mb-sm">PROJECT NAME *</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[12px] text-on-surface outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="font-mono-technical text-[9px] text-on-surface-variant block mb-sm">PROJECT KEY (read-only)</label>
                  <input
                    value={project.key}
                    disabled
                    className="w-full bg-surface-container-lowest border border-border-muted px-md py-sm font-mono-technical text-[12px] text-on-surface-variant opacity-60"
                  />
                </div>
                <div className="col-span-2">
                  <label className="font-mono-technical text-[9px] text-on-surface-variant block mb-sm">DESCRIPTION</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[12px] text-on-surface outline-none focus:border-primary resize-none"
                  />
                </div>
                <div>
                  <label className="font-mono-technical text-[9px] text-on-surface-variant block mb-sm">OWNER EMAIL *</label>
                  <input
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    type="email"
                    className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[12px] text-on-surface outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="font-mono-technical text-[9px] text-on-surface-variant block mb-sm">PROGRAMME</label>
                  <select
                    value={programId}
                    onChange={(e) => setProgramId(e.target.value)}
                    className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[12px] text-on-surface outline-none focus:border-primary"
                  >
                    <option value="">— no programme —</option>
                    {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <button
                onClick={saveGeneral}
                disabled={saving}
                className="px-xl py-sm border border-primary text-primary font-mono-technical text-[10px] hover:bg-primary/10 transition-colors disabled:opacity-40"
              >
                {saving ? "SAVING..." : "SAVE CHANGES"}
              </button>
            </div>
          </section>
        )}

        {/* ── DANGER ZONE TAB ── */}
        {tab === "danger" && (
          <section className="space-y-lg">
            <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">DANGER ZONE</p>

            <div className="bg-surface border border-critical/40 divide-y divide-critical/20">
              {/* Archive */}
              <div className="p-lg flex items-start justify-between gap-lg">
                <div>
                  <p className="font-body-bold text-[13px] text-on-surface">Archive this project</p>
                  <p className="font-mono-technical text-[10px] text-on-surface-variant mt-xs">
                    Archiving hides the project from active views but preserves all governance data, flight recorder events, and evidence (required for audit trail).
                    You can restore an archived project from Admin → Projects.
                  </p>
                </div>
                {archiveConfirm ? (
                  <div className="flex gap-sm shrink-0">
                    <button
                      onClick={archiveProject}
                      disabled={archiving}
                      className="px-md py-xs bg-critical text-on-error font-mono-technical text-[10px] hover:brightness-110 disabled:opacity-50"
                    >
                      {archiving ? "ARCHIVING..." : "CONFIRM ARCHIVE"}
                    </button>
                    <button onClick={() => setArchiveConfirm(false)} className="px-md py-xs border border-border-muted text-on-surface-variant font-mono-technical text-[10px]">
                      CANCEL
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setArchiveConfirm(true)}
                    className="px-md py-xs border border-critical text-critical font-mono-technical text-[10px] hover:bg-critical/10 transition-colors shrink-0"
                  >
                    ARCHIVE PROJECT
                  </button>
                )}
              </div>

              {/* Emergency lock */}
              <div className="p-lg flex items-start justify-between gap-lg">
                <div>
                  <p className="font-body-bold text-[13px] text-on-surface">Emergency AI lock</p>
                  <p className="font-mono-technical text-[10px] text-on-surface-variant mt-xs">
                    Immediately disables all AI for this project. Governance continues uninterrupted.
                  </p>
                </div>
                <a
                  href={`/ai-control?projectId=${project.id}`}
                  className="px-md py-xs border border-critical text-critical font-mono-technical text-[10px] hover:bg-critical/10 transition-colors shrink-0"
                >
                  AI CONTROL →
                </a>
              </div>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
