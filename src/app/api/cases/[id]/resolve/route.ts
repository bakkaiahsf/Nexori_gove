import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { GovernanceEventType } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const Schema = z.object({ reason: z.string().optional() });

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const actorEmail = session?.user?.email ?? "system";

  const body = Schema.parse(await req.json().catch(() => ({}))).reason;

  const govCase = await prisma.governanceCase.findUnique({ where: { id: params.id }, select: { id: true, projectId: true, status: true } });
  if (!govCase) return NextResponse.json({ error: "Case not found" }, { status: 404 });
  if (govCase.status === "closed") return NextResponse.json({ error: "Case is already closed" }, { status: 409 });

  await prisma.$transaction(async (tx) => {
    await tx.governanceCase.update({
      where: { id: params.id },
      data: { status: "closed", resolvedAt: new Date(), resolvedBy: actorEmail },
    });
    await tx.governanceEvent.create({
      data: {
        projectId: govCase.projectId,
        type: GovernanceEventType.CASE_RESOLVED,
        actorEmail,
        resourceType: "governance-case",
        resourceId: govCase.id,
        payload: { reason: body ?? null },
      },
    });
  });

  return NextResponse.json({ ok: true });
}
