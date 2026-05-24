import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

interface JiraIssueResult {
  key: string;
  fields: {
    summary: string;
    issuetype?: { name: string };
    status?: { name: string };
    priority?: { name: string };
    labels?: string[];
    assignee?: { displayName: string };
    reporter?: { emailAddress: string };
    created?: string;
    duedate?: string | null;
  };
}

interface JiraSearchResponse {
  issues: JiraIssueResult[];
  total: number;
  maxResults: number;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const connectorId = searchParams.get("connectorId");
  const projectKey = searchParams.get("projectKey"); // Jira project key, e.g. "BANK"
  const boardId = searchParams.get("boardId"); // optional: filter to board
  const search = searchParams.get("search") ?? ""; // optional keyword search
  const issueTypes = searchParams.get("issueTypes") ?? "Portfolio Epic,Epic"; // comma-separated

  if (!connectorId || (!projectKey && !boardId)) {
    return NextResponse.json(
      { error: "connectorId and either projectKey or boardId are required" },
      { status: 400 }
    );
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

  // Build JQL query
  const typeList = issueTypes
    .split(",")
    .map((t) => `"${t.trim()}"`)
    .join(",");
  const clauses: string[] = [`issuetype in (${typeList})`];
  if (projectKey) clauses.push(`project = "${projectKey}"`);
  if (search) clauses.push(`summary ~ "${search}"`);

  const jql = `${clauses.join(" AND ")} ORDER BY created DESC`;
  const fields = "summary,issuetype,status,priority,labels,assignee,reporter,created,duedate";

  const url =
    `${connector.baseUrl}/rest/api/3/search?` +
    new URLSearchParams({
      jql,
      fields,
      maxResults: "50",
    }).toString();

  try {
    const response = await fetch(url, {
      headers: { Authorization: authHeader, Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json({ error: "Jira authentication failed" }, { status: 401 });
      }
      const errText = await response.text();
      return NextResponse.json(
        { error: `Jira API error: ${response.status}`, detail: errText.slice(0, 200) },
        { status: 502 }
      );
    }

    const data = (await response.json()) as JiraSearchResponse;
    const issues = (data.issues ?? []).map((i) => ({
      key: i.key,
      summary: i.fields.summary,
      issueType: i.fields.issuetype?.name ?? "Unknown",
      status: i.fields.status?.name ?? "Unknown",
      priority: i.fields.priority?.name,
      labels: i.fields.labels ?? [],
      assignee: i.fields.assignee?.displayName,
      reporter: i.fields.reporter?.emailAddress,
      created: i.fields.created,
      duedate: i.fields.duedate,
    }));

    return NextResponse.json({ issues, total: data.total });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: `Could not reach Jira. (${msg})` }, { status: 502 });
  }
}
