/**
 * Governance query helpers — used by Server Components and API routes.
 * All mutations are wrapped in DB transactions per CLAUDE.md §6.
 * Every governance mutation emits a GovernanceEvent per CLAUDE.md §9.
 */
import prisma from "@/lib/db";
import { GateStatus, ApprovalStatus, GovernanceEventType, AIControlMode } from "@prisma/client";

export const DEMO_PROJECT_KEY = "DORA-Q4-25";

// ── Health score calculation ──────────────────────────────────────────────────
// Formula: gate compliance (60%) + risk health (25%) + evidence coverage (15%)
export function computeHealthScore(
  approvedGates: number,
  totalGates: number,
  criticalRisks: number,
  totalRisks: number,
  evidenceMapped: number,
  totalEvidence: number
): number {
  const gateScore = totalGates > 0 ? (approvedGates / totalGates) * 60 : 60;
  const riskScore = totalRisks > 0 ? Math.max(0, 1 - (criticalRisks / totalRisks) * 0.8) * 25 : 25;
  const evidenceScore = totalEvidence > 0 ? (evidenceMapped / totalEvidence) * 15 : 15;
  return Math.min(100, Math.round((gateScore + riskScore + evidenceScore) * 10) / 10);
}

// ── Summary ───────────────────────────────────────────────────────────────────
export async function getProjectSummary(projectId: string) {
  const [
    totalGates,
    approvedGates,
    pendingApprovals,
    totalRisks,
    criticalRisks,
    openRisks,
    activeCases,
    totalEvidence,
    evidenceMapped,
    aiMode,
  ] = await Promise.all([
    prisma.governanceGate.count({ where: { case: { projectId } } }),
    prisma.governanceGate.count({ where: { case: { projectId }, status: GateStatus.APPROVED } }),
    prisma.approvalRequest.count({
      where: { status: ApprovalStatus.PENDING, gate: { case: { projectId } } },
    }),
    prisma.riskItem.count({ where: { projectId } }),
    prisma.riskItem.count({ where: { projectId, severity: "CRITICAL", status: "OPEN" } }),
    prisma.riskItem.count({ where: { projectId, status: { in: ["OPEN", "MITIGATING"] } } }),
    prisma.governanceCase.count({ where: { projectId, status: "active" } }),
    prisma.evidenceItem.count({ where: { projectId } }),
    prisma.regulatoryMapping.count({ where: { projectId } }),
    prisma.aIControlSetting.findUnique({ where: { projectId }, select: { mode: true } }),
  ]);

  const healthScore = computeHealthScore(
    approvedGates,
    totalGates,
    criticalRisks,
    totalRisks,
    evidenceMapped,
    totalEvidence
  );

  return {
    healthScore,
    totalGates,
    approvedGates,
    pendingApprovals,
    totalRisks,
    criticalRisks,
    openRisks,
    activeCases,
    totalEvidence,
    evidenceMapped,
    aiMode: aiMode?.mode ?? AIControlMode.AI_ASSIST,
  };
}

// ── Pending approvals (for approval pipeline table) ───────────────────────────
export async function getPendingApprovals(projectId: string) {
  return prisma.approvalRequest.findMany({
    where: {
      status: ApprovalStatus.PENDING,
      gate: { case: { projectId } },
    },
    include: {
      gate: {
        select: {
          id: true,
          name: true,
          case: { select: { title: true, phase: true } },
        },
      },
      requestedBy: { select: { name: true, email: true } },
    },
    orderBy: { requestedAt: "desc" },
    take: 10,
  });
}

// ── Critical + high escalations ───────────────────────────────────────────────
export async function getEscalations(projectId: string) {
  return prisma.riskItem.findMany({
    where: {
      projectId,
      severity: { in: ["CRITICAL", "HIGH"] },
      status: { in: ["OPEN", "MITIGATING"] },
    },
    orderBy: [{ severity: "desc" }, { raisedAt: "desc" }],
    take: 5,
  });
}

