import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { indexPolicyDocument } from "@/lib/rag/indexer";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const { id } = params;

  const doc = await prisma.policyDocument.findUnique({
    where: { id },
    select: { id: true, title: true },
  });
  if (!doc) {
    return NextResponse.json({ error: "Policy document not found" }, { status: 404 });
  }

  // Synchronous re-index so caller gets chunk count
  try {
    const chunkCount = await indexPolicyDocument(id);
    return NextResponse.json({ documentId: id, chunkCount, status: "indexed" });
  } catch (err) {
    return NextResponse.json(
      { error: "Indexing failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
