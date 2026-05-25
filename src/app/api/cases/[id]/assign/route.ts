import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { GovernanceEventType } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const Schema = z.object({ ownedBy: z.string().email() });

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const actorEmail = session?.user?.email ?? "system";

  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: "Invalid request", detail: String(err) }, { status: 400 });
  }

  const govCase = await prisma.governanceCase.findUnique({ where: { id: params.id }, select: { id: true, projectId: true } });
  if (!govCase) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.governanceCase.update({ where: { id: params.id }, data: { ownedBy: body.ownedBy } });
    await tx.governanceEvent.create({
      data: {
        projectId: govCase.projectId,
        type: GovernanceEventType.CASE_ASSIGNED,
        actorEmail,
        resourceType: "governance-case",
        resourceId: govCase.id,
        payload: { assignedTo: body.ownedBy },
      },
    });
  });

  return NextResponse.json({ ok: true });
}
