import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  let dbStatus = "disconnected";
  let dbError: string | undefined;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = "connected";
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  const ok = dbStatus === "connected";

  return Response.json(
    {
      status: ok ? "ok" : "degraded",
      product: "NexoriOS",
      version: process.env.NEXORI_VERSION ?? "0.1.0",
      regulatory_mode: process.env.REGULATORY_MODE ?? "DORA_EU_AI_ACT",
      ai_provider: process.env.AI_DEFAULT_PROVIDER ?? "openai",
      db: { status: dbStatus, ...(dbError ? { error: dbError } : {}) },
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  );
}
