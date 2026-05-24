import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

interface AdfNode {
  type?: string;
  text?: string;
  content?: AdfNode[];
}

interface JiraFields {
  summary: string;
  description?: AdfNode | string | null;
  issuetype?: { name: string };
  status?: { name: string };
  priority?: { name: string };
  labels?: string[];
  components?: { name: string }[];
  assignee?: { displayName: string };
  reporter?: { emailAddress: string };
  created?: string;
  duedate?: string | null;
}

interface JiraIssue {
  key: string;
  fields: JiraFields;
}

function extractAdfText(node: AdfNode | string | null | undefined, depth = 0): string {
  if (!node || depth > 20) return "";
  if (typeof node === "string") return node;
  if (typeof node.text === "string") return node.text;
  if (Array.isArray(node.content)) {
    return node.content
      .map((c) => extractAdfText(c, depth + 1))
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const connectorId = searchParams.get("connectorId");
  const epicKey = searchParams.get("epicKey")?.trim().toUpperCase();

  if (!connectorId || !epicKey) {
    return NextResponse.json({ error: "connectorId and epicKey are required" }, { status: 400 });
  }

  const connector = await prisma.sourceConnector.findUnique({
    where: { id: connectorId },
    select: { baseUrl: true, credentials: true, type: true },
  });

  if (!connector) {
    return NextResponse.json({ error: "Connector not found" }, { status: 404 });
  }

  if (connector.type !== "jira") {
    return NextResponse.json({ error: "Connector is not a Jira connector" }, { status: 400 });
  }

  const creds = connector.credentials as { email?: string; apiToken?: string; token?: string };
  const email = creds.email ?? "";
  const apiToken = creds.apiToken ?? creds.token ?? "";

  const authHeader = email
    ? `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`
    : `Bearer ${apiToken}`;

  const fields =
    "summary,description,issuetype,status,priority,labels,components,assignee,reporter,created,duedate";
  const url = `${connector.baseUrl}/rest/api/3/issue/${epicKey}?fields=${fields}`;

  let issueData: JiraIssue;
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          { error: "Jira authentication failed — check the connector API token" },
          { status: 401 }
        );
      }
      if (response.status === 404) {
        return NextResponse.json(
          { error: `Issue "${epicKey}" not found — check the key and Jira project access` },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: `Jira API error ${response.status}`, detail: errText.slice(0, 300) },
        { status: 502 }
      );
    }

    issueData = (await response.json()) as JiraIssue;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: `Could not reach Jira — check the connector base URL. (${msg})` },
      { status: 502 }
    );
  }

  const descRaw = issueData.fields.description;
  const descText =
    typeof descRaw === "string" ? descRaw : extractAdfText(descRaw as AdfNode);

  return NextResponse.json({
    key: issueData.key,
    summary: issueData.fields.summary,
    description: descText.slice(0, 2000),
    issueType: issueData.fields.issuetype?.name ?? "Unknown",
    status: issueData.fields.status?.name ?? "Unknown",
    priority: issueData.fields.priority?.name,
    labels: issueData.fields.labels ?? [],
    components: (issueData.fields.components ?? []).map((c) => c.name),
    assignee: issueData.fields.assignee?.displayName,
    reporter: issueData.fields.reporter?.emailAddress,
    created: issueData.fields.created,
    duedate: issueData.fields.duedate,
  });
}
