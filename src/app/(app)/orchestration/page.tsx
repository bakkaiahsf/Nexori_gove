import prisma from "@/lib/db";
import OrchestrationClient from "./OrchestrationClient";
import type { OrchestrationCase, SourceGroup, EnterpriseStats, ConnectorHealth } from "./types";

export const dynamic = "force-dynamic";

function buildStats(cases: OrchestrationCase[]) {
  return {
    total: cases.length,
    enhanced: cases.filter((c) => c.riskScore?.intensity === "enhanced").length,
    regulated: cases.filter((c) => c.riskScore?.intensity === "regulated").length,
    blocked: cases.filter((c) => c.gates.some((g) => g.status === "REJECTED" && !g.skipped)).length,
    pending: cases.filter((c) => c.gates.some((g) => g.pendingApprovalId && !g.skipped)).length,
    waivers: cases.reduce((sum, c) => sum + c.waiverCount, 0),
  };
}

function deriveSourceType(sourceEpicKey: string | null, connectorType: string | null): string {
  if (!sourceEpicKey && !connectorType) return "manual";
  if (connectorType) return connectorType;
  // Infer from key format
  if (sourceEpicKey?.includes("#")) return "github";
  if (sourceEpicKey?.includes("!")) return "gitlab";
  return "jira";
}

