import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { SourceConnectorCreateSchema } from "@/schemas/ai";
import crypto from "crypto";

export async function GET(): Promise<NextResponse> {
  const connectors = await prisma.sourceConnector.findMany({
    select: {
      id: true,
      type: true,
      name: true,
      baseUrl: true,
      projectKeys: true,
      enabled: true,
      createdAt: true,
      // Never return credentials in list response
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ connectors });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = SourceConnectorCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;

  // Auto-generate webhook secret if not provided
  const webhookSecret = data.webhookSecret ?? crypto.randomBytes(32).toString("hex");

  const connector = await prisma.sourceConnector.create({
    data: {
      type: data.type,
      name: data.name,
      baseUrl: data.baseUrl,
      credentials: data.credentials,
      webhookSecret,
      projectKeys: data.projectKeys,
      fieldMapping: data.fieldMapping,
      tenantId: data.tenantId,
    },
    select: {
      id: true,
      type: true,
      name: true,
      baseUrl: true,
      projectKeys: true,
      webhookSecret: true,
      enabled: true,
      createdAt: true,
    },
  });

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/${data.type}?connectorId=${connector.id}`;

  return NextResponse.json({ connector, webhookUrl }, { status: 201 });
}
