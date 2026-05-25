import prisma from "@/lib/db";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ReviewSchema = z.object({
  caseId: z.string(),
  gateId: z.string().optional(),
  gateName: z.string().optional(),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = ReviewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { caseId, gateId, gateName } = parsed.data;

  const govCase = await prisma.governanceCase.findUnique({
    where: { id: caseId },
    include: {
      context: true,
      riskScore: true,
      governanceGates: true,
      evidenceItems: { take: 10, orderBy: { submittedAt: "desc" } },
      project: {
        select: { name: true, key: true },
      },
    },
  });

  if (!govCase) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  const gate = gateId ? govCase.governanceGates.find((g) => g.id === gateId) : null;
  const pendingGates = govCase.governanceGates.filter(
    (g) => !g.skipped && g.status === "PENDING" && g.id !== gateId
  );
  const blockedGates = govCase.governanceGates.filter((g) => !g.skipped && g.status === "REJECTED");

  const prompt = [
    `You are a senior governance reviewer for a regulated financial organisation.`,
    `Review the following governance case and identify exactly what is missing or incomplete.`,
    `Be specific — name the exact evidence types, document names, approver roles, or information needed.`,
    ``,
    `## Case: ${govCase.title}`,
    `Project: ${govCase.project.name} (${govCase.project.key})`,
    `Phase: ${govCase.phase}`,
    govCase.riskScore
      ? `Risk: ${govCase.riskScore.intensity?.toUpperCase()} (score: ${govCase.riskScore.compositeScore}/100)`
      : "",
    ``,
    gate ? `## Current Gate Under Review: ${gate.name ?? gateName}` : "",
    gate?.description ? `Gate description: ${gate.description}` : "",
    ``,
    `## Evidence Submitted (${govCase.evidenceItems.length} items)`,
    govCase.evidenceItems.length === 0
      ? "No evidence submitted yet."
      : govCase.evidenceItems.map((e) => `- [${e.type}] ${e.title}`).join("\n"),
    ``,
    pendingGates.length > 0
      ? `## Other Pending Gates\n${pendingGates.map((g) => `- ${g.name}`).join("\n")}`
      : "",
    blockedGates.length > 0
      ? `## Blocked Gates\n${blockedGates.map((g) => `- ${g.name}`).join("\n")}`
      : "",
    govCase.context
      ? [
          ``,
          `## Context`,
          `Environment: ${govCase.context.environment ?? "unknown"}`,
          `AI System Involved: ${govCase.context.aiSystemInvolved}`,
          `Third-Party Changes: ${govCase.context.thirdPartyChanges}`,
          `Data Classification: ${govCase.context.dataClassification ?? "not set"}`,
          govCase.context.contextSummary ? `Summary: ${govCase.context.contextSummary}` : "",
        ].join("\n")
      : "",
    ``,
    `## Your Task`,
    gate
      ? `For the gate "${gate.name ?? gateName}": list exactly what evidence, approvals, or documentation is still missing. Then list what should be completed next for the overall case.`
      : `Review the overall case: what evidence, approvals, or documentation is missing? What needs to happen next for this governance case to progress?`,
    ``,
    `Respond with:`,
    `1. **What is missing** (specific items, bullet points)`,
    `2. **What to do next** (actionable steps in priority order)`,
    `3. **Risk note** (any compliance or regulatory concern based on what you see)`,
    ``,
    `Keep your response concise and actionable. Do not invent policy — only assess based on what is visible.`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "Unable to generate review.";

    await prisma.aIUsageEvent.create({
      data: {
        projectId: govCase.projectId,
        model: "claude-sonnet-4-6",
        mode: "AI_ASSIST",
        action: "governance_gate_review",
        query: `Review case ${caseId} gate ${gateId ?? "overall"}`,
        chunkIds: [],
        tokensIn: message.usage.input_tokens,
        tokensOut: message.usage.output_tokens,
        outcome: "success",
        governanceRef: caseId,
      },
    });

    return NextResponse.json({ review: text });
  } catch (err) {
    console.error("AI review error:", err);
    return NextResponse.json({ error: "AI review failed" }, { status: 500 });
  }
}
