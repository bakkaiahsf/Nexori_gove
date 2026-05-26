import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  type: z.enum(["confluence", "github-path", "gitlab-path", "url", "policy-corpus"]),
  name: z.string().min(1),
  config: z.record(z.unknown()),
  enabled: z.boolean().default(true),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const sources = await prisma.projectRagSource.findMany({
    where: { projectId: params.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(sources);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const source = await prisma.projectRagSource.create({
    data: {
      projectId: params.id,
      type: parsed.data.type,
      name: parsed.data.name,
      enabled: parsed.data.enabled,
      config: parsed.data.config as object,
    },
  });

  return NextResponse.json(source, { status: 201 });
}
