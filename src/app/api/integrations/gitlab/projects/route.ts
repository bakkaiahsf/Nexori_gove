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
  const token = creds.token ?? creds.apiToken ?? creds.accessToken ?? "";

  if (!token) {
    return NextResponse.json({
      error: "No personal access token configured for this GitLab connector.",
      detail: "Go to Admin → Connectors → edit this connector and add a GitLab personal access token with 'read_api' scope.",
    }, { status: 400 });
  }

  const baseUrl = connector.baseUrl?.replace(/\/$/, "") || "https://gitlab.com";

  try {
    const glConn = new GitLabConnector({ token, baseUrl, projectId: "" });
    const projects = await glConn.listProjects();
    return NextResponse.json({ projects });
  } catch (err) {
    const msg = String(err);
    if (msg.includes("401")) {
      return NextResponse.json({
        error: "GitLab authentication failed — token is invalid or expired.",
        detail: "Update the personal access token in Admin → Connectors.",
      }, { status: 502 });
    }
    if (msg.includes("403")) {
      return NextResponse.json({
        error: "GitLab access denied — token may be missing 'read_api' scope.",
        detail: "Edit the token in GitLab and ensure it has 'read_api' or 'api' scope.",
      }, { status: 502 });
    }
    return NextResponse.json({
      error: "Could not connect to GitLab. Check the base URL and token.",
      detail: msg,
    }, { status: 502 });
  }
}
