import prisma from "@/lib/db";
import { z } from "zod";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  ownerEmail: z.string().email().optional(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  projectIds: z.array(z.string()).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { projectIds, ...rest } = parsed.data;

  const program = await prisma.$transaction(async (tx) => {
    if (projectIds !== undefined) {
      await tx.project.updateMany({
        where: { programId: id },
        data: { programId: null },
      });
      await tx.project.updateMany({
        where: { id: { in: projectIds } },
        data: { programId: id },
      });
    }
    return tx.program.update({ where: { id }, data: rest });
  });

  return NextResponse.json(program);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.project.updateMany({ where: { programId: id }, data: { programId: null } });
  await prisma.program.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
