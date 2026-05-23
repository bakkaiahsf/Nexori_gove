import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { ExpertProfileCreateSchema } from "@/schemas/ai";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const domain = req.nextUrl.searchParams.get("domain");
  const experts = await prisma.expertProfile.findMany({
    where: domain ? { domains: { has: domain } } : {},
    orderBy: [{ activeApprovals: "asc" }, { avgResolutionHours: "asc" }],
  });
  return NextResponse.json({ experts });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ExpertProfileCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;

  const expert = await prisma.expertProfile.upsert({
    where: { email: data.email },
    update: {
      name: data.name,
      domains: data.domains,
      jurisdictions: data.jurisdictions,
      tenantId: data.tenantId,
    },
    create: {
      email: data.email,
      name: data.name,
      domains: data.domains,
      jurisdictions: data.jurisdictions,
      tenantId: data.tenantId,
    },
  });

  return NextResponse.json({ expert }, { status: 201 });
}
