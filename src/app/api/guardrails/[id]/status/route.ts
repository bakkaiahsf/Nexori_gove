import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const push = await prisma.guardrailPush.findUnique({
    where: { id: params.id },
    select: { id: true, status: true, prUrl: true, prNumber: true, mergedAt: true, generatedAt: true },
  });
  if (!push) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(push);
}