export default async function OrchestrationPage() {
  const [projects, connectors, allEvals, allWaivers, aiSettings] = await Promise.all([
    prisma.project.findMany({
      select: { id: true, key: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.sourceConnector.findMany({
      select: {
        id: true,
        type: true,
        name: true,
        baseUrl: true,
        enabled: true,
        projectKeys: true,
      },
    }),
    // Last 500 evaluations across all projects for trigger analysis
    prisma.triggerEvaluation.findMany({
      orderBy: { evaluatedAt: "desc" },
      take: 500,
      select: {
        caseId: true,
        projectId: true,
        sourceType: true,
        eventType: true,
        action: true,
        matched: true,
        evaluatedAt: true,
        ruleId: true,
        connectorId: true,
      },
    }),
    prisma.governanceWaiver.groupBy({
      by: ["caseId"],
      where: { caseId: { not: null } },
      _count: { id: true },
    }),
    prisma.aIControlSetting.findMany({
      select: { projectId: true, mode: true },
    }),
  ]);

  const projectIds = projects.map((p) => p.id);

  // Fetch all governance cases across all projects
  const cases = await prisma.governanceCase.findMany({
    where: { projectId: { in: projectIds } },
    include: {
      governanceGates: {
        include: {
          approvalRequests: {
            where: { status: "PENDING" },
            orderBy: { requestedAt: "desc" },
            take: 1,
          },
        },
        orderBy: { order: "asc" },
      },
      context: {
        select: {
          aiSystemInvolved: true,
          thirdPartyChanges: true,
          infrastructureChange: true,
          dataClassification: true,
          environment: true,
          enrichedAt: true,
          contextSummary: true,
        },
      },
      riskScore: {
        select: {
          compositeScore: true,
          intensity: true,
          aiModeRecommended: true,
          scoredAt: true,
        },
      },
      adaptivePipeline: {
        select: {
          totalGateCount: true,
          reducedFromBaseline: true,
          composedAt: true,
        },
      },
      _count: { select: { evidenceItems: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 300,
  });

  // Build lookup maps
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const connectorById = new Map(connectors.map((c) => [c.id, c]));
  const triggerByCaseId = new Map(allEvals.map((e) => [e.caseId, e]));
  const waiverByCaseId = new Map(allWaivers.map((w) => [w.caseId, w._count.id]));
  const aiModeByProjectId = new Map(aiSettings.map((s) => [s.projectId, s.mode]));

  // Serialise cases
  const serialised: OrchestrationCase[] = cases
    .map((c) => {
      const project = projectById.get(c.projectId);
      if (!project) return null;
      const connector = c.sourceConnectorId ? connectorById.get(c.sourceConnectorId) : null;
      const trig = c.id ? triggerByCaseId.get(c.id) : undefined;
      const sourceType = deriveSourceType(c.sourceEpicKey, connector?.type ?? null);

      return {
        id: c.id,
        title: c.title,
        description: c.description,
        phase: c.phase,
        status: c.status,
        sourceEpicKey: c.sourceEpicKey,
        sourceGovEpicKey: c.sourceGovEpicKey,
        sourceConnectorId: c.sourceConnectorId,
        sourceType,
        createdAt: c.createdAt.toISOString(),
        project: { id: project.id, key: project.key, name: project.name },
        context: c.context
          ? {
              aiSystemInvolved: c.context.aiSystemInvolved,
              thirdPartyChanges: c.context.thirdPartyChanges,
              infrastructureChange: c.context.infrastructureChange,
              dataClassification: c.context.dataClassification,
              environment: c.context.environment,
              enrichedAt: c.context.enrichedAt.toISOString(),
              contextSummary: c.context.contextSummary,
            }
          : null,
        riskScore: c.riskScore
          ? {
              compositeScore: c.riskScore.compositeScore,
              intensity: c.riskScore.intensity,
              aiModeRecommended: c.riskScore.aiModeRecommended,
              scoredAt: c.riskScore.scoredAt.toISOString(),
            }
          : null,
        adaptivePipeline: c.adaptivePipeline
          ? {
              totalGateCount: c.adaptivePipeline.totalGateCount,
              reducedFromBaseline: c.adaptivePipeline.reducedFromBaseline,
              composedAt: c.adaptivePipeline.composedAt.toISOString(),
            }
          : null,
        gates: c.governanceGates.map((g) => ({
          id: g.id,
          name: g.name,
          order: g.order,
          status: g.status,
          skipped: g.skipped,
          skipReason: g.skipReason,
          inheritedFrom: g.inheritedFrom,
          approvedAt: g.approvedAt?.toISOString() ?? null,
          approvedBy: g.approvedBy,
          rejectedAt: g.rejectedAt?.toISOString() ?? null,
          pendingApprovalId: g.approvalRequests[0]?.id ?? null,
        })),
        evidenceCount: c._count.evidenceItems,
        waiverCount: waiverByCaseId.get(c.id) ?? 0,
        triggerEval: trig
          ? {
              evaluatedAt: trig.evaluatedAt.toISOString(),
              sourceType: trig.sourceType,
              eventType: trig.eventType,
              action: trig.action,
            }
          : null,
      } satisfies OrchestrationCase;
    })
    .filter((c): c is OrchestrationCase => c !== null);

  // Group by source type
  const sourceTypeOrder = ["jira", "github", "gitlab", "manual"];
  const bySourceType = new Map<string, OrchestrationCase[]>();
  for (const c of serialised) {
    const arr = bySourceType.get(c.sourceType) ?? [];
    arr.push(c);
    bySourceType.set(c.sourceType, arr);
  }

  const sourceGroups: SourceGroup[] = sourceTypeOrder
    .filter((st) => bySourceType.has(st))
    .map((st) => {
      const stCases = bySourceType.get(st) ?? [];
      // Find the connector most associated with this source type
      const primaryConnector = connectors.find((c) => c.type === st) ?? null;
      const lastEvalForType = allEvals.find((e) => e.sourceType === st && e.connectorId);

      return {
        sourceType: st,
        connector: primaryConnector
          ? {
              id: primaryConnector.id,
              type: primaryConnector.type,
              name: primaryConnector.name,
              baseUrl: primaryConnector.baseUrl,
              enabled: primaryConnector.enabled,
              lastEventAt: lastEvalForType?.evaluatedAt.toISOString() ?? null,
            }
          : null,
        cases: stCases,
        stats: buildStats(stCases),
      };
    });

  // Add manual group if exists
  if (!sourceTypeOrder.includes("manual") && bySourceType.has("manual")) {
    const manualCases = bySourceType.get("manual") ?? [];
    sourceGroups.push({
      sourceType: "manual",
      connector: null,
      cases: manualCases,
      stats: buildStats(manualCases),
    });
  }

  // Enterprise-wide stats
  const scores = serialised.filter((c) => c.riskScore).map((c) => c.riskScore!.compositeScore);
  const avgRiskScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  const aiModes: Record<string, number> = {};
  for (const mode of aiModeByProjectId.values()) {
    aiModes[mode] = (aiModes[mode] ?? 0) + 1;
  }

  const enterpriseStats: EnterpriseStats = {
    totalProjects: projects.length,
    totalCases: serialised.length,
    enhanced: serialised.filter((c) => c.riskScore?.intensity === "enhanced").length,
    regulated: serialised.filter((c) => c.riskScore?.intensity === "regulated").length,
    blocked: serialised.filter((c) => c.gates.some((g) => g.status === "REJECTED" && !g.skipped))
      .length,
    pending: serialised.filter((c) => c.gates.some((g) => g.pendingApprovalId && !g.skipped))
      .length,
    waivers: serialised.reduce((sum, c) => sum + c.waiverCount, 0),
    avgRiskScore: Math.round(avgRiskScore * 100) / 100,
    aiModes,
  };

  // Connector health
  const evalsByConnector = new Map<string, typeof allEvals>();
  for (const e of allEvals) {
    if (!e.connectorId) continue;
    const arr = evalsByConnector.get(e.connectorId) ?? [];
    arr.push(e);
    evalsByConnector.set(e.connectorId, arr);
  }

  const connectorHealth: ConnectorHealth[] = connectors.map((c) => {
    const evs = evalsByConnector.get(c.id) ?? [];
    return {
      id: c.id,
      type: c.type,
      name: c.name,
      enabled: c.enabled,
      eventCount: evs.length,
      matchedCount: evs.filter((e) => e.matched).length,
      lastEventAt: evs[0]?.evaluatedAt.toISOString() ?? null,
    };
  });

  return (
    <OrchestrationClient
      sourceGroups={sourceGroups}
      enterpriseStats={enterpriseStats}
      connectorHealth={connectorHealth}
      projectCount={projects.length}
    />
  );
}
