import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { DEMO_PROJECT_KEY } from "@/lib/governance";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get("format") ?? "json";

  const project = await prisma.project.findUnique({
    where: { key: DEMO_PROJECT_KEY },
    select: { id: true, name: true, key: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const [events, gates, evidence, risks, mappings, thirdParties] = await Promise.all([
    prisma.governanceEvent.findMany({
      where: { projectId: project.id },
      orderBy: { timestamp: "desc" },
      take: 500,
    }),
    prisma.governanceGate.findMany({
      where: { case: { projectId: project.id } },
      include: { case: { select: { title: true, phase: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.evidenceItem.findMany({
      where: { projectId: project.id },
      include: { regulatoryMappings: { select: { framework: true, controlId: true, verifiedAt: true } } },
      orderBy: { submittedAt: "desc" },
    }),
    prisma.riskItem.findMany({
      where: { projectId: project.id },
      orderBy: { raisedAt: "desc" },
    }),
    prisma.regulatoryMapping.findMany({
      where: { projectId: project.id },
      include: { evidence: { select: { title: true, type: true } } },
      orderBy: { mappedAt: "desc" },
    }),
    prisma.thirdPartyDependency.findMany({
      where: { projectId: project.id },
      orderBy: { registeredAt: "desc" },
    }),
  ]);

  const exportedAt = new Date().toISOString();

  if (format === "csv") {
    const rows: string[] = [
      "type,timestamp,actor,resource_type,resource_id,event_type,details",
      ...events.map((e) =>
        [
          "GovernanceEvent",
          e.timestamp.toISOString(),
          e.actorEmail ?? "system",
          e.resourceType ?? "",
          e.resourceId ?? "",
          e.type,
          JSON.stringify(e.payload ?? {}).replace(/"/g, '""'),
        ]
          .map((v) => `"${v}"`)
          .join(",")
      ),
    ];
    return new NextResponse(rows.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="nexori-audit-${project.key}-${exportedAt.slice(0, 10)}.csv"`,
      },
    });
  }

  const auditPack = {
    meta: {
      product: "NexoriOS",
      version: "0.1.0-MVP",
      exportedAt,
      project: { id: project.id, name: project.name, key: project.key },
      regulatory: ["DORA", "EU_AI_ACT", "SOC2", "ISO_27001", "PCI_DSS", "GDPR"],
      counts: {
        governanceEvents: events.length,
        governanceGates: gates.length,
        evidenceItems: evidence.length,
        riskItems: risks.length,
        regulatoryMappings: mappings.length,
        thirdPartyDependencies: thirdParties.length,
      },
    },
    governanceEvents: events,
    governanceGates: gates.map((g) => ({
      id: g.id,
      name: g.name,
      status: g.status,
      caseTitle: g.case.title,
      casePhase: g.case.phase,
      approvedAt: g.approvedAt,
      approvedBy: g.approvedBy,
      rejectedAt: g.rejectedAt,
      rejectedBy: g.rejectedBy,
      skipped: g.skipped,
      skipReason: g.skipReason,
      createdAt: g.createdAt,
    })),
    evidenceItems: evidence.map((e) => ({
      id: e.id,
      title: e.title,
      type: e.type,
      submittedBy: e.submittedBy,
      submittedAt: e.submittedAt,
      hash: e.hash,
      regulatoryMappings: e.regulatoryMappings,
    })),
    riskItems: risks,
    regulatoryMappings: mappings.map((m) => ({
      id: m.id,
      framework: m.framework,
      controlId: m.controlId,
      controlName: m.controlName,
      evidenceTitle: m.evidence.title,
      mappedBy: m.mappedBy,
      mappedAt: m.mappedAt,
      verifiedAt: m.verifiedAt,
      verifiedBy: m.verifiedBy,
    })),
    thirdPartyDependencies: thirdParties,
  };

  return new NextResponse(JSON.stringify(auditPack, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="nexori-audit-pack-${project.key}-${exportedAt.slice(0, 10)}.json"`,
    },
  });
}
