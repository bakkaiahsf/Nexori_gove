"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ConnectorRecord = {
  id: string;
  type: string;
  name: string;
  baseUrl: string;
  projectKeys: string[];
  enabled: boolean;
  createdAt: Date;
  epicsCount: number;
  matchedCount: number;
  skippedCount: number;
};

function Icon({ name, size = 16, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <span
      className={`material-symbols-outlined select-none leading-none ${className}`}
      style={{ fontSize: size }}
    >
      {name}
    </span>
  );
}

const CONNECTOR_META: Record<string, { label: string; icon: string; color: string; webhookPath: string; credFields: Array<{ key: string; label: string; type: string; placeholder: string; hint?: string }> }> = {
  jira: {
    label: "Atlassian Jira",
    icon: "J",
    color: "text-primary border-primary bg-primary/10",
    webhookPath: "/api/webhooks/jira",
    credFields: [
      { key: "email", label: "Atlassian Email", type: "email", placeholder: "you@company.com" },
      { key: "apiToken", label: "API Token", type: "password", placeholder: "Atlassian API token", hint: "Generate at id.atlassian.com/manage/api-tokens" },
    ],
  },
  github: {
    label: "GitHub",
    icon: "G",
    color: "text-tertiary border-tertiary bg-tertiary/10",
    webhookPath: "/api/webhooks/github",
    credFields: [
      { key: "token", label: "Personal Access Token", type: "password", placeholder: "ghp_…", hint: "Needs repo, read:org scopes" },
      { key: "owner", label: "Organisation / Owner", type: "text", placeholder: "my-org" },
    ],
  },
  gitlab: {
    label: "GitLab",
    icon: "GL",
    color: "text-primary border-primary bg-primary/10",
    webhookPath: "/api/webhooks/gitlab",
    credFields: [
      { key: "token", label: "Personal Access Token", type: "password", placeholder: "glpat-…", hint: "Needs api scope" },
      { key: "projectId", label: "GitLab Project ID", type: "text", placeholder: "12345678" },
    ],
  },
  webhook: {
    label: "Generic Webhook",
    icon: "W",
    color: "text-on-surface-variant border-border-muted",
    webhookPath: "/api/webhooks/generic",
    credFields: [
      { key: "secret", label: "Shared Secret (optional)", type: "password", placeholder: "Used to verify webhook signature" },
    ],
  },
};

const TYPE_DEFAULTS: Record<string, string> = {
  jira: "https://your-org.atlassian.net",
  github: "https://api.github.com",
  gitlab: "https://gitlab.com",
  webhook: "https://your-enterprise-tool.internal",
};

function RegisterForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [type, setType] = useState("jira");
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://salesforceai.atlassian.net");
  const [projectKeys, setProjectKeys] = useState("");
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ id: string; webhookUrl: string; webhookSecret?: string } | null>(null);

  const meta = CONNECTOR_META[type];

  function setCredField(key: string, val: string) {
    setCreds((prev) => ({ ...prev, [key]: val }));
  }

  async function save() {
    setError("");
    const keys = projectKeys.split(/[\s,]+/).map((k) => k.trim().toUpperCase()).filter(Boolean);
    setSaving(true);
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name, baseUrl, credentials: creds, projectKeys: keys }),
      });
      const data = (await res.json()) as { connector?: { id: string }; webhookUrl?: string; webhookSecret?: string; error?: unknown };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Validation failed — check all fields");
        return;
      }
      setCreated({ id: data.connector!.id, webhookUrl: data.webhookUrl ?? meta.webhookPath, webhookSecret: data.webhookSecret as string | undefined });
      onCreated();
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    return (
      <div className="bg-surface border border-primary p-lg space-y-md">
        <div className="flex items-center gap-md">
          <Icon name="check_circle" size={16} className="text-primary" />
          <p className="font-mono-technical text-[11px] text-primary font-bold">CONNECTOR REGISTERED</p>
          <button onClick={onClose} className="ml-auto text-on-surface-variant hover:text-on-surface">
            <Icon name="close" size={14} />
          </button>
        </div>
        <div className="space-y-sm">
          <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">WEBHOOK URL — configure in your tool</p>
          <div className="bg-surface-container-low border border-border-muted px-md py-sm">
            <code className="font-mono-technical text-[11px] text-primary break-all">{created.webhookUrl}</code>
          </div>
          {created.webhookSecret && (
            <>
              <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">WEBHOOK SECRET — copy now, shown once</p>
              <div className="bg-surface-container-low border border-critical/30 px-md py-sm">
                <code className="font-mono-technical text-[11px] text-critical break-all">{created.webhookSecret}</code>
              </div>
            </>
          )}
          <p className="font-mono-technical text-[9px] text-on-surface-variant">
            Connector ID: {created.id}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-primary/30 p-lg space-y-md">
      <div className="flex items-center justify-between">
        <p className="font-mono-technical text-[10px] text-primary tracking-widest">REGISTER CONNECTOR</p>
        <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
          <Icon name="close" size={14} />
        </button>
      </div>

      {/* Type selector */}
      <div>
        <label className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest block mb-xs">CONNECTOR TYPE</label>
        <div className="grid grid-cols-4 gap-xs">
          {(["jira", "github", "gitlab", "webhook"] as const).map((t) => {
            const m = CONNECTOR_META[t];
            return (
              <button
                key={t}
                onClick={() => {
                  setType(t);
                  setBaseUrl(TYPE_DEFAULTS[t]);
                  setCreds({});
                }}
                className={`p-sm border font-mono-technical text-[10px] transition-colors text-left flex items-center gap-xs ${type === t ? `${m.color} border-2` : "border-border-muted text-on-surface-variant hover:border-primary/50"}`}
              >
                <span className={`w-5 h-5 border flex items-center justify-center text-[9px] shrink-0 ${type === t ? m.color : "border-border-muted"}`}>{m.icon}</span>
                {m.label.split(" ")[0]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Name */}
      <div className="grid grid-cols-2 gap-md">
        <div>
          <label className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest block mb-xs">DISPLAY NAME *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`e.g. ${meta.label} (Production)`}
            className="w-full bg-surface border border-border-muted px-md py-sm font-mono-technical text-[11px] outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest block mb-xs">BASE URL *</label>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={TYPE_DEFAULTS[type]}
            className="w-full bg-surface border border-border-muted px-md py-sm font-mono-technical text-[11px] outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Credentials — contextual by type */}
      <div>
        <label className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest block mb-xs">CREDENTIALS</label>
        <div className="space-y-xs">
          {meta.credFields.map((f) => (
            <div key={f.key}>
              <label className="font-mono-technical text-[9px] text-on-surface-variant block mb-xs">{f.label}</label>
              <input
                type={f.type}
                value={creds[f.key] ?? ""}
                onChange={(e) => setCredField(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="w-full bg-surface border border-border-muted px-md py-sm font-mono-technical text-[11px] outline-none focus:border-primary"
                autoComplete="off"
              />
              {f.hint && <p className="font-mono-technical text-[9px] text-on-surface-variant mt-xs">{f.hint}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Project keys */}
      <div>
        <label className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest block mb-xs">
          {type === "jira" ? "JIRA PROJECT KEYS (comma-separated)" : "PROJECT IDENTIFIERS (optional)"}
        </label>
        <input
          value={projectKeys}
          onChange={(e) => setProjectKeys(e.target.value)}
          placeholder={type === "jira" ? "e.g. BANK, RISK, GOV" : "e.g. my-org/my-repo"}
          className="w-full bg-surface border border-border-muted px-md py-sm font-mono-technical text-[11px] outline-none focus:border-primary"
        />
        <p className="font-mono-technical text-[9px] text-on-surface-variant mt-xs">
          {type === "jira"
            ? "Only webhooks from these project keys will be processed"
            : "Leave blank to accept events from all projects in this connector"}
        </p>
      </div>

      {error && <p className="font-mono-technical text-[10px] text-critical">{error}</p>}

      <div className="flex items-center gap-sm pt-sm">
        <p className="font-mono-technical text-[9px] text-on-surface-variant flex-1">
          A webhook secret will be auto-generated for you.
        </p>
        <button
          onClick={() => void save()}
          disabled={saving || !name.trim() || !baseUrl.trim()}
          className="px-xl py-sm bg-primary text-background font-mono-technical text-[10px] hover:bg-primary/90 disabled:opacity-40"
        >
          {saving ? "REGISTERING…" : "REGISTER CONNECTOR"}
        </button>
      </div>
    </div>
  );
}

export default function ConnectorsClient({ connectors }: { connectors: ConnectorRecord[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

  function refresh() {
    router.refresh();
  }

  return (
    <div className="space-y-lg">
      <div className="flex items-center gap-md">
        <p className="font-mono-technical text-[10px] text-on-surface-variant">
          {connectors.length} connector{connectors.length !== 1 ? "s" : ""} registered
        </p>
        <div className="flex-1" />
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-sm px-lg py-sm bg-primary text-background font-mono-technical text-[10px] hover:bg-primary/90 transition-colors"
        >
          <Icon name="add" size={12} className="text-background" />
          REGISTER CONNECTOR
        </button>
      </div>

      {showForm && (
        <RegisterForm
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); refresh(); }}
        />
      )}

      {connectors.length === 0 && !showForm && (
        <div className="bg-surface border border-border-muted p-xl text-center space-y-md">
          <p className="font-body-bold text-body-bold text-on-surface">No connectors registered yet</p>
          <p className="font-mono-technical text-[11px] text-on-surface-variant">
            Register a Jira, GitHub, GitLab, or generic webhook connector to start receiving events.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-xl py-sm border border-primary text-primary font-mono-technical text-[11px] hover:bg-primary/10 transition-colors"
          >
            REGISTER FIRST CONNECTOR →
          </button>
        </div>
      )}

      <div className="space-y-md">
        {connectors.map((c) => {
          const meta = CONNECTOR_META[c.type] ?? { label: c.type, icon: "?", color: "text-on-surface border-border-muted", webhookPath: `/api/webhooks/${c.type}`, credFields: [] };
          const webhookUrl = `${appUrl}${meta.webhookPath}?connectorId=${c.id}`;

          return (
            <div key={c.id} className="bg-surface border border-border-muted">
              <div className="px-xl py-lg flex items-start gap-lg border-b border-border-muted">
                <div className={`w-10 h-10 border flex items-center justify-center font-mono-technical text-[11px] shrink-0 ${meta.color}`}>
                  {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-md mb-xs">
                    <span className="font-body-bold text-body-bold text-on-surface">{c.name}</span>
                    <span className={`px-2 py-0.5 font-mono-technical text-[10px] border ${meta.color}`}>
                      {c.type.toUpperCase()}
                    </span>
                    <span className={`px-2 py-0.5 font-mono-technical text-[10px] border ${c.enabled ? "text-primary border-primary bg-primary/10" : "text-on-surface-variant border-border-muted"}`}>
                      {c.enabled ? "ACTIVE" : "DISABLED"}
                    </span>
                  </div>
                  <p className="font-mono-technical text-[10px] text-on-surface-variant">{c.baseUrl}</p>
                  {c.projectKeys.length > 0 && (
                    <p className="font-mono-technical text-[10px] text-on-surface-variant">
                      Keys: {c.projectKeys.join(", ")}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0 space-y-xs">
                  <p className="font-mono-technical text-[10px] text-on-surface-variant">{c.epicsCount} SNAPSHOTS</p>
                  <p className="font-mono-technical text-[10px] text-primary">{c.matchedCount} MATCHED</p>
                  <p className="font-mono-technical text-[10px] text-on-surface-variant">{c.skippedCount} SKIPPED</p>
                </div>
              </div>

              {/* Webhook URL — always visible */}
              <div className="px-xl py-lg space-y-sm">
                <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">WEBHOOK ENDPOINT — configure this in your tool</p>
                <div className="bg-surface-container-low border border-border-muted px-md py-sm flex items-center gap-md">
                  <code className="font-mono-technical text-[11px] text-primary flex-1 break-all">
                    {webhookUrl}
                  </code>
                  <button
                    onClick={() => void navigator.clipboard?.writeText(webhookUrl)}
                    title="Copy"
                    className="shrink-0 text-on-surface-variant hover:text-primary"
                  >
                    <Icon name="content_copy" size={14} />
                  </button>
                </div>
                <p className="font-mono-technical text-[9px] text-on-surface-variant">
                  Connector ID: <span className="text-on-surface">{c.id}</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Generic webhook info */}
      <div className="bg-surface border border-border-muted p-lg space-y-sm">
        <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">ENTERPRISE / CUSTOM WEBHOOK</p>
        <p className="font-body-base text-body-base text-on-surface-variant text-[12px]">
          Any enterprise tool (ServiceNow, Azure DevOps, Linear, custom ITSM) can post events to the generic webhook endpoint.
          Register a connector of type <strong>Webhook</strong> above to get a dedicated endpoint URL and shared secret.
        </p>
        <div className="bg-surface-container-low border border-border-muted px-md py-sm">
          <code className="font-mono-technical text-[11px] text-primary">
            POST {appUrl}/api/webhooks/generic?connectorId=&#123;your-connector-id&#125;
          </code>
        </div>
        <p className="font-mono-technical text-[9px] text-on-surface-variant">
          Payload: any JSON. Include an <span className="text-primary">X-Webhook-Secret</span> header matching the connector&apos;s secret to authenticate.
        </p>
      </div>
    </div>
  );
}
