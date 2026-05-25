interface WritebackInput {
  token: string;
  baseUrl: string;
  projectId: string | number;
  mrIid: number;
  caseId: string;
  caseTitle: string;
  gates: Array<{
    name: string;
    status: string;
    skipped: boolean;
    order: number;
  }>;
  riskIntensity?: string;
  compositeScore?: number;
}

function gateCheckbox(gate: { name: string; status: string; skipped: boolean }): string {
  if (gate.skipped) return `- [x] ~~${gate.name}~~ *(skipped)*`;
  if (gate.status === "APPROVED") return `- [x] ${gate.name} ✓`;
  if (gate.status === "REJECTED") return `- [ ] ~~${gate.name}~~ ❌`;
  return `- [ ] ${gate.name}`;
}

async function glFetch<T>(
  token: string,
  baseUrl: string,
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${baseUrl}/api/v4${path}`, {
    ...options,
    headers: {
      "PRIVATE-TOKEN": token,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`GitLab API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export async function writeGovernancePipelineToGitLab(input: WritebackInput): Promise<string> {
  const { token, baseUrl, projectId, mrIid } = input;
  const pid = encodeURIComponent(String(projectId));

  const sortedGates = [...input.gates].sort((a, b) => a.order - b.order);
  const checklist = sortedGates.map(gateCheckbox).join("\n");

  const description = [
    `## [GOV] Governance Tracking — ${input.caseTitle}`,
    ``,
    `**NexoriOS Case ID:** \`${input.caseId}\``,
    input.riskIntensity ? `**Risk Intensity:** ${input.riskIntensity.toUpperCase()}` : ``,
    input.compositeScore !== undefined
      ? `**Composite Risk Score:** ${input.compositeScore}/100`
      : ``,
    ``,
    `### Governance Gates`,
    checklist,
    ``,
    `---`,
    `*Managed by NexoriOS — do not close manually. Gate status updates automatically.*`,
  ]
    .filter((l) => l !== ``)
    .join("\n");

  const issue = await glFetch<{ iid: number; web_url: string }>(
    token,
    baseUrl,
    `/projects/${pid}/issues`,
    {
      method: "POST",
      body: JSON.stringify({
        title: `[GOV] ${input.caseTitle}`,
        description,
        labels: "governance,nexori",
      }),
    }
  );

  // Comment on the MR
  await glFetch(token, baseUrl, `/projects/${pid}/merge_requests/${mrIid}/notes`, {
    method: "POST",
    body: JSON.stringify({
      body: `📋 **Governance tracking issue created:** #${issue.iid}\n\nThis MR requires governance approval. Track progress: ${issue.web_url}`,
    }),
  });

  return issue.web_url;
}
