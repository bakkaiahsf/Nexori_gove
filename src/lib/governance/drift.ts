import prisma from "@/lib/db";

export interface DriftSignal {
  type: "STALE_EVIDENCE" | "EXPIRED_APPROVAL" | "ORPHANED_WAIVER" | "AI_MODE_UNCHANGED" | "BLOCKED_NO_EVIDENCE";
  caseId?: string;
  caseTitle?: string;
  message: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  daysSince?: number;
}

export interface DriftSummary {
  signals: DriftSignal[];
  highCount: number;
  mediumCount: number;
  lowCount: number;
  isClean: boolean;
}

const STALE_EVIDENCE_DAYS = 90;
const STALE_APPROVAL_DAYS = 60;
const AI_MODE_STALENESS_DAYS = 30;
const BLOCKED_NO_EVIDENCE_DAYS = 14;

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

export async function computeDrift(projectIds: string[]): Promise<DriftSummary> {
  if (projectIds.length === 0) return { signals: [], highCount: 0, mediumCount: 0, lowCount: 0, isClean: true };

  const signals: DriftSignal[] = [];

  const [activeCases, aiSettings] = await Promise.all([
    prisma.governanceCase.findMany({
      where: { projectId: { in: projectIds }, status: "active" },
      select: {
        id: true,
        title: true,
        createdAt: true,
        governanceGates: {
          select: { id: true, status: true, approvedAt: true, skipped: true },
        },
      },
    }),
    prisma.aIControlSetting.findMany({
      where: { projectId: { in: projectIds } },
      select: { projectId: true, setAt: true },
    }),
  ]);

  const caseIds = activeCases.map((c) => c.id);

  const [staleEvidence, waivers] = await Promise.all([
    caseIds.length > 0
      ? prisma.evidenceItem.findMany({
          where: {
            caseId: { in: caseIds },
            submittedAt: { lt: new Date(Date.now() - STALE_EVIDENCE_DAYS * 24 * 60 * 60 * 1000) },
          },
          select: { id: true, caseId: true, submittedAt: true },
          take: 50,
        })
      : Promise.resolve([]),
    caseIds.length > 0
      ? prisma.governanceWaiver.findMany({
          where: {
            caseId: { in: caseIds },
            status: "approved",
            expiresAt: { lt: new Date() },
          },
          select: { id: true, caseId: true, expiresAt: true, waiverType: true },
        })
      : Promise.resolve([]),
  ]);

  // Stale evidence — old evidence on active cases
  const staleByCase = new Map<string, number>();
  for (const e of staleEvidence) {
    if (e.caseId) staleByCase.set(e.caseId, (staleByCase.get(e.caseId) ?? 0) + 1);
  }
  for (const [caseId, count] of staleByCase) {
    const c = activeCases.find((x) => x.id === caseId);
    if (c) {
      const oldest = staleEvidence
        .filter((e) => e.caseId === caseId)
        .reduce((min, e) => (e.submittedAt < min ? e.submittedAt : min), new Date());
      signals.push({
        type: "STALE_EVIDENCE",
        caseId,
        caseTitle: c.title,
        message: `${count} evidence item${count !== 1 ? "s" : ""} over ${STALE_EVIDENCE_DAYS} days old — may require re-verification`,
        severity: daysSince(oldest) > 180 ? "HIGH" : "MEDIUM",
        daysSince: daysSince(oldest),
      });
    }
  }

  // Expired gate approvals on active cases
  for (const c of activeCases) {
    for (const gate of c.governanceGates) {
      if (gate.status === "APPROVED" && !gate.skipped && gate.approvedAt) {
        const days = daysSince(gate.approvedAt);
        if (days > STALE_APPROVAL_DAYS) {
          signals.push({
            type: "EXPIRED_APPROVAL",
            caseId: c.id,
            caseTitle: c.title,
            message: `Gate approval is ${days} days old — review if architecture has changed`,
            severity: days > 120 ? "HIGH" : "MEDIUM",
            daysSince: days,
          });
          break; // one signal per case
        }
      }
    }
  }

  // Orphaned waivers
  for (const w of waivers) {
    const c = activeCases.find((x) => x.id === w.caseId);
    signals.push({
      type: "ORPHANED_WAIVER",
      caseId: w.caseId ?? undefined,
      caseTitle: c?.title,
      message: `${w.waiverType.replace("-", " ")} waiver expired — re-authorisation required`,
      severity: "HIGH",
    });
  }

  // AI mode staleness
  for (const setting of aiSettings) {
    const days = daysSince(setting.setAt);
    if (days > AI_MODE_STALENESS_DAYS) {
      signals.push({
        type: "AI_MODE_UNCHANGED",
        message: `AI control mode unchanged for ${days} days — confirm this reflects current operating policy`,
        severity: "LOW",
        daysSince: days,
      });
    }
  }

  // Blocked gates with no recent evidence
  const threshold = new Date(Date.now() - BLOCKED_NO_EVIDENCE_DAYS * 24 * 60 * 60 * 1000);
  for (const c of activeCases) {
    const blockedGates = c.governanceGates.filter((g) => g.status === "REJECTED" && !g.skipped);
    if (blockedGates.length > 0) {
      const recentEvidence = await prisma.evidenceItem.count({
        where: { caseId: c.id, submittedAt: { gt: threshold } },
      });
      if (recentEvidence === 0) {
        signals.push({
          type: "BLOCKED_NO_EVIDENCE",
          caseId: c.id,
          caseTitle: c.title,
          message: `${blockedGates.length} blocked gate${blockedGates.length !== 1 ? "s" : ""} with no new evidence in ${BLOCKED_NO_EVIDENCE_DAYS} days`,
          severity: "HIGH",
        });
      }
    }
  }

  const highCount = signals.filter((s) => s.severity === "HIGH").length;
  const mediumCount = signals.filter((s) => s.severity === "MEDIUM").length;
  const lowCount = signals.filter((s) => s.severity === "LOW").length;

  return { signals, highCount, mediumCount, lowCount, isClean: signals.length === 0 };
}
