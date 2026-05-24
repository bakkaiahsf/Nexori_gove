import prisma from "@/lib/db";
import { DEMO_PROJECT_KEY } from "@/lib/governance";
import Link from "next/link";

export const dynamic = "force-dynamic";

const CONNECTOR_META: Record<string, { icon: string; color: string; webhookDesc: string; events: string[] }> = {
  jira: {
    icon: "J",
    color: "text-primary border-primary bg-primary/10",
    webhookDesc: "POST /api/webhooks/jira?connectorId={id}",
    events: ["Epic created", "Epic updated", "Issue created (with trigger rules)", "Portfolio Epic"],
  },
  github: {
    icon: "G",
    color: "text-tertiary border-tertiary bg-tertiary/10",
    webhookDesc: "POST /api/webhooks/github?connectorId={id}",
    events: ["PR opened", "PR merged", "PR closed", "PR synchronize"],
  },
  gitlab: {
    icon: "GL",
    color: "text-primary border-primary bg-primary/10",
    webhookDesc: "POST /api/webhooks/gitlab?connectorId={id}",
    events: ["MR opened", "MR merged", "MR closed", "MR updated"],
  },
};

export default async function ConnectorsPage() {
  const project = await prisma.project.findUnique({
    where: { key: DEMO_PROJECT_KEY },
    select: { id: true, name: true },
  });

  const connectors = await prisma.sourceConnector.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { epics: true } },
    },
  });

  const recentEvaluations = await prisma.triggerEvaluation.groupBy({
    by: ["connectorId", "matched"],
    where: { connectorId: { not: null } },
    _count: { id: true },
  });

  return (
    <>
      <header className="h-16 px-xl flex items-center justify-between border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <div className="flex items-center gap-xl">
          <h1 className="font-headline-md text-headline-md text-on-surface">Tool Connectors</h1>
          <span className="font-body-base text-body-base text-on-surface-variant">
            {connectors.length} registered · Jira · GitHub · GitLab
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-xl">
        <div className="max-w-[1100px] mx-auto space-y-lg">

          {/* How it works */}
          <div className="bg-surface border border-border-muted p-lg grid grid-cols-4 gap-lg">
            {[
              { icon: "hub",           label: "Register Connector",    desc: "Add Jira, GitHub, or GitLab with credentials and project keys" },
              { icon: "webhook",       label: "Configure Webhook",     desc: "Set the NexoriOS webhook URL in your tool's settings" },
              { icon: "rule",          label: "Set Trigger Rules",     desc: "Define which events should activate governance" },
              { icon: "account_tree",  label: "Governance Fires",      desc: "Matching events flow through scoring → pipeline → approval" },
            ].map((step) => (
              <div key={step.label} className="text-center space-y-sm">
                <div className="w-8 h-8 bg-primary/10 border border-primary mx-auto flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>{step.icon}</span>
                </div>
                <p className="font-body-bold text-body-bold text-on-surface text-[12px]">{step.label}</p>
                <p className="font-mono-technical text-[10px] text-on-surface-variant">{step.desc}</p>
              </div>
            ))}
          </div>

          {/* Connectors */}
          {connectors.length === 0 ? (
            <div className="bg-surface border border-border-muted p-xl text-center space-y-md">
              <p className="font-body-bold text-body-bold text-on-surface">No connectors registered yet</p>
              <p className="font-body-base text-body-base text-on-surface-variant text-[12px]">
                Use the Integrations API or seed script to register your first Jira, GitHub, or GitLab connector.
              </p>
              <Link
                href="/api/integrations"
                className="inline-block px-xl py-sm border border-primary text-primary font-mono-technical text-[11px] hover:bg-primary/10 transition-colors"
              >
                VIEW INTEGRATIONS API →
              </Link>
            </div>
          ) : (
            connectors.map((c) => {
              const meta = CONNECTOR_META[c.type] ?? { icon: "?", color: "text-on-surface border-border-muted", webhookDesc: "", events: [] };
              const evalStats = recentEvaluations.filter((e) => e.connectorId === c.id);
              const matchedCount = evalStats.find((e) => e.matched)?._count.id ?? 0;
              const skippedCount = evalStats.find((e) => !e.matched)?._count.id ?? 0;

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
                      <p className="font-mono-technical text-[10px] text-on-surface-variant">
                        Projects: {c.projectKeys.join(", ")}
                      </p>
                    </div>
                    <div className="text-right shrink-0 space-y-xs">
                      <p className="font-mono-technical text-[10px] text-on-surface-variant">
                        {c._count.epics} SNAPSHOTS
                      </p>
                      <p className="font-mono-technical text-[10px] text-primary">{matchedCount} MATCHED</p>
                      <p className="font-mono-technical text-[10px] text-on-surface-variant">{skippedCount} SKIPPED</p>
                    </div>
                  </div>

                  {/* Webhook config */}
                  <div className="px-xl py-lg grid grid-cols-2 gap-lg">
                    <div>
                      <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest mb-sm">WEBHOOK ENDPOINT</p>
                      <div className="bg-surface-container-low border border-border-muted px-md py-sm">
                        <code className="font-mono-technical text-[11px] text-primary break-all">
                          {meta.webhookDesc.replace("{id}", c.id)}
                        </code>
                      </div>
                      <p className="font-mono-technical text-[10px] text-on-surface-variant mt-xs">
                        Configure this URL in your {c.type} webhook settings
                      </p>
                    </div>
                    <div>
                      <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest mb-sm">EVENTS HANDLED</p>
                      <div className="flex flex-wrap gap-sm">
                        {meta.events.map((ev) => (
                          <span key={ev} className="px-2 py-0.5 bg-surface-container-high border border-border-muted font-mono-technical text-[10px] text-on-surface-variant">
                            {ev}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Available connectors not yet registered */}
          <div className="bg-surface border border-border-muted">
            <div className="px-xl py-lg border-b border-border-muted">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">AVAILABLE CONNECTORS</h3>
            </div>
            <div className="divide-y divide-border-muted">
              {[
                { type: "jira",           label: "Atlassian Jira",   desc: "Portfolio Epics, Issues, Sprints", status: connectors.some((c) => c.type === "jira") ? "REGISTERED" : "AVAILABLE" },
                { type: "github",         label: "GitHub",           desc: "Pull Requests, Releases, Actions", status: connectors.some((c) => c.type === "github") ? "REGISTERED" : "AVAILABLE" },
                { type: "gitlab",         label: "GitLab",           desc: "Merge Requests, Pipelines",        status: connectors.some((c) => c.type === "gitlab") ? "REGISTERED" : "AVAILABLE" },
                { type: "azure-devops",   label: "Azure DevOps",     desc: "Work Items, Pipelines, Repos",     status: "COMING SOON" },
                { type: "servicenow",     label: "ServiceNow",       desc: "Change Requests, Incidents",       status: "COMING SOON" },
                { type: "linear",         label: "Linear",           desc: "Issues, Projects, Cycles",         status: "COMING SOON" },
              ].map((ct) => (
                <div key={ct.type} className="px-xl py-md flex items-center gap-lg hover:bg-surface-container-low transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-md">
                      <span className="font-body-bold text-body-bold text-on-surface text-[13px]">{ct.label}</span>
                      <span className={`px-2 py-0.5 font-mono-technical text-[9px] border ${
                        ct.status === "REGISTERED" ? "text-primary border-primary bg-primary/10"
                        : ct.status === "AVAILABLE" ? "text-tertiary border-tertiary"
                        : "text-on-surface-variant border-border-muted"
                      }`}>
                        {ct.status}
                      </span>
                    </div>
                    <p className="font-mono-technical text-[10px] text-on-surface-variant">{ct.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <footer className="h-8 bg-surface-container-low border-t border-border-muted flex items-center px-xl font-mono-technical text-[10px] text-on-surface-variant shrink-0">
        <span>CONNECTORS: {connectors.filter((c) => c.enabled).length} ACTIVE · TOOL_AGNOSTIC_ENGINE: READY</span>
      </footer>
    </>
  );
}
