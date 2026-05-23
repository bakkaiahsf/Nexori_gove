import { NextRequest, NextResponse } from "next/server";
import { WaiverRequestSchema } from "@/schemas/ai";
import { requestGovernanceWaiver } from "@/lib/waiver/engine";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = WaiverRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const result = await requestGovernanceWaiver(parsed.data);
  return NextResponse.json(result, { status: 201 });
}
