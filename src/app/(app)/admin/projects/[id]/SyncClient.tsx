"use client";

import { useState, useCallback } from "react";

type Connector = { id: string; type: string; name: string; baseUrl: string };
type LinkedBoard = {
  id: string;
  boardId: string;
  boardName: string;
  boardType: string;
  connector: { id: string; type: string; name: string };
};
type RecentSync = { evaluatedAt: string; matched: boolean; caseId: string | null; connectorId: string | null };

type Repo = { id: string; name: string; fullName: string; defaultBranch: string; private: boolean; description: string | null };
type GitLabProject = { id: string; name: string; pathWithNamespace: string; defaultBranch: string | null; description: string | null };
type JiraBoard = { id: string; name: string; type: string };

type SyncResult = {
  ok: boolean;
  totalFound: number;
  casesCreated: number;
  casesExisting: number;
  errors: number;
  guardrailsPushed: string[];
  results: Array<{ key: string; caseId?: string; created?: boolean; jiraGovEpicKey?: string; githubIssueUrl?: string; gitlabIssueUrl?: string; error?: string }>;
};

function Icon({ name, size = 16, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <span className={`material-symbols-outlined select-none leading-none ${className}`} style={{ fontSize: size }}>
      {name}
    </span>
  );
}

const CONNECTOR_ICON: Record<string, string> = {
  github: "G",
  gitlab: "GL",
  jira: "J",
  webhook: "W",
};

const CONNECTOR_CLS: Record<string, string> = {
  github: "border-primary/40 text-primary bg-primary/5",
  gitlab: "border-tertiary/40 text-tertiary bg-tertiary/5",
  jira: "border-primary/40 text-primary bg-primary/5",
};

