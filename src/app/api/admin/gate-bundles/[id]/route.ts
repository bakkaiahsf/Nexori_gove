import prisma from "@/lib/db";
import { z } from "zod";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  stage: z.enum(["planning", "development", "pre-prod", "deployment"]).optional(),
  gateSlugs: z.array(z.string()).optional(),
  frameworks: z.array(z.string()).optional(),
  mandatory: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const bundle = await prisma.gateBundle.update({ where: { id }, data: parsed.data });
  return NextResponse.json(bundle);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = await prisma.gateBundle.findUnique({ where: { id } });
  if (bundle?.isBuiltIn) {
    return NextResponse.json({ error: "Cannot delete built-in bundles" }, { status: 403 });
  }
  await prisma.gateBundle.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
