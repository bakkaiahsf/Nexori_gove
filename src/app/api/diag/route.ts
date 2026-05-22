import prisma from "@/lib/db";
import { getProjectSummary, getPendingApprovals, getEscalations, DEMO_PROJECT_KEY } from "@/lib/governance";

export const dynamic = "force-dynamic";

export async function GET() {
  const results: Record<string, unknown> = {};

  try {
    results.step = "project-lookup";
    const project = await prisma.project.findUnique({
      where: { key: DEMO_PROJECT_KEY },
      select: { id: true },
    });
    results.project = project;

    if (!project) return Response.json({ error: "No project found", results });

    results.step = "getProjectSummary";
    results.summary = await getProjectSummary(project.id);

    results.step = "getPendingApprovals";
    results.approvals = (await getPendingApprovals(project.id)).length;

    results.step = "getEscalations";
    results.escalations = (await getEscalations(project.id)).length;

    results.step = "done";
    return Response.json({ ok: true, results });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack?.split("\n").slice(0, 8).join("\n") : null, results },
      { status: 500 }
    );
  }
}
