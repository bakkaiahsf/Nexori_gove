import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { GovernanceEventType } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const actorEmail = session?.user?.email ?? "system";

  const govCase = await prisma.governanceCase.findUnique({ where: { id: params.id }, select: { id: true, projectId: true, status: true } });
  if (!govCase) return NextResponse.json({ error: "Case not found" }, { status: 404 });
  if (govCase.status === "active") return NextResponse.json({ error: "Case is already active" }, { status: 409 });

  await prisma.$transaction(async (tx) => {
    await tx.governanceCase.update({
      where: { id: params.id },
      data: { status: "active", resolvedAt: null, resolvedBy: null },
    });
    await tx.governanceEvent.create({
      data: {
        projectId: govCase.projectId,
        type: GovernanceEventType.CASE_REOPENED,
        actorEmail,
        resourceType: "governance-case",
        resourceId: govCase.id,
        payload: {},
      },
    });
  });

  return NextResponse.json({ ok: true });
}
