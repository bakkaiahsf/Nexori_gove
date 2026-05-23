import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { PolicyDocumentCreateSchema } from "@/schemas/ai";
import { indexPolicyDocument } from "@/lib/rag/indexer";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  const docs = await prisma.policyDocument.findMany({
    where: tenantId ? { tenantId } : {},
    select: {
      id: true,
      title: true,
      type: true,
      version: true,
      uploadedBy: true,
      uploadedAt: true,
      indexedAt: true,
      _count: { select: { chunks: true } },
    },
    orderBy: { uploadedAt: "desc" },
  });
  return NextResponse.json({ documents: docs });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PolicyDocumentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;
  const doc = await prisma.policyDocument.create({
    data: {
      title: data.title,
      type: data.type,
      content: data.content,
      version: data.version,
      effectiveAt: data.effectiveAt ? new Date(data.effectiveAt) : undefined,
      uploadedBy: data.uploadedBy,
      tenantId: data.tenantId,
    },
  });

  // Kick off async indexing (non-blocking)
  indexPolicyDocument(doc.id).catch(() => void 0);

  return NextResponse.json(
    { document: { id: doc.id, title: doc.title, status: "indexing" } },
    { status: 201 }
  );
}
