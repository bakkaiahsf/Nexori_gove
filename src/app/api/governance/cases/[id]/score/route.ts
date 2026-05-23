import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { scoreGovernanceCase } from "@/lib/scoring/engine";
import { z } from "zod";

const RescoreSchema = z.object({
  regulatoryFrameworks: z.array(z.string()).optional(),
  jurisdiction: z.string().optional(),
  openSecurityFindings: z.number().int().min(0).optional(),
  releaseFrequencyDays: z.number().int().min(1).optional(),
  tenantId: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const governanceCase = await prisma.governanceCase.findUnique({
    where: { id: params.id },
    include: { context: true },
  });

  if (!governanceCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }
  if (!governanceCase.context) {
    return NextResponse.json(
      { error: "Case has no context yet — run context enrichment first" },
      { status: 400 }
    );
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional for re-score
  }

  const parsed = RescoreSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const result = await scoreGovernanceCase(
    params.id,
    governanceCase.context,
    governanceCase.projectId,
    parsed.data
  );

  return NextResponse.json(result);
}
