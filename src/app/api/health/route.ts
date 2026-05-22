export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    status: "ok",
    product: "NexoriOS",
    version: process.env.NEXORI_VERSION ?? "0.1.0",
    regulatory_mode: process.env.REGULATORY_MODE ?? "DORA_EU_AI_ACT",
    timestamp: new Date().toISOString(),
  });
}
