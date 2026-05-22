import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { AIChatRequestSchema } from "@/schemas/ai";
import { routeAI, AIBlockedError } from "@/lib/ai/router";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = AIChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const result = await routeAI(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AIBlockedError) {
      return NextResponse.json(
        { error: "AI blocked by governance policy", mode: err.mode },
        { status: 503 }
      );
    }
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", issues: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
