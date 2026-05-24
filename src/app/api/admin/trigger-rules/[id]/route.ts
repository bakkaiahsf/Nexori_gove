import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { enabled, priority, name } = body as {
    enabled?: boolean;
    priority?: number;
    name?: string;
  };

  const rule = await prisma.governanceTriggerRule.update({
    where: { id: params.id },
    data: {
      ...(typeof enabled === "boolean" && { enabled }),
      ...(typeof priority === "number" && { priority }),
      ...(name && { name }),
    },
  });

  return NextResponse.json(rule);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.governanceTriggerRule.delete({ where: { id: params.id } });
  return NextResponse.json({ deleted: true });
}
