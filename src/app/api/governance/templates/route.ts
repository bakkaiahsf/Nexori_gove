import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";

export async function GET() {
  const templates = await prisma.governanceTemplate.findMany({
    where: { enabled: true },
    orderBy: [{ isBuiltIn: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      icon: true,
      effort: true,
      stages: true,
      suggestedFrameworks: true,
      suggestedDomains: true,
      isBuiltIn: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ templates });
}

const CreateTemplateSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  icon: z.string().optional(),
  effort: z.enum(["LOW", "MEDIUM", "HIGH", "CUSTOM"]).default("MEDIUM"),
  stages: z
    .array(
      z.object({
        stage: z.string().min(1),
        gateCategories: z.array(z.string()).default([]),
        gateHints: z.array(z.string()).default([]),
      })
    )
    .default([]),
  suggestedFrameworks: z.array(z.string()).default([]),
  suggestedDomains: z.array(z.string()).default([]),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { name, description, icon, effort, stages, suggestedFrameworks, suggestedDomains } =
    parsed.data;

  const template = await prisma.governanceTemplate.create({
    data: {
      name,
      description: description ?? null,
      icon: icon ?? null,
      effort,
      stages,
      suggestedFrameworks,
      suggestedDomains,
      isBuiltIn: false,
    },
  });

  return NextResponse.json(template, { status: 201 });
}
