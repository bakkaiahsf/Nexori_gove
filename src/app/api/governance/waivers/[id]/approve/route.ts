import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { approveGovernanceWaiver } from "@/lib/waiver/engine";

const ApproveWaiverSchema = z.object({
  approvedBy: z.string().email(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ApproveWaiverSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const result = await approveGovernanceWaiver(params.id, parsed.data.approvedBy);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Record to update not found") || msg.includes("No GovernanceWaiver")) {
      return NextResponse.json({ error: "Waiver not found" }, { status: 404 });
    }
    throw err;
  }
}
