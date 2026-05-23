import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { GateDefinitionCreateSchema } from "@/schemas/ai";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const intensity = req.nextUrl.searchParams.get("intensity");
  const gates = await prisma.gateDefinition.findMany({
    where: {
      enabled: true,
      ...(intensity ? { intensityTriggers: { has: intensity } } : {}),
    },
    orderBy: [{ isBuiltIn: "desc" }, { defaultSlaHours: "asc" }],
  });
  return NextResponse.json({ gates });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = GateDefinitionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;

  const existing = await prisma.gateDefinition.findUnique({ where: { slug: data.slug } });
  if (existing) {
    return NextResponse.json({ error: `Gate slug "${data.slug}" already exists` }, { status: 409 });
  }

  const gate = await prisma.gateDefinition.create({
    data: {
      slug: data.slug,
      name: data.name,
      description: data.description,
      category: data.category,
      defaultSlaHours: data.defaultSlaHours,
      intensityTriggers: data.intensityTriggers,
      skipConditions: data.skipConditions
        ? (data.skipConditions as unknown as Prisma.InputJsonValue)
        : undefined,
      requiredEvidence: data.requiredEvidence ?? [],
      approverRoles: data.approverRoles,
      tenantId: data.tenantId,
      isBuiltIn: false,
    },
  });

  return NextResponse.json({ gate }, { status: 201 });
}
