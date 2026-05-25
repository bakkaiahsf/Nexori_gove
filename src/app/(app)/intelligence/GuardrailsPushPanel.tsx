"use client";

import { useState, useEffect, useCallback } from "react";

interface Project { id: string; key: string; name: string; }
interface Connector { id: string; type: string; name: string; }
interface RecentPush {
  id: string; projectId: string; projectName: string; framework: string;
  repoPath: string; prUrl: string | null; status: string;
  generatedAt: string; mergedAt: string | null;
}

const FRAMEWORKS = ["DORA", "EU_AI_ACT", "SOC2", "ISO_27001", "PCI_DSS", "GDPR"];

interface Props {
  projects: Project[];
  gitConnectors: Connector[];   // github + gitlab connectors
  jiraConnectors: Connector[];  // jira connectors for optional story creation
  recentPushes: RecentPush[];
}

const STATUS_CLS: Record<string, string> = {
  MERGED: "text-primary border-primary",
  PENDING: "text-tertiary border-tertiary",
  FAILED: "text-critical border-critical",
  REJECTED: "text-critical border-critical",
};

export default function GuardrailsPushPanel({
  projects,
  gitConnectors,
  jiraConnectors,
  recentPushes,
}: Props) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [connectorId, setConnectorId] = useState(gitConnectors[0]?.id ?? "");
  const [repos, setRepos] = useState<string[]>([]);
  const [repoFullName, setRepoFullName] = useState("");
  const [reposLoading, setReposLoading] = useState(false);
  const [framework, setFramework] = useState("DORA");
  const [defaultBranch, setDefaultBranch] = useState("main");
  const [createJiraStory, setCreateJiraStory] = useState(jiraConnectors.length > 0);
  const [jiraConnectorId, setJiraConnectorId] = useState(jiraConnectors[0]?.id ?? "");
  const [pushing, setPushing] = useState(false);
  const [result, setResult] = useState<{
    prUrl?: string | null; jiraStoryKey?: string | null; status?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pushes, setPushes] = useState<RecentPush[]>(recentPushes);

  const selectedConnector = gitConnectors.find((c) => c.id === connectorId);

  // Load repos when connector changes
  useEffect(() => {
    if (!connectorId || !selectedConnector) return;
    setRepos([]);
    setRepoFullName("");
    setReposLoading(true);

    const apiPath =
      selectedConnector.type === "github"
        ? `/api/integrations/github/repos?connectorId=${connectorId}`
        : `/api/integrations/gitlab/projects?connectorId=${connectorId}`;

    fetch(apiPath)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { repos?: Array<{ fullName: string }>; projects?: Array<{ pathWithNamespace: string }> } | null) => {
        if (!data) return;
        const list =
          selectedConnector.type === "github"
            ? (data.repos ?? []).map((r) => r.fullName)
            : (data.projects ?? []).map((r) => r.pathWithNamespace);
        setRepos(list);
        if (list.length > 0) setRepoFullName(list[0]);
      })
      .catch(() => {})
      .finally(() => setReposLoading(false));
  }, [connectorId, selectedConnector]);

  // Poll PENDING pushes every 30s
  const pollPending = useCallback(async () => {
    const pendingIds = pushes.filter((p) => p.status === "PENDING").map((p) => p.id);
    if (pendingIds.length === 0) return;
    const updated = await Promise.all(
      pendingIds.map((id) =>
        fetch(`/api/guardrails/${id}/status`)
          .then((r) => (r.ok ? (r.json() as Promise<{ id: string; status: string; mergedAt: string | null }>) : null))
          .catch(() => null),
      ),
    );
    setPushes((prev) =>
      prev.map((p) => {
        const u = updated.find((u) => u?.id === p.id);
        return u ? { ...p, status: u.status, mergedAt: u.mergedAt } : p;
      }),
    );
  }, [pushes]);

  useEffect(() => {
    const hasPending = pushes.some((p) => p.status === "PENDING");
    if (!hasPending) return;
    const interval = setInterval(pollPending, 30000);
    return () => clearInterval(interval);
  }, [pushes, pollPending]);

  async function push() {
    if (!projectId || !connectorId || !repoFullName) return;
    setPushing(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/guardrails/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          connectorId,
          boardId: repoFullName,
          framework,
          defaultBranch,
          ...(createJiraStory && jiraConnectorId ? { jiraConnectorId } : {}),
        }),
      });
      const data = await res.json() as {
        alreadyExists?: boolean; id?: string; prUrl?: string | null;
        jiraStoryKey?: string | null; status?: string; repoPath?: string; error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Push failed");
      if (data.alreadyExists) {
        setResult({ status: "already_exists" });
      } else {
        setResult({ prUrl: data.prUrl, jiraStoryKey: data.jiraStoryKey, status: data.status });
        if (data.id) {
          const proj = projects.find((p) => p.id === projectId);
          setPushes((prev) => [
            {
              id: data.id!,
              projectId,
              projectName: proj?.name ?? projectId,
              framework,
              repoPath: data.repoPath ?? repoFullName,
              prUrl: data.prUrl ?? null,
              status: data.status ?? "PENDING",
              generatedAt: new Date().toISOString(),
              mergedAt: null,
            },
            ...prev,
          ]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Push failed");
    }
    setPushing(false);
  }

  return (
    <div className="bg-surface border border-border-muted">
      <div className="px-xl py-lg border-b border-border-muted">
        <h2 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest text-[10px]">
          GUARDRAILS-AS-CODE — PUSH GOVERNANCE RULES TO REPOSITORY AS PR
        </h2>
        <p className="font-mono-technical text-[10px] text-on-surface-variant mt-xs">
          Generates a YAML rules file and opens a draft PR. No automatic merge — your team reviews and approves.
        </p>
      </div>

      <div className="px-xl py-lg grid grid-cols-2 gap-xl">
        {/* Push form */}
        <div className="space-y-md">

          {/* Project */}
          <div className="space-y-xs">
            <label className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">PROJECT</label>
            <select
              className="w-full bg-surface-container-low border border-border-muted px-md py-sm text-[13px] text-on-surface focus:outline-none focus:border-primary"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.key})</option>
              ))}
            </select>
          </div>

          {/* Connector */}
          <div className="space-y-xs">
            <label className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">
              SOURCE CONNECTOR (GITHUB / GITLAB)
            </label>
            <select
              className="w-full bg-surface-container-low border border-border-muted px-md py-sm text-[13px] text-on-surface focus:outline-none focus:border-primary"
              value={connectorId}
              onChange={(e) => setConnectorId(e.target.value)}
            >
              {gitConnectors.length === 0 && (
                <option value="">No GitHub/GitLab connectors — configure in Admin → Connectors</option>
              )}
              {gitConnectors.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
              ))}
            </select>
          </div>

          {/* Repo picker */}
          <div className="space-y-xs">
            <label className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">
              TARGET REPOSITORY
            </label>
            {reposLoading ? (
              <p className="font-mono-technical text-[10px] text-on-surface-variant animate-pulse">Loading repos...</p>
            ) : repos.length === 0 ? (
              <p className="font-mono-technical text-[10px] text-on-surface-variant">Select a connector above to load repos</p>
            ) : (
              <select
                className="w-full bg-surface-container-low border border-border-muted px-md py-sm text-[13px] text-on-surface focus:outline-none focus:border-primary"
                value={repoFullName}
                onChange={(e) => setRepoFullName(e.target.value)}
              >
                {repos.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            )}
          </div>

          {/* Framework + Branch */}
          <div className="grid grid-cols-2 gap-md">
            <div className="space-y-xs">
              <label className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">FRAMEWORK</label>
              <select
                className="w-full bg-surface-container-low border border-border-muted px-md py-sm text-[13px] text-on-surface focus:outline-none focus:border-primary"
                value={framework}
                onChange={(e) => setFramework(e.target.value)}
              >
                {FRAMEWORKS.map((f) => <option key={f} value={f}>{f.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div className="space-y-xs">
              <label className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">BASE BRANCH</label>
              <input
                className="w-full bg-surface-container-low border border-border-muted px-md py-sm text-[13px] text-on-surface focus:outline-none focus:border-primary"
                value={defaultBranch}
                onChange={(e) => setDefaultBranch(e.target.value)}
                placeholder="main"
              />
            </div>
          </div>

          {/* Jira Story option */}
          {jiraConnectors.length > 0 && (
            <div className="border border-border-muted px-md py-sm space-y-sm bg-surface-container-low">
              <label className="flex items-center gap-md cursor-pointer">
                <input
                  type="checkbox"
                  checked={createJiraStory}
                  onChange={(e) => setCreateJiraStory(e.target.checked)}
                  className="accent-primary"
                />
                <span className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">
                  ALSO CREATE JIRA STORY
                </span>
              </label>
              {createJiraStory && (
                <select
                  className="w-full bg-surface border border-border-muted px-md py-sm text-[13px] text-on-surface focus:outline-none focus:border-primary"
                  value={jiraConnectorId}
                  onChange={(e) => setJiraConnectorId(e.target.value)}
                >
                  {jiraConnectors.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
              {createJiraStory && (
                <p className="font-mono-technical text-[9px] text-on-surface-variant">
                  Creates a Story in the Jira project linked to the connector, with the PR URL attached.
                </p>
              )}
            </div>
          )}

          <button
            onClick={push}
            disabled={pushing || !projectId || !connectorId || !repoFullName}
            className="w-full px-xl py-sm border border-primary text-primary font-mono-technical text-[11px] hover:bg-primary/10 transition-colors disabled:opacity-40"
          >
            {pushing ? "PUSHING..." : "PUSH GUARDRAILS AS PR →"}
          </button>

          {result && (
            <div className="bg-primary/5 border border-primary/30 px-md py-sm space-y-xs">
              {result.status === "already_exists" ? (
                <p className="font-mono-technical text-[11px] text-primary">
                  Same rules hash already PENDING or MERGED — no duplicate PR created.
                </p>
              ) : (
                <>
                  <p className="font-mono-technical text-[11px] text-primary">PR opened successfully — awaiting review</p>
                  {result.prUrl && (
                    <a href={result.prUrl} target="_blank" rel="noopener noreferrer"
                      className="font-mono-technical text-[10px] text-primary underline block truncate">
                      {result.prUrl}
                    </a>
                  )}
                  {result.jiraStoryKey && (
                    <p className="font-mono-technical text-[10px] text-tertiary">
                      Jira story created: {result.jiraStoryKey}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {error && <p className="font-mono-technical text-[11px] text-critical">{error}</p>}
        </div>

        {/* Recent pushes with live status */}
        <div className="space-y-sm">
          <div className="flex items-center justify-between">
            <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">
              RECENT PUSHES
            </p>
            {pushes.some((p) => p.status === "PENDING") && (
              <span className="font-mono-technical text-[9px] text-tertiary animate-pulse">
                · polling 30s
              </span>
            )}
          </div>
          {pushes.length === 0 ? (
            <p className="font-mono-technical text-[11px] text-on-surface-variant">No guardrails pushed yet.</p>
          ) : (
            <div className="space-y-sm max-h-[420px] overflow-y-auto custom-scrollbar">
              {pushes.map((p) => (
                <div key={p.id} className="bg-surface-container-low border border-border-muted px-md py-sm space-y-xs">
                  <div className="flex items-center justify-between gap-sm">
                    <span className="font-body-bold text-body-bold text-on-surface text-[12px] truncate">
                      {p.projectName}
                    </span>
                    <span className={`shrink-0 px-1.5 py-0.5 font-mono-technical text-[9px] border ${STATUS_CLS[p.status] ?? "text-on-surface-variant border-border-muted"}`}>
                      {p.status}
                    </span>
                  </div>
                  <p className="font-mono-technical text-[10px] text-on-surface-variant">
                    {p.framework.replace(/_/g, " ")} · {p.repoPath}
                  </p>
                  {p.prUrl && (
                    <a href={p.prUrl} target="_blank" rel="noopener noreferrer"
                      className="font-mono-technical text-[10px] text-primary underline truncate block">
                      View PR →
                    </a>
                  )}
                  <p className="font-mono-technical text-[10px] text-on-surface-variant">
                    {new Date(p.generatedAt).toLocaleDateString()}
                    {p.mergedAt && ` → Merged ${new Date(p.mergedAt).toLocaleDateString()}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
