import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { TriggerAction } from "@prisma/client";

const CreateRuleSchema = z.object({
  projectId: z.string().cuid(),
  name: z.string().min(1).max(120),
  description: z.string().optional(),
  source: z.enum(["jira", "github", "gitlab"]),
  eventType: z.string().min(1),
  action: z.nativeEnum(TriggerAction),
  priority: z.number().int().min(1).max(1000).default(100),
  conditions: z
    .array(z.object({ field: z.string(), op: z.string(), value: z.string() }))
    .default([]),
});

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const rules = await prisma.governanceTriggerRule.findMany({
    where: { projectId },
    orderBy: [{ enabled: "desc" }, { priority: "desc" }],
  });
  return NextResponse.json(rules);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateRuleSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );

  const rule = await prisma.governanceTriggerRule.create({
    data: {
      projectId: parsed.data.projectId,
      name: parsed.data.name,
      description: parsed.data.description,
      source: parsed.data.source,
      eventType: parsed.data.eventType,
      action: parsed.data.action,
      priority: parsed.data.priority,
      conditions: parsed.data.conditions,
      createdBy: "admin@nexori.system",
      enabled: true,
    },
  });

  return NextResponse.json(rule, { status: 201 });
}
