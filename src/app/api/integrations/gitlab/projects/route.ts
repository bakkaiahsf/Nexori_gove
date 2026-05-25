import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { GitLabConnector } from "@/lib/connectors/gitlab";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const connectorId = req.nextUrl.searchParams.get("connectorId");
  if (!connectorId) {
    return NextResponse.json({ error: "Missing connectorId" }, { status: 400 });
  }

  const connector = await prisma.sourceConnector.findUnique({
    where: { id: connectorId },
    select: { type: true, baseUrl: true, credentials: true, enabled: true },
  });

  if (!connector || connector.type !== "gitlab") {
    return NextResponse.json({ error: "GitLab connector not found" }, { status: 404 });
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
    const glConn = new GitLabConnector({ token, baseUrl: connector.baseUrl, projectId: "" });
    const projects = await glConn.listProjects();
    return NextResponse.json({ projects });
  } catch (err) {
    return NextResponse.json({ error: "GitLab API error", detail: String(err) }, { status: 502 });
  }
}
