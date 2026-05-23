import prisma from "@/lib/db";
import type { GateDefinition, GovernanceContext } from "@prisma/client";

export interface RoutedReviewer {
  email: string;
  name: string | null;
  source: "expert-profile" | "role-fallback";
}

/**
 * Route a gate approval to the best available expert reviewer.
 * Priority: ExpertProfile with matching domain + jurisdiction + lowest workload.
 * Fallback: first matching domain only (ignores jurisdiction).
 * Final fallback: governance-lead env var or configured default.
 */
export async function routeApproval(
  gate: Pick<GateDefinition, "approverRoles">,
  context: GovernanceContext,
  jurisdiction = "GLOBAL"
): Promise<RoutedReviewer | null> {
  if (gate.approverRoles.length === 0) return null;

  const experts = await prisma.expertProfile.findMany({
    where: {
      domains: { hasSome: gate.approverRoles },
    },
    orderBy: { activeApprovals: "asc" },
    take: 20,
  });

  if (experts.length === 0) return null;

  // Prefer jurisdiction match
  const jurisdictionMatch = experts.find(
    (e) => e.jurisdictions.includes(jurisdiction) || e.jurisdictions.includes("GLOBAL")
  );

  const selected = jurisdictionMatch ?? experts[0];

  return {
    email: selected.email,
    name: selected.name,
    source: "expert-profile",
  };
}
