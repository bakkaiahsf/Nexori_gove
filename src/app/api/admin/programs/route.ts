import prisma from "@/lib/db";
import { z } from "zod";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  ownerEmail: z.string().email().optional(),
});

export async function GET() {
  const programs = await prisma.program.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { projects: true } },
      projects: { select: { id: true, key: true, name: true, status: true } },
    },
  });
  return NextResponse.json(programs);
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const program = await prisma.program.create({ data: parsed.data });
  return NextResponse.json(program, { status: 201 });
}
