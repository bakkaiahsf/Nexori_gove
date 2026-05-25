import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ cases: [], events: [], risks: [], evidence: [] });

  const projectId = req.nextUrl.searchParams.get("projectId");
  const project = projectId
    ? await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } })
    : await prisma.project.findFirst({ where: { status: "active" }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!project) return NextResponse.json({ cases: [], events: [], risks: [], evidence: [] });

  const [cases, events, risks, evidence] = await Promise.all([
    prisma.governanceCase.findMany({
      where: {
        projectId: project.id,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, title: true, phase: true, status: true },
      take: 5,
    }),
    prisma.governanceEvent.findMany({
      where: {
        projectId: project.id,
        actorEmail: { contains: q, mode: "insensitive" },
      },
      select: { id: true, type: true, actorEmail: true, timestamp: true },
      orderBy: { timestamp: "desc" },
      take: 5,
    }),
    prisma.riskItem.findMany({
      where: {
        projectId: project.id,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, title: true, severity: true, status: true },
      take: 5,
    }),
    prisma.evidenceItem.findMany({
      where: {
        projectId: project.id,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, title: true, type: true },
      take: 5,
    }),
  ]);

  return NextResponse.json({ cases, events, risks, evidence });
}