// ── GovernanceEvents (flight recorder) ───────────────────────────────────────
export async function getGovernanceEvents(projectId: string, take = 20) {
  return prisma.governanceEvent.findMany({
    where: { projectId },
    orderBy: { timestamp: "desc" },
    take,
  });
}

// ── Regulatory mappings (intelligence screen) ─────────────────────────────────
export async function getRegulatoryData(projectId: string) {
  const [mappings, frameworks, thirdParties] = await Promise.all([
    prisma.regulatoryMapping.findMany({
      where: { projectId },
      include: { evidence: { select: { title: true, type: true, submittedAt: true } } },
      orderBy: { mappedAt: "desc" },
      take: 20,
    }),
    prisma.regulatoryMapping.groupBy({
      by: ["framework"],
      where: { projectId },
      _count: { id: true },
    }),
    prisma.thirdPartyDependency.findMany({
      where: { projectId },
      orderBy: { criticality: "asc" },
    }),
  ]);
  return { mappings, frameworks, thirdParties };
}

// ── AI Control: read mode ─────────────────────────────────────────────────────
export async function getAIControlSetting(projectId: string) {
  return prisma.aIControlSetting.findUnique({
    where: { projectId },
    select: { mode: true, setBy: true, setAt: true, reason: true },
  });
}

// ── AI Control: set mode (transaction + event) ────────────────────────────────
export async function setAIControlMode(
  projectId: string,
  mode: AIControlMode,
  setBy: string,
  reason?: string
) {
  return prisma.$transaction(async (tx) => {
    const setting = await tx.aIControlSetting.update({
      where: { projectId },
      data: { mode, setBy, setAt: new Date(), reason },
    });
    await tx.governanceEvent.create({
      data: {
        projectId,
        type:
          mode === AIControlMode.EMERGENCY_LOCK
            ? GovernanceEventType.AI_EMERGENCY_LOCK
            : GovernanceEventType.AI_MODE_CHANGED,
        actorEmail: setBy,
        resourceType: "ai-control-setting",
        resourceId: setting.id,
        payload: { previousMode: null, newMode: mode, reason },
      },
    });
    return setting;
  });
}

// ── Approve gate (transaction + event) ───────────────────────────────────────
export async function approveRequest(
  approvalId: string,
  resolvedByEmail: string,
  notes?: string,
  opts: { triggerJiraSync?: boolean } = {}
) {
  const approval = await prisma.approvalRequest.findUniqueOrThrow({
    where: { id: approvalId },
    include: { gate: { include: { case: { select: { projectId: true } } } } },
  });

  const resolver = await prisma.user.findUnique({ where: { email: resolvedByEmail } });

  const result = await prisma.$transaction(async (tx) => {
    await tx.approvalRequest.update({
      where: { id: approvalId },
      data: {
        status: ApprovalStatus.APPROVED,
        resolvedById: resolver?.id,
        resolvedAt: new Date(),
        notes: notes ?? approval.notes,
      },
    });

    const pendingCount = await tx.approvalRequest.count({
      where: { gateId: approval.gateId, status: ApprovalStatus.PENDING },
    });
    if (pendingCount === 0) {
      await tx.governanceGate.update({
        where: { id: approval.gateId },
        data: { status: GateStatus.APPROVED, approvedAt: new Date(), approvedBy: resolvedByEmail },
      });
    }

    await tx.governanceEvent.create({
      data: {
        projectId: approval.gate.case.projectId,
        type: GovernanceEventType.APPROVAL_GRANTED,
        actorEmail: resolvedByEmail,
        actorId: resolver?.id,
        resourceType: "approval",
        resourceId: approvalId,
        payload: { gateName: approval.gate.name, notes },
      },
    });

    return { success: true, gateId: approval.gateId };
  });

  // Jira sync is fire-and-forget — failure must not block governance
  if (opts.triggerJiraSync) {
    try {
      const gate = await prisma.governanceGate.findUnique({
        where: { id: result.gateId },
        select: { sourceStoryKey: true, case: { select: { sourceConnectorId: true } } },
      });
      if (gate?.sourceStoryKey && gate.case.sourceConnectorId) {
        const { buildJiraConnector } = await import("@/lib/connectors/jira");
        const { syncGateApprovalToJira } = await import("@/lib/connectors/jira-writeback");
        const connector = await buildJiraConnector(gate.case.sourceConnectorId);
        await syncGateApprovalToJira(result.gateId, connector, resolvedByEmail);
      }
    } catch {
      // Jira sync failure is non-fatal
    }
  }

  return result;
}

