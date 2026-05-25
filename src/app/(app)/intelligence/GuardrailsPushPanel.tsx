"use client";

import { useState } from "react";

interface Project {
  id: string;
  key: string;
  name: string;
}

interface Connector {
  id: string;
  type: string;
  name: string;
}

interface RecentPush {
  id: string;
  projectId: string;
  projectName: string;
  framework: string;
  repoPath: string;
  prUrl: string | null;
  status: string;
  generatedAt: string;
  mergedAt: string | null;
}

const FRAMEWORKS = ["GDPR", "DORA", "SOC2", "EU_AI_ACT", "ISO_27001", "PCI_DSS"];

interface Props {
  projects: Project[];
  connectors: Connector[];
  recentPushes: RecentPush[];
}

export default function GuardrailsPushPanel({ projects, connectors, recentPushes }: Props) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [connectorId, setConnectorId] = useState(connectors[0]?.id ?? "");
  const [framework, setFramework] = useState("GDPR");
  const [defaultBranch, setDefaultBranch] = useState("main");
  const [pushing, setPushing] = useState(false);
  const [result, setResult] = useState<{ prUrl?: string | null; status?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function push() {
    if (!projectId || !connectorId) return;
    setPushing(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/guardrails/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, connectorId, framework, defaultBranch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Push failed");
      setResult(
        data.alreadyExists
          ? { status: "already_exists" }
          : { prUrl: data.prUrl, status: data.status }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Push failed");
    }
    setPushing(false);
  }

  const statusColor = (s: string) => {
    if (s === "MERGED") return "text-primary border-primary";
    if (s === "PENDING") return "text-tertiary border-tertiary";
    if (s === "FAILED" || s === "REJECTED") return "text-critical border-critical";
    return "text-on-surface-variant border-border-muted";
  };

  return (
    <div className="bg-surface border border-border-muted">
      <div className="px-xl py-lg border-b border-border-muted">
        <h2 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest text-[10px]">
          GUARDRAILS-AS-CODE — PUSH GOVERNANCE RULES TO REPOSITORY
        </h2>
      </div>

      <div className="px-xl py-lg grid grid-cols-2 gap-xl">
        {/* Push form */}
        <div className="space-y-md">
          <p className="font-body-base text-body-base text-on-surface text-[12px]">
            When a project qualifies for a framework, NexoriOS generates a YAML rules file and opens
            a PR in the configured repository. The file defines required gates, data handling
            requirements, and AI guardrails.
          </p>

          <div className="space-y-sm">
            <label className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">
              PROJECT
            </label>
            <select
              className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-body-base text-body-base text-on-surface text-[13px] focus:outline-none focus:border-primary"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.key})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-sm">
            <label className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">
              CONNECTOR (TARGET REPO)
            </label>
            <select
              className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-body-base text-body-base text-on-surface text-[13px] focus:outline-none focus:border-primary"
              value={connectorId}
              onChange={(e) => setConnectorId(e.target.value)}
            >
              {connectors.length === 0 && (
                <option value="">No connectors — configure in Admin → Connectors</option>
              )}
              {connectors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-md">
            <div className="space-y-sm">
              <label className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">
                FRAMEWORK
              </label>
              <select
                className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-body-base text-body-base text-on-surface text-[13px] focus:outline-none focus:border-primary"
                value={framework}
                onChange={(e) => setFramework(e.target.value)}
              >
                {FRAMEWORKS.map((f) => (
                  <option key={f} value={f}>
                    {f.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-sm">
              <label className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">
                BASE BRANCH
              </label>
              <input
                className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-body-base text-body-base text-on-surface text-[13px] focus:outline-none focus:border-primary"
                value={defaultBranch}
                onChange={(e) => setDefaultBranch(e.target.value)}
                placeholder="main"
              />
            </div>
          </div>

          <button
            onClick={push}
            disabled={pushing || !projectId || !connectorId}
            className="px-xl py-sm border border-primary text-primary font-mono-technical text-[11px] hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            {pushing ? "PUSHING..." : "PUSH GUARDRAILS AS PR →"}
          </button>

          {result && (
            <div className="bg-primary/5 border border-primary/30 px-md py-sm space-y-xs">
              {result.status === "already_exists" ? (
                <p className="font-mono-technical text-[11px] text-primary">
                  Already pushed — same rules hash exists with PENDING or MERGED status.
                </p>
              ) : (
                <>
                  <p className="font-mono-technical text-[11px] text-primary">
                    PR created successfully
                  </p>
                  {result.prUrl && (
                    <a
                      href={result.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono-technical text-[10px] text-primary underline block"
                    >
                      {result.prUrl}
                    </a>
                  )}
                </>
              )}
            </div>
          )}

          {error && <p className="font-mono-technical text-[11px] text-critical">{error}</p>}
        </div>

        {/* Recent pushes */}
        <div className="space-y-sm">
          <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">
            RECENT GUARDRAIL PUSHES
          </p>
          {recentPushes.length === 0 ? (
            <p className="font-mono-technical text-[11px] text-on-surface-variant">
              No guardrails pushed yet.
            </p>
          ) : (
            <div className="space-y-sm max-h-72 overflow-y-auto">
              {recentPushes.map((p) => (
                <div
                  key={p.id}
                  className="bg-surface-container-low border border-border-muted px-md py-sm space-y-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-body-bold text-body-bold text-on-surface text-[12px]">
                      {p.projectName}
                    </span>
                    <span
                      className={`px-2 py-0.5 font-mono-technical text-[9px] border ${statusColor(p.status)}`}
                    >
                      {p.status}
                    </span>
                  </div>
                  <p className="font-mono-technical text-[10px] text-on-surface-variant">
                    {p.framework.replace("_", " ")} · {p.repoPath}
                  </p>
                  {p.prUrl && (
                    <a
                      href={p.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono-technical text-[10px] text-primary underline"
                    >
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