export default function SyncClient({
  projectId,
  projectKey,
  frameworks,
  connectors,
  linkedBoards,
  recentSyncs,
}: {
  projectId: string;
  projectKey: string;
  frameworks: string[];
  connectors: Connector[];
  linkedBoards: LinkedBoard[];
  recentSyncs: RecentSync[];
}) {
  // Per-connector UI state
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [glProjects, setGlProjects] = useState<GitLabProject[]>([]);
  const [jiraBoards, setJiraBoards] = useState<JiraBoard[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [selectedJiraConnectorId, setSelectedJiraConnectorId] = useState<string | null>(null);
  const [selectedJiraBoardId, setSelectedJiraBoardId] = useState<string | null>(null);
  const [pushGuardrails, setPushGuardrails] = useState(frameworks.length > 0);

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const githubConnectors = connectors.filter((c) => c.type === "github");
  const gitlabConnectors = connectors.filter((c) => c.type === "gitlab");
  const jiraConnectors = connectors.filter((c) => c.type === "jira");

  const selectedConnector = connectors.find((c) => c.id === selectedConnectorId);

  const loadItems = useCallback(async (connectorId: string, type: string) => {
    setLoadingList(true);
    setListError(null);
    setRepos([]);
    setGlProjects([]);
    setJiraBoards([]);
    setSelectedBoardId(null);

    try {
      if (type === "github") {
        const res = await fetch(`/api/integrations/github/repos?connectorId=${connectorId}`);
        const data = await res.json() as { repos?: Repo[]; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Failed to load repositories");
        setRepos(data.repos ?? []);
      } else if (type === "gitlab") {
        const res = await fetch(`/api/integrations/gitlab/projects?connectorId=${connectorId}`);
        const data = await res.json() as { projects?: GitLabProject[]; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Failed to load projects");
        setGlProjects(data.projects ?? []);
      } else if (type === "jira") {
        const res = await fetch(`/api/integrations/jira/boards?connectorId=${connectorId}`);
        const data = await res.json() as { boards?: JiraBoard[]; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Failed to load boards");
        setJiraBoards(data.boards ?? []);
      }
    } catch (err) {
      setListError(String(err));
    } finally {
      setLoadingList(false);
    }
  }, []);

  const handleSelectConnector = (connectorId: string, type: string) => {
    setSelectedConnectorId(connectorId);
    setSyncResult(null);
    setSyncError(null);
    void loadItems(connectorId, type);
  };

  const handleSync = async () => {
    if (!selectedConnectorId || !selectedBoardId || !selectedConnector) return;
    if (selectedConnector.type === "jira") {
      // Jira-only connector: just link the board, no PR/MR sync
      return;
    }

    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);

    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          connectorId: selectedConnectorId,
          boardId: selectedBoardId,
          jiraConnectorId: selectedJiraConnectorId ?? undefined,
          jiraBoardId: selectedJiraBoardId ?? undefined,
          pushGuardrails,
        }),
      });
      const data = await res.json() as SyncResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setSyncResult(data);
    } catch (err) {
      setSyncError(String(err));
    } finally {
      setSyncing(false);
    }
  };

  const allItems = selectedConnector?.type === "github" ? repos : selectedConnector?.type === "gitlab" ? glProjects : jiraBoards;
  const canSync = selectedConnectorId && selectedBoardId && selectedConnector?.type !== "jira" && !syncing;

  return (
    <div className="space-y-lg">
      {/* Linked boards */}
      {linkedBoards.length > 0 && (
        <section className="bg-surface border border-border-muted">
          <div className="px-xl py-md border-b border-border-muted flex items-center gap-md">
            <Icon name="link" size={14} />
            <span className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">LINKED SOURCES</span>
            <span className="ml-auto font-mono-technical text-[10px] text-primary">{linkedBoards.length}</span>
          </div>
          <div className="divide-y divide-border-muted">
            {linkedBoards.map((b) => (
              <div key={b.id} className="px-xl py-md flex items-center gap-md">
                <div className={`w-6 h-6 flex items-center justify-center font-mono-technical text-[9px] border shrink-0 ${CONNECTOR_CLS[b.connector.type] ?? "border-border-muted text-on-surface-variant"}`}>
                  {CONNECTOR_ICON[b.connector.type] ?? b.connector.type[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono-technical text-[11px] text-on-surface truncate">{b.boardId}</p>
                  <p className="font-mono-technical text-[10px] text-on-surface-variant">{b.connector.name} · {b.boardType}</p>
                </div>
                <span className="font-mono-technical text-[10px] text-primary">ACTIVE</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Connector selection */}
      <section className="bg-surface border border-border-muted">
        <div className="px-xl py-md border-b border-border-muted flex items-center gap-md">
          <Icon name="hub" size={14} />
          <span className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">SELECT SOURCE TO SYNC</span>
        </div>
        <div className="p-xl space-y-lg">
          {/* GitHub */}
          {githubConnectors.length > 0 && (
            <div>
              <p className="font-mono-technical text-[10px] text-on-surface-variant mb-sm tracking-widest">GITHUB CONNECTORS</p>
              <div className="space-y-xs">
                {githubConnectors.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSelectConnector(c.id, "github")}
                    className={`w-full flex items-center gap-md px-md py-sm border text-left transition-colors ${selectedConnectorId === c.id ? "border-primary bg-primary/5" : "border-border-muted hover:border-primary/40"}`}
                  >
                    <div className="w-6 h-6 flex items-center justify-center font-bold text-[10px] border border-primary text-primary shrink-0">G</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono-technical text-[11px] text-on-surface">{c.name}</p>
                      <p className="font-mono-technical text-[10px] text-on-surface-variant">{c.baseUrl}</p>
                    </div>
                    {selectedConnectorId === c.id && <Icon name="check_circle" size={14} className="text-primary shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* GitLab */}
          {gitlabConnectors.length > 0 && (
            <div>
              <p className="font-mono-technical text-[10px] text-on-surface-variant mb-sm tracking-widest">GITLAB CONNECTORS</p>
              <div className="space-y-xs">
                {gitlabConnectors.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSelectConnector(c.id, "gitlab")}
                    className={`w-full flex items-center gap-md px-md py-sm border text-left transition-colors ${selectedConnectorId === c.id ? "border-tertiary bg-tertiary/5" : "border-border-muted hover:border-tertiary/40"}`}
                  >
                    <div className="w-6 h-6 flex items-center justify-center font-bold text-[10px] border border-tertiary text-tertiary shrink-0">GL</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono-technical text-[11px] text-on-surface">{c.name}</p>
                      <p className="font-mono-technical text-[10px] text-on-surface-variant">{c.baseUrl}</p>
                    </div>
                    {selectedConnectorId === c.id && <Icon name="check_circle" size={14} className="text-tertiary shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {githubConnectors.length === 0 && gitlabConnectors.length === 0 && (
            <p className="font-mono-technical text-[11px] text-on-surface-variant">
              No GitHub or GitLab connectors configured.{" "}
              <a href="/admin/connectors" className="text-primary hover:underline">Register a connector →</a>
            </p>
          )}
        </div>
      </section>

      {/* Repository / project list */}
      {selectedConnectorId && selectedConnector?.type !== "jira" && (
        <section className="bg-surface border border-border-muted">
          <div className="px-xl py-md border-b border-border-muted flex items-center gap-md">
            <Icon name="source" size={14} />
            <span className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">
              {selectedConnector?.type === "github" ? "REPOSITORIES" : "PROJECTS"}
            </span>
            {loadingList && <span className="ml-auto font-mono-technical text-[10px] text-on-surface-variant animate-pulse">LOADING...</span>}
            {!loadingList && <span className="ml-auto font-mono-technical text-[10px] text-on-surface-variant">{allItems.length} FOUND</span>}
          </div>

          {listError && (
            <div className="p-xl">
              <p className="font-mono-technical text-[11px] text-critical">{listError}</p>
            </div>
          )}

          {!listError && !loadingList && (
            <div className="divide-y divide-border-muted max-h-[320px] overflow-y-auto custom-scrollbar">
              {repos.map((r) => (
                <button
                  key={r.fullName}
                  onClick={() => setSelectedBoardId(r.fullName)}
                  className={`w-full flex items-center gap-md px-xl py-md text-left transition-colors ${selectedBoardId === r.fullName ? "bg-primary/5 border-l-2 border-primary" : "hover:bg-surface-container-high"}`}
                >
                  <Icon name={r.private ? "lock" : "folder_open"} size={14} className="text-on-surface-variant shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono-technical text-[11px] text-on-surface">{r.fullName}</p>
                    {r.description && <p className="font-mono-technical text-[10px] text-on-surface-variant truncate">{r.description}</p>}
                  </div>
                  <span className="font-mono-technical text-[10px] text-on-surface-variant shrink-0">{r.defaultBranch}</span>
                  {selectedBoardId === r.fullName && <Icon name="check_circle" size={14} className="text-primary shrink-0" />}
                </button>
              ))}
              {glProjects.map((p) => (
                <button
                  key={p.pathWithNamespace}
                  onClick={() => setSelectedBoardId(p.pathWithNamespace)}
                  className={`w-full flex items-center gap-md px-xl py-md text-left transition-colors ${selectedBoardId === p.pathWithNamespace ? "bg-tertiary/5 border-l-2 border-tertiary" : "hover:bg-surface-container-high"}`}
                >
                  <Icon name="folder_open" size={14} className="text-on-surface-variant shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono-technical text-[11px] text-on-surface">{p.pathWithNamespace}</p>
                    {p.description && <p className="font-mono-technical text-[10px] text-on-surface-variant truncate">{p.description}</p>}
                  </div>
                  {p.defaultBranch && <span className="font-mono-technical text-[10px] text-on-surface-variant shrink-0">{p.defaultBranch}</span>}
                  {selectedBoardId === p.pathWithNamespace && <Icon name="check_circle" size={14} className="text-tertiary shrink-0" />}
                </button>
              ))}
              {allItems.length === 0 && !loadingList && (
                <p className="p-xl font-mono-technical text-[11px] text-on-surface-variant">No items found for this connector.</p>
              )}
            </div>
          )}
        </section>
      )}

      {/* Jira writeback config */}
      {selectedBoardId && selectedConnector?.type !== "jira" && jiraConnectors.length > 0 && (
        <section className="bg-surface border border-border-muted">
          <div className="px-xl py-md border-b border-border-muted flex items-center gap-md">
            <div className="w-5 h-5 flex items-center justify-center font-bold text-[9px] border border-primary text-primary">J</div>
            <span className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">JIRA WRITEBACK (OPTIONAL)</span>
            <span className="ml-auto font-mono-technical text-[10px] text-on-surface-variant">Creates [GOV] ticket on sync</span>
          </div>
          <div className="p-xl space-y-md">
            <p className="font-mono-technical text-[10px] text-on-surface-variant">
              Select a Jira connector to auto-create governance tickets when cases are opened:
            </p>
            <div className="space-y-xs">
              {jiraConnectors.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedJiraConnectorId(selectedJiraConnectorId === c.id ? null : c.id)}
                  className={`w-full flex items-center gap-md px-md py-sm border text-left transition-colors ${selectedJiraConnectorId === c.id ? "border-primary bg-primary/5" : "border-border-muted hover:border-primary/40"}`}
                >
                  <div className="w-5 h-5 flex items-center justify-center font-bold text-[9px] border border-primary text-primary shrink-0">J</div>
                  <span className="font-mono-technical text-[11px] text-on-surface flex-1">{c.name}</span>
                  {selectedJiraConnectorId === c.id && <Icon name="check_circle" size={14} className="text-primary" />}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Guardrails push config */}
      {selectedBoardId && frameworks.length > 0 && (
        <section className="bg-surface border border-border-muted p-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono-technical text-[11px] text-on-surface">Push Governance Guidelines to Repository</p>
              <p className="font-mono-technical text-[10px] text-on-surface-variant mt-xs">
                Generates governance YAML rules ({frameworks.join(", ")}) and opens a PR in the selected repo
              </p>
            </div>
            <button
              onClick={() => setPushGuardrails((v) => !v)}
              className={`relative w-10 h-5 border transition-colors ${pushGuardrails ? "bg-primary border-primary" : "bg-surface-container-highest border-border-muted"}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-surface transition-transform ${pushGuardrails ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
          {pushGuardrails && (
            <div className="mt-md flex flex-wrap gap-xs">
              {frameworks.map((f) => (
                <span key={f} className="px-2 py-0.5 font-mono-technical text-[9px] border border-primary/40 text-primary">
                  {f.replace(/_/g, " ")} YAML
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Sync button */}
      {selectedBoardId && selectedConnector?.type !== "jira" && (
        <div className="flex items-center gap-md">
          <button
            onClick={() => void handleSync()}
            disabled={!canSync}
            className={`flex items-center gap-md px-lg py-md font-mono-technical text-[11px] font-bold border transition-colors ${canSync ? "border-primary text-primary hover:bg-primary/10" : "border-border-muted text-on-surface-variant cursor-not-allowed"}`}
          >
            {syncing ? (
              <>
                <Icon name="sync" size={14} className="animate-spin" />
                SYNCING...
              </>
            ) : (
              <>
                <Icon name="sync" size={14} />
                SYNC NOW — {selectedBoardId}
              </>
            )}
          </button>
          <p className="font-mono-technical text-[10px] text-on-surface-variant">
            Fetches open PRs/MRs · Creates governance cases · Writes back tracking issues
            {selectedJiraConnectorId ? " · Creates Jira tickets" : ""}
            {pushGuardrails ? " · Pushes governance YAML" : ""}
          </p>
        </div>
      )}

      {/* Sync error */}
      {syncError && (
        <div className="border border-critical bg-critical/5 p-lg">
          <p className="font-mono-technical text-[11px] text-critical">{syncError}</p>
        </div>
      )}

      {/* Sync results */}
      {syncResult && (
        <section className="bg-surface border border-primary/30">
          <div className="px-xl py-md border-b border-border-muted flex items-center gap-md">
            <Icon name="check_circle" size={14} className="text-primary" />
            <span className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">SYNC COMPLETE</span>
          </div>
          <div className="p-xl space-y-lg">
            {/* Summary stats */}
            <div className="grid grid-cols-4 gap-md text-center">
              {[
                { label: "FOUND", value: String(syncResult.totalFound), cls: "text-on-surface" },
                { label: "CASES CREATED", value: String(syncResult.casesCreated), cls: "text-primary" },
                { label: "ALREADY EXIST", value: String(syncResult.casesExisting), cls: "text-on-surface-variant" },
                { label: "GUARDRAILS PUSHED", value: String(syncResult.guardrailsPushed.length), cls: "text-primary" },
              ].map((s) => (
                <div key={s.label} className="border border-border-muted p-md">
                  <p className={`font-bold leading-none ${s.cls}`} style={{ fontSize: 24 }}>{s.value}</p>
                  <p className="font-mono-technical text-[9px] text-on-surface-variant mt-xs">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Per-item results */}
            {syncResult.results.length > 0 && (
              <div>
                <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest mb-sm">ITEMS PROCESSED</p>
                <div className="space-y-xs max-h-[300px] overflow-y-auto custom-scrollbar">
                  {syncResult.results.map((r) => (
                    <div key={r.key} className="flex items-start gap-md py-xs border-b border-border-muted last:border-0">
                      <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${r.error ? "bg-critical" : r.created ? "bg-primary" : "bg-on-surface-variant"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-mono-technical text-[10px] text-on-surface">{r.key}</p>
                        <div className="flex flex-wrap gap-xs mt-0.5">
                          {r.created && <span className="font-mono-technical text-[9px] text-primary">NEW CASE</span>}
                          {r.created === false && <span className="font-mono-technical text-[9px] text-on-surface-variant">EXISTING</span>}
                          {r.jiraGovEpicKey && <span className="font-mono-technical text-[9px] text-primary">JIRA: {r.jiraGovEpicKey}</span>}
                          {r.githubIssueUrl && (
                            <a href={r.githubIssueUrl} target="_blank" rel="noopener noreferrer" className="font-mono-technical text-[9px] text-primary hover:underline">
                              GITHUB ISSUE ↗
                            </a>
                          )}
                          {r.gitlabIssueUrl && (
                            <a href={r.gitlabIssueUrl} target="_blank" rel="noopener noreferrer" className="font-mono-technical text-[9px] text-tertiary hover:underline">
                              GITLAB ISSUE ↗
                            </a>
                          )}
                          {r.error && <span className="font-mono-technical text-[9px] text-critical">{r.error}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Guardrails pushed */}
            {syncResult.guardrailsPushed.length > 0 && (
              <div>
                <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest mb-sm">GOVERNANCE GUIDELINES PUSHED</p>
                <div className="space-y-xs">
                  {syncResult.guardrailsPushed.map((g) => (
                    <p key={g} className="font-mono-technical text-[10px] text-primary">{g}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Recent syncs */}
      {recentSyncs.length > 0 && (
        <section className="bg-surface border border-border-muted">
          <div className="px-xl py-md border-b border-border-muted flex items-center gap-md">
            <Icon name="history" size={14} />
            <span className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">RECENT ACTIVITY</span>
          </div>
          <div className="divide-y divide-border-muted">
            {recentSyncs.map((s, i) => (
              <div key={i} className="px-xl py-sm flex items-center gap-md">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.matched ? "bg-primary" : "bg-on-surface-variant"}`} />
                <span className="font-mono-technical text-[10px] text-on-surface-variant flex-1">
                  {new Date(s.evaluatedAt).toLocaleString("en-GB")}
                </span>
                {s.caseId && <span className="font-mono-technical text-[10px] text-primary">CASE #{s.caseId.slice(-6).toUpperCase()}</span>}
                <span className={`font-mono-technical text-[10px] ${s.matched ? "text-primary" : "text-on-surface-variant"}`}>
                  {s.matched ? "MATCHED" : "SKIPPED"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
