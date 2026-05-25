import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { GitHubConnector } from "@/lib/connectors/github";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const connectorId = req.nextUrl.searchParams.get("connectorId");
  if (!connectorId) {
    return NextResponse.json({ error: "Missing connectorId" }, { status: 400 });
  }

  const connector = await prisma.sourceConnector.findUnique({
    where: { id: connectorId },
    select: { type: true, credentials: true, enabled: true },
  });

  if (!connector || connector.type !== "github") {
    return NextResponse.json({ error: "GitHub connector not found" }, { status: 404 });
  }
  if (!connector.enabled) {
    return NextResponse.json({ error: "Connector disabled" }, { status: 403 });
  }

  const creds = connector.credentials as Record<string, string>;
  const token = creds.token ?? "";

  if (!token) {
    return NextResponse.json({ error: "No token configured on connector" }, { status: 400 });
  }

  try {
    const ghConn = new GitHubConnector({ token, owner: "", repo: "" });
    const repos = await ghConn.listRepositories();
    return NextResponse.json({ repos });
  } catch (err) {
    return NextResponse.json({ error: "GitHub API error", detail: String(err) }, { status: 502 });
  }
}
