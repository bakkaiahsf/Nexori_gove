/**
 * Governance Pipeline Composer
 *
 * Given change metadata (title, description, labels, components, domain, frameworks),
 * fetches the enabled gate library and expert profiles from the database, then uses AI
 * to compose a dynamic governance gate pipeline — nothing is hardcoded.
 *
 * The AI selects which gate slugs apply based on the change characteristics, and the
 * platform resolves matching experts from the ExpertProfile table.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/db";

const ComposeSchema = z.object({
  title: z.string().max(500),
  description: z.string().max(2000).optional(),
  issueType: z.string().optional(),
  labels: z.array(z.string()).default([]),
  components: z.array(z.string()).default([]),
  domain: z.string().optional(),
  templateId: z.string().optional(), // governance template hint
  frameworks: z.array(z.string()).default([]),
});

type GateRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
  approverRoles: string[];
  intensityTriggers: string[];
  defaultSlaHours: number;
  description: string | null;
};

type ExpertRow = {
  id: string;
  email: string;
  name: string | null;
  domains: string[];
  jurisdictions: string[];
  avgResolutionHours: number | null;
  activeApprovals: number;
};

type ComposedGate = {
  gateId: string;
  slug: string;
  name: string;
  category: string;
  approverRoles: string[];
  slaHours: number;
  description: string | null;
  reason: string;
  suggestedExperts: {
    id: string;
    name: string | null;
    email: string;
    domains: string[];
    avgResolutionHours: number | null;
    activeApprovals: number;
  }[];
};

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ComposeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { title, description, issueType, labels, components, domain, templateId, frameworks } =
    parsed.data;

  // Fetch all enabled gates and expert profiles from the database
  const [gates, experts] = await Promise.all([
    prisma.gateDefinition.findMany({
      where: { enabled: true },
      select: {
        id: true,
        slug: true,
        name: true,
        category: true,
        approverRoles: true,
        intensityTriggers: true,
        defaultSlaHours: true,
        description: true,
      },
      orderBy: { category: "asc" },
    }) as Promise<GateRow[]>,
    prisma.expertProfile.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        domains: true,
        jurisdictions: true,
        avgResolutionHours: true,
        activeApprovals: true,
      },
      orderBy: { activeApprovals: "asc" }, // prefer less loaded experts
    }) as Promise<ExpertRow[]>,
  ]);

  if (gates.length === 0) {
    return NextResponse.json({
      gates: [],
      summary: "No gate definitions found in the gate library. Add gates in Admin → Gate Library.",
      totalGates: 0,
    });
  }

  // Build compact gate catalog for AI prompt (to stay within token limits)
  const gateCatalog = gates
    .map(
      (g) => `${g.slug} | ${g.name} | category:${g.category} | roles:${g.approverRoles.join(",")}`
    )
    .join("\n");

  const changeContext = [
    `Title: ${title}`,
    `Description: ${description?.slice(0, 400) ?? "N/A"}`,
    `Issue Type: ${issueType ?? "unknown"}`,
    `Labels: ${labels.join(", ") || "none"}`,
    `Components: ${components.join(", ") || "none"}`,
    `Domain: ${domain ?? "unknown"}`,
    `Template Hint: ${templateId ?? "none"}`,
    `Frameworks: ${frameworks.join(", ") || "none"}`,
  ].join("\n");

  let selectedSlugs: string[] = [];
  let gateReasons: Record<string, string> = {};

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (apiKey) {
    try {
      const client = new Anthropic({ apiKey });
      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        system: `You are a governance pipeline composer for regulated enterprises.
Given a change item and an available gate library, select the appropriate governance gates.
Return JSON only. No markdown.

Available gates (slug | name | category | approverRoles):
${gateCatalog}`,
        messages: [
          {
            role: "user",
            content: `Select the governance gates required for this change. Include sign-off gates for all teams involved.

${changeContext}

Return JSON:
{
  "gates": [
    { "slug": "<gate-slug>", "reason": "<why this gate is required>" }
  ],
  "summary": "<1-2 sentence summary of why these gates were selected>"
}

Rules:
- Include Data Architecture / architecture review gate if components or labels mention architecture, data, infrastructure, schema, database
- Include UI/UX review gate if labels/components mention frontend, UI, UX, design, interface, user-experience
- Include functional sign-off / product owner gate for any feature delivery or functional change
- Include security gates for any change touching auth, encryption, APIs, external data
- Include DORA ICT risk gates if frameworks contain DORA
- Include AI governance gates if labels/components mention AI, ML, model, algorithm
- Include regulatory/compliance gates if domain is banking, insurance, or frameworks contain DORA/EU_AI_ACT
- Do not include gates irrelevant to the change
- Prefer specific gates over generic ones`,
          },
        ],
      });

      const text = message.content[0].type === "text" ? message.content[0].text.trim() : "{}";
      const jsonMatch = /\{[\s\S]*\}/.exec(text);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as {
          gates?: { slug: string; reason: string }[];
          summary?: string;
        };

        selectedSlugs = (parsed.gates ?? [])
          .map((g) => g.slug)
          .filter((s) => gates.some((g) => g.slug === s));
        gateReasons = Object.fromEntries((parsed.gates ?? []).map((g) => [g.slug, g.reason]));

        // Store summary for response
        const aiSummary = parsed.summary ?? "";

        // Compose result
        const composed = buildComposedPipeline(selectedSlugs, gateReasons, gates, experts);
        return NextResponse.json({
          gates: composed,
          summary: aiSummary,
          totalGates: composed.length,
          source: "ai",
        });
      }
    } catch {
      // Fall through to rule-based composition
    }
  }

  // Rule-based fallback composition (no hardcoded gates — uses gate library)
  selectedSlugs = ruleBasedSelection(gates, labels, components, frameworks, domain);
  gateReasons = {};
  selectedSlugs.forEach((slug) => {
    const g = gates.find((g) => g.slug === slug);
    if (g) gateReasons[slug] = `Selected based on ${g.category} category match`;
  });

  const composed = buildComposedPipeline(selectedSlugs, gateReasons, gates, experts);
  return NextResponse.json({
    gates: composed,
    summary: `${composed.length} gates selected from the configured gate library based on change characteristics.`,
    totalGates: composed.length,
    source: "rules",
  });
}

function buildComposedPipeline(
  slugs: string[],
  reasons: Record<string, string>,
  gates: GateRow[],
  experts: ExpertRow[]
): ComposedGate[] {
  return slugs
    .map((slug) => {
      const gate = gates.find((g) => g.slug === slug);
      if (!gate) return null;

      const matchedExperts = experts
        .filter((e) => e.domains.some((d) => gate.approverRoles.includes(d)))
        .slice(0, 3); // top 3 by lowest active approvals

      return {
        gateId: gate.id,
        slug: gate.slug,
        name: gate.name,
        category: gate.category,
        approverRoles: gate.approverRoles,
        slaHours: gate.defaultSlaHours,
        description: gate.description,
        reason: reasons[slug] ?? "",
        suggestedExperts: matchedExperts.map((e) => ({
          id: e.id,
          name: e.name,
          email: e.email,
          domains: e.domains,
          avgResolutionHours: e.avgResolutionHours,
          activeApprovals: e.activeApprovals,
        })),
      } satisfies ComposedGate;
    })
    .filter((g): g is ComposedGate => g !== null);
}

function ruleBasedSelection(
  gates: GateRow[],
  labels: string[],
  components: string[],
  frameworks: string[],
  domain?: string
): string[] {
  const text = `${labels.join(" ")} ${components.join(" ")} ${domain ?? ""}`.toLowerCase();
  const selected: Set<string> = new Set();

  for (const gate of gates) {
    const cat = gate.category.toLowerCase();
    const slug = gate.slug.toLowerCase();
    const roles = gate.approverRoles.join(" ").toLowerCase();

    // Architecture changes
    if (
      /architecture|data|infrastructure|schema|database|pipeline/.test(text) &&
      (cat === "architecture" || roles.includes("architecture"))
    ) {
      selected.add(gate.slug);
    }
    // UI/UX changes
    if (/ui|ux|frontend|interface|design|user.experience/.test(text) && roles.includes("ux")) {
      selected.add(gate.slug);
    }
    // Security
    if (cat === "security" && /security|auth|encryption|api|external/.test(text)) {
      selected.add(gate.slug);
    }
    // AI governance
    if (
      (cat === "ai-governance" || slug.includes("ai")) &&
      /ai|ml|model|algorithm|llm/.test(text)
    ) {
      selected.add(gate.slug);
    }
    // DORA frameworks
    if (frameworks.includes("DORA") && cat === "regulatory") {
      selected.add(gate.slug);
    }
    // Change management — always include for regulated domains
    if (
      cat === "change-management" &&
      (domain === "banking" || domain === "insurance" || domain === "fintech")
    ) {
      selected.add(gate.slug);
    }
  }

  // Ensure at least one operational gate
  if (selected.size === 0) {
    const firstOp = gates.find(
      (g) => g.category === "operational" || g.category === "change-management"
    );
    if (firstOp) selected.add(firstOp.slug);
  }

  return Array.from(selected);
}
