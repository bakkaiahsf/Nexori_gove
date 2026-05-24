import { NextRequest, NextResponse } from "next/server";
import { approveRequest, rejectRequest } from "@/lib/governance";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await approveRequest(
      params.id,
      body.resolvedByEmail ?? "bakkaiahsf@gmail.com",
      body.notes
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : "Rejected via UI";
    const result = await rejectRequest(
      params.id,
      body.resolvedByEmail ?? "bakkaiahsf@gmail.com",
      reason
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
