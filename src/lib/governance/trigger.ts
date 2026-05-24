import { TriggerAction, GovernanceEventType, Prisma } from "@prisma/client";
import prisma from "@/lib/db";

export interface TriggerContext {
  sourceType: string;
  eventType: string;
  eventKey: string;
  payload: Record<string, unknown>;
  connectorId?: string;
  projectId: string;
}

export interface TriggerResult {
  matched: boolean;
  action: TriggerAction | null;
  ruleId: string | null;
  ruleName: string | null;
  evaluationId: string;
}

type Condition = {
  field: string;
  op: "eq" | "neq" | "contains" | "not_contains" | "gt" | "lt" | "matches";
  value: string | number | boolean;
};

function resolveField(payload: Record<string, unknown>, field: string): unknown {
  return field.split(".").reduce<unknown>((obj, key) => {
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      return (obj as Record<string, unknown>)[key];
    }
    return undefined;
  }, payload);
}

function evaluateCondition(payload: Record<string, unknown>, condition: Condition): boolean {
  const actual = resolveField(payload, condition.field);
  const expected = condition.value;

  switch (condition.op) {
    case "eq":
      return String(actual).toLowerCase() === String(expected).toLowerCase();
    case "neq":
      return String(actual).toLowerCase() !== String(expected).toLowerCase();
    case "contains":
      if (Array.isArray(actual)) {
        return actual.some((v) => String(v).toLowerCase().includes(String(expected).toLowerCase()));
      }
      return String(actual ?? "")
        .toLowerCase()
        .includes(String(expected).toLowerCase());
    case "not_contains":
      if (Array.isArray(actual)) {
        return !actual.some((v) =>
          String(v).toLowerCase().includes(String(expected).toLowerCase())
        );
      }
      return !String(actual ?? "")
        .toLowerCase()
        .includes(String(expected).toLowerCase());
    case "gt":
      return Number(actual) > Number(expected);
    case "lt":
      return Number(actual) < Number(expected);
    case "matches":
      try {
        return new RegExp(String(expected), "i").test(String(actual ?? ""));
      } catch {
        return false;
      }
    default:
      return false;
  }
}

/**
 * Evaluate incoming connector event against admin-configured trigger rules.
 * Rules are evaluated in descending priority order (highest first).
 * First matching rule wins. If no rule matches, the event is logged and ignored.
 */
export async function evaluateTriggerRules(ctx: TriggerContext): Promise<TriggerResult> {
  const rules = await prisma.governanceTriggerRule.findMany({
    where: {
      projectId: ctx.projectId,
      source: ctx.sourceType,
      enabled: true,
    },
    orderBy: { priority: "desc" },
  });

  let matchedRuleId: string | null = null;
  let matchedAction: TriggerAction | null = null;
  let matchedRuleName: string | null = null;

  for (const rule of rules) {
    // Check if event type matches
    if (rule.eventType !== ctx.eventType && rule.eventType !== "*") {
      continue;
    }

    const conditions = rule.conditions as unknown as Condition[];
    const allMatch =
      !conditions ||
      conditions.length === 0 ||
      conditions.every((c) => evaluateCondition(ctx.payload, c));

    if (allMatch) {
      matchedRuleId = rule.id;
      matchedAction = rule.action;
      matchedRuleName = rule.name;
      break;
    }
  }

  const matched = matchedRuleId !== null;

  // Record the evaluation in the audit log
  const evaluation = await prisma.triggerEvaluation.create({
    data: {
      ruleId: matchedRuleId,
      connectorId: ctx.connectorId,
      projectId: ctx.projectId,
      sourceType: ctx.sourceType,
      eventType: ctx.eventType,
      eventKey: ctx.eventKey,
      matched,
      action: matchedAction,
      payload: ctx.payload as unknown as Prisma.InputJsonValue,
    },
  });

  // Emit flight recorder event
  await prisma.governanceEvent.create({
    data: {
      projectId: ctx.projectId,
      type: matched ? GovernanceEventType.TRIGGER_MATCHED : GovernanceEventType.TRIGGER_SKIPPED,
      resourceType: "trigger-evaluation",
      resourceId: evaluation.id,
      payload: {
        sourceType: ctx.sourceType,
        eventType: ctx.eventType,
        eventKey: ctx.eventKey,
        ruleId: matchedRuleId,
        action: matchedAction,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    matched,
    action: matchedAction,
    ruleId: matchedRuleId,
    ruleName: matchedRuleName,
    evaluationId: evaluation.id,
  };
}
