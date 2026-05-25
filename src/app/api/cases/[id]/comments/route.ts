import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { GovernanceEventType } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const Schema = z.object({ body: z.string().min(1).max(4000) });

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

  const comment = await prisma.$transaction(async (tx) => {
    const c = await tx.caseComment.create({
      data: { caseId: govCase.id, authorEmail: actorEmail, body: body.body },
    });
    await tx.governanceEvent.create({
      data: {
        projectId: govCase.projectId,
        type: GovernanceEventType.CASE_COMMENT_ADDED,
        actorEmail,
        resourceType: "governance-case",
        resourceId: govCase.id,
        payload: { commentId: c.id, preview: body.body.slice(0, 100) },
      },
    });
    return c;
  });

  return NextResponse.json({ ok: true, comment });
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  const comments = await prisma.caseComment.findMany({
    where: { caseId: params.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ comments });
}
