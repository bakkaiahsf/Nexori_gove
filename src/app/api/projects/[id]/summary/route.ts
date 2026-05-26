import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { routeAI, AIBlockedError } from "@/lib/ai/router";

const BodySchema = z.object({
  summaryType: z.enum(["sprint", "weekly", "release", "risk", "evidence"]),
});

const SUMMARY_PROMPTS: Record<string, (ctx: string, projectName: string) => string> = {
  sprint: (ctx, name) =>
    `Generate a concise sprint governance summary for project "${name}". Based on the context below, summarise: what happened this sprint, what readiness checks were cleared, what risks were identified, and what still needs attention. Keep it factual and under 250 words.\n\nContext:\n${ctx}`,
  weekly: (ctx, name) =>
    `Generate a weekly delivery confidence summary for project "${name}". Include: overall delivery status, open assurance items, pending readiness checks, evidence coverage, and any risks requiring attention. Keep it under 250 words.\n\nContext:\n${ctx}`,
  release: (ctx, name) =>
    `Generate a release readiness assessment for project "${name}". State clearly whether this project is ready to release, what checks remain, what risks exist, and what sign-offs are required. Keep it under 200 words.\n\nContext:\n${ctx}`,
  risk: (ctx, name) =>
    `Generate a risk summary for project "${name}". List the open risks by severity, their impact on delivery, and what mitigations are in place or needed. Keep it under 200 words.\n\nContext:\n${ctx}`,
  evidence: (ctx, name) =>
    `Generate an evidence gap summary for project "${name}". Identify what evidence is missing, what is stale, what frameworks have low coverage, and what actions are needed to close the gaps. Keep it under 200 words.\n\nContext:\n${ctx}`,
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid summaryType" }, { status: 400 });

  const { summaryType } = parsed.data;
  const projectId = params.id;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, key: true },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Build context from DB
  const [activeCases, recentEvents, boards] = await Promise.all([
    prisma.governanceCase.findMany({
      where: { projectId, status: "active" },
      include: {
        governanceGates: { select: { status: true, name: true, required: true } },
        riskScore: { select: { compositeScore: true, intensity: true } },
      },
      take: 10,
    }),
    prisma.governanceEvent.findMany({
      where: { projectId },
      orderBy: { timestamp: "desc" },
      take: 15,
      select: { type: true, actorEmail: true, timestamp: true },
    }),
    prisma.projectBoard.findMany({
      where: { projectId },
      include: { connector: { select: { type: true, name: true } } },
    }),
  ]);

  const contextLines: string[] = [
    `Project: ${project.name} (${project.key})`,
    `Active assurance items: ${activeCases.length}`,
    `Source integrations: ${boards.map((b) => `${b.connector.type}/${b.boardId}`).join(", ") || "none"}`,
    "",
    "Active items:",
    ...activeCases.map((c) => {
      const approved = c.governanceGates.filter((g) => g.status === "APPROVED").length;
      const total = c.governanceGates.length;
      const pending = c.governanceGates.filter((g) => g.status === "OPEN" || g.status === "PENDING").length;
      return `- "${c.title}" [${c.phase}] ${c.riskScore?.intensity ?? "unknown"} risk — ${approved}/${total} checks cleared, ${pending} pending`;
    }),
    "",
    "Recent activity (last 15 events):",
    ...recentEvents.map((e) =>
      `- ${new Date(e.timestamp).toLocaleDateString("en-GB")} ${e.type.replace(/_/g, " ")} by ${e.actorEmail ?? "system"}`
    ),
  ];

  const contextStr = contextLines.join("\n");
  const prompt = SUMMARY_PROMPTS[summaryType]?.(contextStr, project.name);
  if (!prompt) return NextResponse.json({ error: "Unknown summary type" }, { status: 400 });

  try {
    const result = await routeAI({
      projectId,
      provider: "anthropic",
      action: "summary",
      messages: [
        {
          role: "system",
          content:
            "You are a delivery confidence assistant for a regulated financial organisation. Generate factual, concise governance summaries based only on the provided project context. Do not invent evidence or risks not in the context.",
        },
        { role: "user", content: prompt },
      ],
      maxTokens: 512,
    });

    return NextResponse.json({ summary: result.content });
  } catch (err) {
    if (err instanceof AIBlockedError) {
      return NextResponse.json(
        { error: `Intelligence is blocked in ${err.mode} mode. Change the mode in AI Control to generate summaries.` },
        { status: 403 }
      );
    }
    console.error("summary generation error", err);
    return NextResponse.json({ error: "Failed to generate summary" }, { status: 500 });
  }
}
