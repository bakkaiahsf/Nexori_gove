import prisma from "@/lib/db";
import { DEMO_PROJECT_KEY } from "@/lib/governance";
import OrchestrationClient from "./OrchestrationClient";
import type { ConnectorGroup, OrchestrationCase } from "./types";

export const dynamic = "force-dynamic";

export default async function OrchestrationPage() {
  const project = await prisma.project.findUnique({
    where: { key: DEMO_PROJECT_KEY },
    select: { id: true, name: true, key: true },
  });

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="font-mono-technical text-on-surface-variant text-[12px]">
          No project — run: <code className="text-primary">npx prisma db seed</code>
        </p>
      </div>
    );
  }

  // Fetch everything needed for the orchestration view in parallel
  const [cases, connectors, triggerEvals, waiverCounts, aiSetting] = await Promise.all([
    prisma.governanceCase.findMany({
      where: { projectId: project.id },
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
    }),

    prisma.sourceConnector.findMany({
      select: { id: true, type: true, name: true, baseUrl: true, projectKeys: true, enabled: true },
    }),

    prisma.triggerEvaluation.findMany({
      where: { projectId: project.id, matched: true },
      orderBy: { evaluatedAt: "desc" },
      select: { caseId: true, sourceType: true, eventType: true, action: true, evaluatedAt: true },
    }),

    prisma.governanceWaiver.groupBy({
      by: ["caseId"],
      where: { projectId: project.id, caseId: { not: null } },
      _count: { id: true },
    }),

    prisma.aIControlSetting.findUnique({
      where: { projectId: project.id },
      select: { mode: true },
    }),
  ]);

  // Build lookup maps
  const triggerByCaseId = new Map(triggerEvals.map((e) => [e.caseId, e]));
  const waiverByCaseId = new Map(waiverCounts.map((w) => [w.caseId, w._count.id]));
  const connectorById = new Map(connectors.map((c) => [c.id, c]));

  // Serialise cases to plain objects for the client
  const serialisedCases: OrchestrationCase[] = cases.map((c) => {
    const trig = triggerByCaseId.get(c.id);
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      phase: c.phase,
      status: c.status,
      sourceEpicKey: c.sourceEpicKey,
      sourceGovEpicKey: c.sourceGovEpicKey,
      sourceConnectorId: c.sourceConnectorId,
      createdAt: c.createdAt.toISOString(),
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
    };
  });

  // Group cases by connector
  const groups: ConnectorGroup[] = [];

  // Cases with a connector
  for (const connector of connectors) {
    const connectorCases = serialisedCases.filter((c) => c.sourceConnectorId === connector.id);
    if (connectorCases.length === 0) continue;
    groups.push({
      connector: {
        id: connector.id,
        type: connector.type,
        name: connector.name,
        baseUrl: connector.baseUrl,
        projectKeys: connector.projectKeys,
      },
      cases: connectorCases,
      stats: buildStats(connectorCases),
    });
  }

  // Unlinked cases (created manually or connector deleted)
  const unlinkedCases = serialisedCases.filter(
    (c) => !c.sourceConnectorId || !connectorById.has(c.sourceConnectorId)
  );
  if (unlinkedCases.length > 0) {
    groups.push({
      connector: null,
      cases: unlinkedCases,
      stats: buildStats(unlinkedCases),
    });
  }

  const programStats = {
    totalCases: serialisedCases.length,
    enhanced: serialisedCases.filter((c) => c.riskScore?.intensity === "enhanced").length,
    regulated: serialisedCases.filter((c) => c.riskScore?.intensity === "regulated").length,
    blocked: serialisedCases.filter((c) =>
      c.gates.some((g) => g.status === "REJECTED" && !g.skipped)
    ).length,
    pending: serialisedCases.filter((c) =>
      c.gates.some((g) => g.pendingApprovalId && !g.skipped)
    ).length,
    waivers: serialisedCases.reduce((sum, c) => sum + c.waiverCount, 0),
    aiMode: aiSetting?.mode ?? "AI_ASSIST",
  };

  return (
    <OrchestrationClient
      projectName={project.name}
      groups={groups}
      programStats={programStats}
    />
  );
}

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
