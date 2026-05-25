import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface JiraBoard {
  id: number;
  name: string;
  type: string;
  location?: {
    projectKey?: string;
    projectName?: string;
    displayName?: string;
  };
}

interface JiraBoardsResponse {
  values: JiraBoard[];
  total: number;
  maxResults: number;
  isLast: boolean;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const connectorId = searchParams.get("connectorId");

  if (!connectorId) {
    return NextResponse.json({ error: "connectorId is required" }, { status: 400 });
  }

  const connector = await prisma.sourceConnector.findUnique({
    where: { id: connectorId },
    select: { baseUrl: true, credentials: true, type: true },
  });

  if (!connector || connector.type !== "jira") {
    return NextResponse.json({ error: "Jira connector not found" }, { status: 404 });
  }

  const creds = connector.credentials as { email?: string; apiToken?: string; token?: string };
  const email = creds.email ?? "";
  const apiToken = creds.apiToken ?? creds.token ?? "";
  const authHeader = email
    ? `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`
    : `Bearer ${apiToken}`;

  try {
    const response = await fetch(
      `${connector.baseUrl}/rest/agile/1.0/board?maxResults=50&type=scrum,kanban`,
      {
        headers: { Authorization: authHeader, Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json({ error: "Jira authentication failed" }, { status: 401 });
      }
      return NextResponse.json({ error: `Jira API error: ${response.status}` }, { status: 502 });
    }

    const data = (await response.json()) as JiraBoardsResponse;
    const boards = (data.values ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      type: b.type,
      projectKey: b.location?.projectKey,
      projectName: b.location?.projectName ?? b.location?.displayName,
    }));

    return NextResponse.json({ boards });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: `Could not reach Jira — check connector URL. (${msg})` },
      { status: 502 }
    );
  }
}