// ── Reject gate (P0 fix — was missing) ───────────────────────────────────────
export async function rejectRequest(approvalId: string, resolvedByEmail: string, reason: string) {
  const approval = await prisma.approvalRequest.findUniqueOrThrow({
    where: { id: approvalId },
    include: { gate: { include: { case: { select: { projectId: true } } } } },
  });

  const resolver = await prisma.user.findUnique({ where: { email: resolvedByEmail } });

  return prisma.$transaction(async (tx) => {
    await tx.approvalRequest.update({
      where: { id: approvalId },
      data: {
        status: ApprovalStatus.REJECTED,
        resolvedById: resolver?.id,
        resolvedAt: new Date(),
        notes: reason,
      },
    });

    await tx.governanceGate.update({
      where: { id: approval.gateId },
      data: { status: GateStatus.REJECTED, rejectedAt: new Date(), rejectedBy: resolvedByEmail },
    });

    await tx.governanceEvent.create({
      data: {
        projectId: approval.gate.case.projectId,
        type: GovernanceEventType.APPROVAL_REJECTED,
        actorEmail: resolvedByEmail,
        actorId: resolver?.id,
        resourceType: "approval",
        resourceId: approvalId,
        payload: { gateName: approval.gate.name, reason },
      },
    });

    return { success: true };
  });
}

// ── Skip gate (adaptive pipeline — skip with documented reason) ──────────────
export async function skipGate(gateId: string, reason: string, actorEmail: string) {
  const gate = await prisma.governanceGate.findUniqueOrThrow({
    where: { id: gateId },
    include: { case: { select: { projectId: true } } },
  });

  return prisma.$transaction(async (tx) => {
    await tx.governanceGate.update({
      where: { id: gateId },
      data: { skipped: true, skipReason: reason },
    });

    await tx.governanceEvent.create({
      data: {
        projectId: gate.case.projectId,
        type: GovernanceEventType.GATE_SKIPPED,
        actorEmail,
        resourceType: "governance-gate",
        resourceId: gateId,
        payload: { gateName: gate.name, reason },
      },
    });

    return { success: true };
  });
}

// ── Inherit gate approval from a prior case ───────────────────────────────────
export async function inheritGateApproval(
  gateId: string,
  fromCaseId: string,
  rationale: string,
  actorEmail: string
) {
  const gate = await prisma.governanceGate.findUniqueOrThrow({
    where: { id: gateId },
    include: { case: { select: { projectId: true } } },
  });

  const priorCase = await prisma.governanceCase.findUniqueOrThrow({
    where: { id: fromCaseId },
    select: { title: true },
  });

  return prisma.$transaction(async (tx) => {
    await tx.governanceGate.update({
      where: { id: gateId },
      data: {
        status: GateStatus.APPROVED,
        approvedAt: new Date(),
        approvedBy: actorEmail,
        inheritedFrom: fromCaseId,
      },
    });

    await tx.governanceEvent.create({
      data: {
        projectId: gate.case.projectId,
        type: GovernanceEventType.APPROVAL_INHERITED,
        actorEmail,
        resourceType: "governance-gate",
        resourceId: gateId,
        payload: {
          gateName: gate.name,
          fromCaseId,
          fromCaseTitle: priorCase.title,
          rationale,
        },
      },
    });

    return { success: true };
  });
}
