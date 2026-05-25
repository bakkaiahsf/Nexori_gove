import prisma from "@/lib/db";
import ConnectorsClient from "./ConnectorsClient";

export const dynamic = "force-dynamic";

export default async function ConnectorsPage() {
  const [connectors, recentEvaluations] = await Promise.all([
    prisma.sourceConnector.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { epics: true } } },
    }),
    prisma.triggerEvaluation.groupBy({
      by: ["connectorId", "matched"],
      where: { connectorId: { not: null } },
      _count: { id: true },
    }),
  ]);

  const enriched = connectors.map((c) => {
    const evalStats = recentEvaluations.filter((e) => e.connectorId === c.id);
    return {
      id: c.id,
      type: c.type,
      name: c.name,
      baseUrl: c.baseUrl,
      projectKeys: c.projectKeys,
      enabled: c.enabled,
      createdAt: c.createdAt,
      epicsCount: c._count.epics,
      matchedCount: evalStats.find((e) => e.matched)?._count.id ?? 0,
      skippedCount: evalStats.find((e) => !e.matched)?._count.id ?? 0,
    };
  });

  return (
    <>
      <header className="h-16 px-xl flex items-center justify-between border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <div className="flex items-center gap-xl">
          <h1 className="font-headline-md text-headline-md text-on-surface">Tool Connectors</h1>
          <span className="font-body-base text-body-base text-on-surface-variant">
            {connectors.filter((c) => c.enabled).length} active · Jira · GitHub · GitLab · Webhook
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-xl">
        <div className="max-w-[1100px] mx-auto space-y-lg">
          {/* How it works */}
          <div className="bg-surface border border-border-muted p-lg grid grid-cols-4 gap-lg">
            {[
              { icon: "hub", label: "Register Connector", desc: "Add Jira, GitHub, GitLab, or any enterprise tool via webhook" },
              { icon: "webhook", label: "Configure Webhook", desc: "Paste the generated webhook URL into your tool's settings" },
              { icon: "rule", label: "Set Trigger Rules", desc: "Define which events activate governance" },
              { icon: "account_tree", label: "Governance Fires", desc: "Events flow through risk scoring → adaptive pipeline → approvals" },
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

          <ConnectorsClient connectors={enriched} />
        </div>
      </div>

      <footer className="h-8 bg-surface-container-low border-t border-border-muted flex items-center px-xl font-mono-technical text-[10px] text-on-surface-variant shrink-0">
        <span>CONNECTORS: {connectors.filter((c) => c.enabled).length} ACTIVE · TOOL_AGNOSTIC_ENGINE: READY</span>
      </footer>
    </>
  );
}
