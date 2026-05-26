import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string; sourceId: string } }) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const source = await prisma.projectRagSource.update({
    where: { id: params.sourceId, projectId: params.id },
    data: {
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      name: typeof body.name === "string" ? body.name : undefined,
      config: body.config !== undefined ? (body.config as object) : undefined,
    },
  });
  return NextResponse.json(source);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; sourceId: string } }) {
  await prisma.projectRagSource.delete({
    where: { id: params.sourceId, projectId: params.id },
  });
  return NextResponse.json({ ok: true });
}
