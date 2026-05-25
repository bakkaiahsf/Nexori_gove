import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/db";
import { evaluateTriggerRules } from "@/lib/governance/trigger";
import { orchestrateGovernanceCase } from "@/lib/governance/orchestrate";
import { TriggerAction } from "@prisma/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function verifySignature(rawBody: Buffer, signature: string, secret: string): boolean {
  try {
    const expected = `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`;
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = Buffer.from(await req.arrayBuffer());
  const connectorId = req.nextUrl.searchParams.get("connectorId");
  const signatureHeader =
    req.headers.get("x-webhook-secret") ??
    req.headers.get("x-hub-signature-256") ??
    "";

  if (!connectorId) {
    return NextResponse.json({ error: "Missing connectorId parameter" }, { status: 400 });
  }

  const connector = await prisma.sourceConnector.findUnique({
    where: { id: connectorId },
    select: { id: true, type: true, name: true, webhookSecret: true, enabled: true },
  });

  if (!connector) return NextResponse.json({ error: "Connector not found" }, { status: 404 });
  if (!connector.enabled) return NextResponse.json({ error: "Connector disabled" }, { status: 403 });

  if (connector.webhookSecret && signatureHeader) {
    if (!verifySignature(rawBody, signatureHeader, connector.webhookSecret)) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody.toString("utf-8")) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const eventType = String(
    body.eventType ?? body.event_type ?? body.event ?? body.webhookEvent ?? "generic.event"
  );
  const entityKey = String(body.entityKey ?? body.key ?? body.id ?? `GENERIC-${Date.now()}`);
  const entityTitle = String(body.entityTitle ?? body.title ?? body.summary ?? body.name ?? eventType);
  const entityDescription = String(body.entityDescription ?? body.description ?? body.body ?? "");
  const rawLabels = body.labels ?? body.tags ?? body.categories ?? [];
  const labels = Array.isArray(rawLabels)
    ? rawLabels.map(String)
    : typeof rawLabels === "string"
      ? rawLabels.split(",").map((l) => l.trim())
      : [];

  // Find projects with trigger rules for this connector type
  const projects = await prisma.project.findMany({
    where: {
      status: "active",
      triggerRules: { some: { source: connector.type, enabled: true } },
    },
    select: { id: true, key: true },
  });

  if (projects.length === 0) {
    return NextResponse.json({ received: true, matched: false, reason: "No projects with matching trigger rules" });
  }

  const epicData = {
    key: entityKey,
    title: entityTitle,
    description: entityDescription,
    labels,
    components: [],
    environment: String(body.environment ?? ""),
    dataClassification: String(body.dataClassification ?? ""),
    aiSystemInvolved: labels.some((l) => /\bai\b|ml\b/i.test(l)),
    thirdPartyChanges: labels.some((l) => /third.?party|vendor/i.test(l)),
    infrastructureChange: labels.some((l) => /infra/i.test(l)),
    regulatoryDomain: String(body.regulatoryDomain ?? ""),
    jurisdiction: String(body.jurisdiction ?? "GLOBAL"),
    confluencePageUrls: [],
    customFields: body,
  };

  let casesOpened = 0;

  for (const project of projects) {
    try {
      const evalResult = await evaluateTriggerRules({
        projectId: project.id,
        sourceType: connector.type,
        eventType,
        eventKey: entityKey,
        payload: body,
        connectorId,
      });

      if (
        evalResult.matched &&
        evalResult.action !== null &&
        evalResult.action !== TriggerAction.SKIP
      ) {
        await orchestrateGovernanceCase({
          projectId: project.id,
          sourceKey: entityKey,
          epicData,
          sourceConnectorId: connectorId,
          snapshotOverrides: { sourceType: connector.type },
        });
        casesOpened++;
      }
    } catch {
      // Continue to next project
    }
  }

  return NextResponse.json({
    received: true,
    matched: casesOpened > 0,
    projectsEvaluated: projects.length,
    casesOpened,
  });
}
