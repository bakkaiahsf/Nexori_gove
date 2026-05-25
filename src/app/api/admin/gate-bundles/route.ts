import prisma from "@/lib/db";
import { z } from "zod";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  name: z.string().min(1),
  stage: z.enum(["planning", "development", "pre-prod", "deployment"]),
  gateSlugs: z.array(z.string()),
  frameworks: z.array(z.string()).default([]),
  mandatory: z.boolean().default(false),
  projectId: z.string().optional(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  const bundles = await prisma.gateBundle.findMany({
    where: projectId ? { OR: [{ projectId: null }, { projectId }] } : { projectId: null },
    orderBy: [{ isBuiltIn: "desc" }, { stage: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(bundles);
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const bundle = await prisma.gateBundle.create({ data: parsed.data });
  return NextResponse.json(bundle, { status: 201 });
}
