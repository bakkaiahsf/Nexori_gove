interface WritebackInput {
  token: string;
  owner: string;
  repo: string;
  prNumber: number;
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

async function ghFetch<T>(token: string, path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export async function writeGovernancePipelineToGitHub(input: WritebackInput): Promise<string> {
  const { token, owner, repo } = input;

  const sortedGates = [...input.gates].sort((a, b) => a.order - b.order);
  const checklist = sortedGates.map(gateCheckbox).join("\n");

  const body = [
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
    `*Managed by NexoriOS — do not close manually. Gate status updates automatically as approvals are recorded.*`,
  ]
    .filter((l) => l !== ``)
    .join("\n");

  const issue = await ghFetch<{ number: number; html_url: string }>(
    token,
    `/repos/${owner}/${repo}/issues`,
    {
      method: "POST",
      body: JSON.stringify({
        title: `[GOV] ${input.caseTitle}`,
        body,
        labels: ["governance", "nexori"],
      }),
    }
  );

  // Comment on the PR
  await ghFetch(token, `/repos/${owner}/${repo}/issues/${input.prNumber}/comments`, {
    method: "POST",
    body: JSON.stringify({
      body: `📋 **Governance tracking issue created:** #${issue.number}\n\nThis PR requires governance approval. Track progress: ${issue.html_url}`,
    }),
  });

  return issue.html_url;
}
