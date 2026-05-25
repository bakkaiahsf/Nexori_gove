/**
 * NexoriOS Demo Seed
 * Creates a compelling, realistic governance scenario for demos.
 *
 * Run: DATABASE_URL="<supabase-url>" npx tsx scripts/demo-seed.ts
 *
 * Story: Salesforce AI Pipeline v2.1 — release blocked by 2 open governance gates.
 * Demo flow:
 *   1. Dashboard shows NO_GO · 2 pending approvals · Delivery Confidence 34%
 *   2. Approve "AI Risk Assessment" gate → CONDITIONAL
 *   3. Approve "Risk Register Update" → all gates clear
 *   4. Release Readiness flips to GO
 *   5. Emergency Lock → Unlock (AI Control drama)
 *   6. Guardrails push → PR opens in GitHub + Jira Story created
 */

import { PrismaClient, AIControlMode, GateStatus, GovernanceEventType, EvidenceType, RegulatoryFramework } from "@prisma/client";

const db = new PrismaClient();
const ACTOR = "bakkaiahsf@gmail.com";

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function hoursAgo(n: number): Date {
  return new Date(Date.now() - n * 3600_000);
}

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  NexoriOS — Demo Seed");
  console.log("═══════════════════════════════════════════════════\n");

  // ── 0. Load real connectors ────────────────────────────────────────────────
  const connectors = await db.sourceConnector.findMany({
    where: { enabled: true },
    select: { id: true, type: true, name: true, projectKeys: true },
  });
  const jiraConn = connectors.find((c) => c.type === "jira");
  const githubConn = connectors.find((c) => c.type === "github");
  console.log(`Found ${connectors.length} connector(s):`);
  connectors.forEach((c) => console.log(`  · [${c.type}] ${c.name}`));

  // ── 1. Clean old demo projects ─────────────────────────────────────────────
  console.log("\n── Cleaning old demo projects...");
  const deleted = await db.project.deleteMany({
    where: { key: { in: ["DORA-Q4-25", "BANKINGALMAI", "SAF-AI"] } },
  });
  console.log(`   Deleted ${deleted.count} old project(s) (cascade clears cases/gates/events)`);

  // ── 2. Program ─────────────────────────────────────────────────────────────
  console.log("\n── Creating Programme...");
  const program = await db.program.create({
    data: {
      name: "Salesforce AI Governance Programme 2026",
      description: "Enterprise AI governance for the Salesforce AI platform — DORA and EU AI Act compliance across all AI-powered products.",
      ownerEmail: ACTOR,
      status: "ACTIVE",
    },
  });
  console.log(`   ✓ Programme: ${program.name} (${program.id})`);

  // ── 3. Project ─────────────────────────────────────────────────────────────
  console.log("\n── Creating Project...");
  const project = await db.project.create({
    data: {
      key: "SAF-AI",
      name: "Salesforce AI Pipeline v2.1",
      description: "Credit risk scoring, customer analytics, and automation pipeline. EU AI Act high-risk classification — human oversight required for all model deployments.",
      domain: "Banking & Financial Services",
      classification: "CONFIDENTIAL",
      ownerEmail: ACTOR,
      status: "active",
      programId: program.id,
    },
  });

  console.log(`   ✓ Project: ${project.name} (${project.id})`);

  // ── 4. AI Control Setting ──────────────────────────────────────────────────
  await db.aIControlSetting.create({
    data: {
      projectId: project.id,
      mode: AIControlMode.AI_REVIEW,
      setBy: ACTOR,
      reason: "EU AI Act Article 13 — AI systems used in credit risk assessment require human oversight and auditability for all production deployments.",
    },
  });
  console.log("   ✓ AI mode: AI_REVIEW");

  // ── 5. GitHub ProjectBoard ─────────────────────────────────────────────────
  if (githubConn) {
    await db.projectBoard.create({
      data: {
        id: `${project.id}:${githubConn.id}:bakkaiahsf/salesforce-ai-pipeline`,
        projectId: project.id,
        connectorId: githubConn.id,
        boardId: "bakkaiahsf/salesforce-ai-pipeline",
        boardName: "salesforce-ai-pipeline",
        boardType: "github-repo",
        enabled: true,
      },
    });
    console.log("   ✓ ProjectBoard: bakkaiahsf/salesforce-ai-pipeline");
  }

  // ── 6. Cases ───────────────────────────────────────────────────────────────
  console.log("\n── Creating Governance Cases...");

  // ── Case 1: AI Model Deployment ──
  const case1 = await db.governanceCase.create({
    data: {
      projectId: project.id,
      title: "AI Model Deployment — Credit Scoring Engine v3.0",
      description: "Deploying updated credit scoring ML model with enhanced bias detection pipeline. Classified as high-risk AI system under EU AI Act Article 6. Full governance pipeline required.",
      phase: "ai-deployment",
      status: "active",
      ownedBy: ACTOR,
      sourceEpicKey: jiraConn ? "SCRUM-42" : null,
      sourceConnectorId: jiraConn?.id ?? null,
    },
  });

  // Case 1 context
  await db.governanceContext.create({
    data: {
      caseId: case1.id,
      epicTitle: "AI Model Deployment — Credit Scoring Engine v3.0",
      epicDescription: "Updated credit scoring model v3.0 with fairness-aware ML pipeline. Production rollout to 3 regions. Affects 420,000 active customers.",
      sourceKey: "SCRUM-42",
      sourceType: "jira",
      labels: ["ai-model", "credit-risk", "eu-ai-act", "high-risk"],
      components: ["credit-engine", "ml-pipeline", "scoring-api"],
      environment: "production",
      dataClassification: "financial",
      aiSystemInvolved: true,
      thirdPartyChanges: false,
      infrastructureChange: false,
      priorIncidents: 0,
      contextSummary: "High-risk AI deployment per EU AI Act. Credit scoring model update with fairness improvements and bias detection. Requires full governance pipeline including AI risk assessment and regulatory clearance before production deployment.",
      enrichedAt: daysAgo(13),
    },
  });

  // Case 1 risk score — Enhanced (high regulatory + AI involvement)
  const risk1 = await db.governanceRiskScore.create({
    data: {
      caseId: case1.id,
      regulatoryExp: 0.95,
      aiInvolvement: 0.95,
      customerImpact: 0.85,
      dataExposure: 0.80,
      productionImpact: 0.75,
      securitySens: 0.70,
      blastRadius: 0.65,
      thirdPartyRisk: 0.20,
      deploymentCrit: 0.80,
      infraImpact: 0.40,
      incidentHistory: 0.10,
      compositeScore: 78,
      scoringConfidence: 0.92,
      intensity: "enhanced",
      aiModeRecommended: "AI_REVIEW",
      reasoning: "EU AI Act high-risk classification + credit scoring impact on 420K customers requires enhanced governance. AI involvement score maxed — full risk pipeline activated.",
      scoredAt: daysAgo(13),
    },
  });

  // Case 1 adaptive pipeline
  await db.adaptivePipeline.create({
    data: {
      caseId: case1.id,
      riskScoreId: risk1.id,
      composerVersion: "1.0",
      totalGateCount: 4,
      reducedFromBaseline: 2,
      gatesIncluded: [
        { slug: "security-architecture-review", order: 1, reason: "Required for all production deployments" },
        { slug: "data-privacy-impact-assessment", order: 2, reason: "EU AI Act Article 10 — data governance" },
        { slug: "ai-risk-bias-assessment", order: 3, reason: "EU AI Act Article 9 — risk management for high-risk AI" },
        { slug: "regulatory-clearance", order: 4, reason: "EU AI Act Article 13 — transparency and oversight" },
      ],
      gatesSkipped: [
        { slug: "standard-change-review", skipReason: "AI deployment phase overrides standard change process", conditionMet: true },
        { slug: "load-testing", skipReason: "Model inference load profile unchanged from v2.8", conditionMet: true },
      ],
    },
  });

  // Case 1 gates
  const [gate1a, gate1b, gate1c, gate1d] = await Promise.all([
    db.governanceGate.create({
      data: {
        caseId: case1.id,
        name: "Security Architecture Review",
        description: "Review of model serving infrastructure, API security, and data pipeline access controls.",
        order: 1, required: true, status: GateStatus.APPROVED,
        approvedAt: daysAgo(10), approvedBy: ACTOR,
        definitionSlug: "security-architecture-review",
      },
    }),
    db.governanceGate.create({
      data: {
        caseId: case1.id,
        name: "Data Privacy Impact Assessment",
        description: "DPIA for the credit scoring model — personal financial data processing, retention, and deletion.",
        order: 2, required: true, status: GateStatus.APPROVED,
        approvedAt: daysAgo(8), approvedBy: ACTOR,
        definitionSlug: "data-privacy-impact-assessment",
      },
    }),
    db.governanceGate.create({
      data: {
        caseId: case1.id,
        name: "AI Risk & Bias Assessment",
        description: "Fairness audit, bias testing across protected attributes, and model card review per EU AI Act Article 9.",
        order: 3, required: true, status: GateStatus.OPEN,
        definitionSlug: "ai-risk-bias-assessment",
      },
    }),
    db.governanceGate.create({
      data: {
        caseId: case1.id,
        name: "EU AI Act Regulatory Clearance",
        description: "Sign-off from compliance team confirming EU AI Act Article 13 transparency obligations are met.",
        order: 4, required: true, status: GateStatus.OPEN,
        definitionSlug: "regulatory-clearance",
      },
    }),
  ]);
  console.log(`   ✓ Case 1: ${case1.title} — 2 APPROVED · 2 OPEN`);

  // ── Case 2: DORA Third-Party Assessment ──
  const case2 = await db.governanceCase.create({
    data: {
      projectId: project.id,
      title: "DORA Third-Party ICT Risk Assessment — AWS Infrastructure",
      description: "Annual DORA Article 28 assessment and re-registration of AWS as critical ICT third-party provider. Contract renewal and risk register update required.",
      phase: "third-party-onboarding",
      status: "active",
      ownedBy: ACTOR,
      sourceEpicKey: jiraConn ? "SCRUM-38" : null,
      sourceConnectorId: jiraConn?.id ?? null,
    },
  });

  await db.governanceContext.create({
    data: {
      caseId: case2.id,
      epicTitle: "DORA Third-Party ICT Risk Assessment — AWS Infrastructure",
      epicDescription: "Annual re-assessment of AWS as critical ICT third-party provider under DORA Article 28. Contract expires Q1 2026.",
      sourceKey: "SCRUM-38",
      sourceType: "jira",
      labels: ["dora", "third-party", "aws", "ict-risk"],
      components: ["aws-infrastructure", "cloud-networking"],
      environment: "production",
      dataClassification: "confidential",
      aiSystemInvolved: false,
      thirdPartyChanges: true,
      infrastructureChange: false,
      priorIncidents: 1,
      contextSummary: "DORA Article 28 mandates annual assessment of critical ICT third-party providers. AWS hosts core banking infrastructure. Last assessment: Q1 2025. Contract renewal due 31 Mar 2026.",
      enrichedAt: daysAgo(9),
    },
  });

  const risk2 = await db.governanceRiskScore.create({
    data: {
      caseId: case2.id,
      regulatoryExp: 0.85,
      thirdPartyRisk: 0.90,
      productionImpact: 0.80,
      infraImpact: 0.75,
      customerImpact: 0.70,
      dataExposure: 0.65,
      deploymentCrit: 0.60,
      securitySens: 0.55,
      aiInvolvement: 0.05,
      blastRadius: 0.70,
      incidentHistory: 0.30,
      compositeScore: 62,
      scoringConfidence: 0.88,
      intensity: "regulated",
      aiModeRecommended: "AI_REVIEW",
      reasoning: "DORA Article 28 critical ICT provider — high regulatory exposure, prior incident (2025 outage), and high blast radius if AWS services degrade.",
      scoredAt: daysAgo(9),
    },
  });

  await db.adaptivePipeline.create({
    data: {
      caseId: case2.id,
      riskScoreId: risk2.id,
      composerVersion: "1.0",
      totalGateCount: 3,
      reducedFromBaseline: 1,
      gatesIncluded: [
        { slug: "vendor-security-assessment", order: 1, reason: "DORA Article 28 — critical ICT provider assessment" },
        { slug: "contract-sla-review", order: 2, reason: "DORA Article 28 — contractual arrangements" },
        { slug: "risk-register-update", order: 3, reason: "DORA Article 6 — ICT risk register maintenance" },
      ],
      gatesSkipped: [
        { slug: "load-testing", skipReason: "Infrastructure-only change, no application deployment", conditionMet: true },
      ],
    },
  });

  const [gate2a, gate2b, gate2c] = await Promise.all([
    db.governanceGate.create({
      data: {
        caseId: case2.id,
        name: "Vendor Security Assessment",
        description: "Review of AWS SOC 2 Type II, ISO 27001 certificates, and penetration test results.",
        order: 1, required: true, status: GateStatus.APPROVED,
        approvedAt: daysAgo(5), approvedBy: ACTOR,
        definitionSlug: "vendor-security-assessment",
      },
    }),
    db.governanceGate.create({
      data: {
        caseId: case2.id,
        name: "Contract & SLA Review",
        description: "Legal review of renewed AWS Enterprise Agreement and SLA terms against DORA Article 30 requirements.",
        order: 2, required: true, status: GateStatus.APPROVED,
        approvedAt: daysAgo(4), approvedBy: ACTOR,
        definitionSlug: "contract-sla-review",
      },
    }),
    db.governanceGate.create({
      data: {
        caseId: case2.id,
        name: "ICT Risk Register Update",
        description: "Update DORA Article 6 risk register with refreshed AWS dependency mapping, SLAs, and concentration risk.",
        order: 3, required: true, status: GateStatus.PENDING,
        definitionSlug: "risk-register-update",
      },
    }),
  ]);

  // ApprovalRequest for gate2c (PENDING gate — shows in dashboard approval queue)
  const approvalReq = await db.approvalRequest.create({
    data: {
      gateId: gate2c.id,
      status: "PENDING",
      requestedAt: hoursAgo(5),
      notes: "Risk register update completed. AWS concentration risk documented. Awaiting governance lead sign-off.",
    },
  });
  console.log(`   ✓ Case 2: ${case2.title} — 2 APPROVED · 1 PENDING (approval queued)`);

  // ── Case 3: GitHub PR — Change Delivery ──
  const case3 = await db.governanceCase.create({
    data: {
      projectId: project.id,
      title: "Payment API Refactor — salesforce-ai-pipeline PR #12",
      description: "Refactoring payment processing API endpoints to improve p99 latency and add DORA-compliant audit logging to all transaction paths.",
      phase: "change-delivery",
      status: "active",
      ownedBy: ACTOR,
      sourceEpicKey: "bakkaiahsf/salesforce-ai-pipeline#12",
      sourceConnectorId: githubConn?.id ?? null,
    },
  });

  await db.governanceContext.create({
    data: {
      caseId: case3.id,
      epicTitle: "Payment API Refactor PR #12",
      epicDescription: "Refactor payment-processing endpoints, add DORA audit logging, improve p99 latency by 40%.",
      sourceKey: "bakkaiahsf/salesforce-ai-pipeline#12",
      sourceType: "github",
      labels: ["payment", "api", "dora", "refactor"],
      components: ["payment-api", "audit-logger"],
      environment: "production",
      dataClassification: "financial",
      aiSystemInvolved: false,
      thirdPartyChanges: false,
      infrastructureChange: false,
      priorIncidents: 0,
      contextSummary: "Payment API refactor with DORA audit logging. Standard change delivery — reduced gate count (3 vs baseline 5). No AI involvement or third-party changes.",
      enrichedAt: daysAgo(6),
    },
  });

  const risk3 = await db.governanceRiskScore.create({
    data: {
      caseId: case3.id,
      regulatoryExp: 0.55,
      productionImpact: 0.60,
      customerImpact: 0.55,
      dataExposure: 0.50,
      securitySens: 0.45,
      deploymentCrit: 0.50,
      blastRadius: 0.40,
      thirdPartyRisk: 0.10,
      aiInvolvement: 0.05,
      infraImpact: 0.25,
      incidentHistory: 0.05,
      compositeScore: 38,
      scoringConfidence: 0.85,
      intensity: "standard",
      aiModeRecommended: "AI_ASSIST",
      reasoning: "Standard change delivery. Payment path change requires DORA audit log gate. No AI or third-party components. Reduced pipeline applied.",
      scoredAt: daysAgo(6),
    },
  });

  await db.adaptivePipeline.create({
    data: {
      caseId: case3.id,
      riskScoreId: risk3.id,
      composerVersion: "1.0",
      totalGateCount: 3,
      reducedFromBaseline: 2,
      gatesIncluded: [
        { slug: "code-review", order: 1, reason: "Required for all change delivery" },
        { slug: "security-scan", order: 2, reason: "Payment path change requires security validation" },
        { slug: "dora-change-impact", order: 3, reason: "DORA Article 9 — change management for ICT systems" },
      ],
      gatesSkipped: [
        { slug: "ai-risk-bias-assessment", skipReason: "No AI components in this change", conditionMet: true },
        { slug: "data-privacy-impact-assessment", skipReason: "No new personal data processing introduced", conditionMet: true },
      ],
    },
  });

  await Promise.all([
    db.governanceGate.create({
      data: {
        caseId: case3.id,
        name: "Code Review",
        description: "Peer review of payment API refactor, DORA audit logging implementation, and test coverage.",
        order: 1, required: true, status: GateStatus.APPROVED,
        approvedAt: daysAgo(3), approvedBy: ACTOR,
      },
    }),
    db.governanceGate.create({
      data: {
        caseId: case3.id,
        name: "Security Scan",
        description: "SAST/DAST scan of refactored payment endpoints. No new vulnerabilities introduced.",
        order: 2, required: true, status: GateStatus.APPROVED,
        approvedAt: daysAgo(1), approvedBy: ACTOR,
      },
    }),
    db.governanceGate.create({
      data: {
        caseId: case3.id,
        name: "DORA Change Impact Assessment",
        description: "Assessment of ICT change impact per DORA Article 9. Rollback plan and communication plan required.",
        order: 3, required: true, status: GateStatus.OPEN,
      },
    }),
  ]);
  console.log(`   ✓ Case 3: ${case3.title} — 2 APPROVED · 1 OPEN`);

  // ── 7. Evidence Items ──────────────────────────────────────────────────────
  console.log("\n── Creating Evidence Items...");

  const ev1 = await db.evidenceItem.create({
    data: {
      projectId: project.id,
      caseId: case1.id,
      type: EvidenceType.DOCUMENT,
      title: "AI Risk Assessment Report — Credit Scoring Engine v3.0",
      description: "Comprehensive risk assessment including bias testing across 12 protected attributes, fairness metrics, and model card per EU AI Act Annex IV.",
      submittedBy: ACTOR,
      submittedAt: daysAgo(12),
      externalRef: "https://salesforceai.atlassian.net/wiki/spaces/SCRUM/pages/ai-risk-v3",
    },
  });
  await db.regulatoryMapping.createMany({
    data: [
      { projectId: project.id, evidenceId: ev1.id, framework: RegulatoryFramework.EU_AI_ACT, controlId: "EU-AIA-ART9", controlName: "Risk Management System", mappedBy: ACTOR, verifiedAt: daysAgo(11), verifiedBy: ACTOR },
      { projectId: project.id, evidenceId: ev1.id, framework: RegulatoryFramework.EU_AI_ACT, controlId: "EU-AIA-ART10", controlName: "Data & Data Governance", mappedBy: ACTOR },
    ],
  });

  const ev2 = await db.evidenceItem.create({
    data: {
      projectId: project.id,
      caseId: case2.id,
      type: EvidenceType.SIGNED_ATTESTATION,
      title: "AWS DORA Third-Party Risk Register — Q1 2026",
      description: "Completed DORA Article 28 risk register entry for AWS as critical ICT provider. Includes concentration risk analysis, exit strategy, and incident response SLAs.",
      submittedBy: ACTOR,
      submittedAt: daysAgo(7),
    },
  });
  await db.regulatoryMapping.createMany({
    data: [
      { projectId: project.id, evidenceId: ev2.id, framework: RegulatoryFramework.DORA, controlId: "DORA-ART28", controlName: "ICT Third-Party Provider Register", mappedBy: ACTOR },
      { projectId: project.id, evidenceId: ev2.id, framework: RegulatoryFramework.DORA, controlId: "DORA-ART30", controlName: "Contractual Arrangements with ICT Providers", mappedBy: ACTOR, verifiedAt: daysAgo(4), verifiedBy: ACTOR },
    ],
  });

  const ev3 = await db.evidenceItem.create({
    data: {
      projectId: project.id,
      caseId: case1.id,
      type: EvidenceType.DOCUMENT,
      title: "Data Privacy Impact Assessment — Customer Analytics Pipeline",
      description: "DPIA for the credit scoring and customer analytics pipeline. Lawful basis: legitimate interests (credit assessment). Data minimisation, retention policy, and deletion procedures documented.",
      submittedBy: ACTOR,
      submittedAt: daysAgo(2),
    },
  });
  await db.regulatoryMapping.createMany({
    data: [
      { projectId: project.id, evidenceId: ev3.id, framework: RegulatoryFramework.EU_AI_ACT, controlId: "EU-AIA-ART13", controlName: "Transparency — High-Risk AI Systems", mappedBy: ACTOR },
      { projectId: project.id, evidenceId: ev3.id, framework: RegulatoryFramework.GDPR, controlId: "GDPR-ART35", controlName: "Data Protection Impact Assessment", mappedBy: ACTOR },
    ],
  });

  const ev4 = await db.evidenceItem.create({
    data: {
      projectId: project.id,
      type: EvidenceType.AUDIT_LOG,
      title: "SOC 2 Type II Audit Report — Salesforce AI Platform 2025",
      description: "External SOC 2 Type II audit covering CC6 (Logical Access), CC7 (System Operations), and Availability criteria. Issued by Deloitte. Valid through Dec 2026.",
      submittedBy: ACTOR,
      submittedAt: daysAgo(1),
    },
  });
  await db.regulatoryMapping.create({
    data: { projectId: project.id, evidenceId: ev4.id, framework: RegulatoryFramework.SOC2, controlId: "CC6.1", controlName: "Logical & Physical Access Controls", mappedBy: ACTOR, verifiedAt: hoursAgo(12), verifiedBy: ACTOR },
  });

  console.log("   ✓ 4 evidence items with 7 regulatory mappings (DORA · EU AI Act · GDPR · SOC2)");

  // ── 8. Governance Events (flight recorder) ─────────────────────────────────
  console.log("\n── Creating Flight Recorder events...");

  const events: Parameters<typeof db.governanceEvent.create>[0]["data"][] = [
    // Case 1 lifecycle
    { projectId: project.id, type: GovernanceEventType.CASE_CREATED, resourceType: "case", resourceId: case1.id, actorEmail: ACTOR, timestamp: daysAgo(14), payload: { title: case1.title, phase: "ai-deployment" } },
    { projectId: project.id, type: GovernanceEventType.CONTEXT_ENRICHED, resourceType: "case", resourceId: case1.id, actorEmail: "system@nexori.ai", timestamp: daysAgo(13), payload: { aiSystemInvolved: true, intensity: "enhanced", gatesRequired: 4 } },
    { projectId: project.id, type: GovernanceEventType.RISK_SCORED, resourceType: "case", resourceId: case1.id, actorEmail: "system@nexori.ai", timestamp: daysAgo(13), payload: { compositeScore: 78, intensity: "enhanced" } },
    { projectId: project.id, type: GovernanceEventType.PIPELINE_ADAPTED, resourceType: "case", resourceId: case1.id, actorEmail: "system@nexori.ai", timestamp: daysAgo(13), payload: { totalGates: 4, reducedFrom: 6, reason: "EU AI Act high-risk pipeline" } },
    { projectId: project.id, type: GovernanceEventType.EVIDENCE_SUBMITTED, resourceType: "evidence", resourceId: ev1.id, actorEmail: ACTOR, timestamp: daysAgo(12), payload: { title: ev1.title } },
    { projectId: project.id, type: GovernanceEventType.GATE_APPROVED, resourceType: "gate", resourceId: gate1a.id, actorEmail: ACTOR, timestamp: daysAgo(10), payload: { gateName: "Security Architecture Review", caseTitle: case1.title } },
    { projectId: project.id, type: GovernanceEventType.GATE_APPROVED, resourceType: "gate", resourceId: gate1b.id, actorEmail: ACTOR, timestamp: daysAgo(8), payload: { gateName: "Data Privacy Impact Assessment", caseTitle: case1.title } },

    // Case 2 lifecycle
    { projectId: project.id, type: GovernanceEventType.CASE_CREATED, resourceType: "case", resourceId: case2.id, actorEmail: ACTOR, timestamp: daysAgo(9), payload: { title: case2.title, phase: "third-party-onboarding" } },
    { projectId: project.id, type: GovernanceEventType.RISK_SCORED, resourceType: "case", resourceId: case2.id, actorEmail: "system@nexori.ai", timestamp: daysAgo(9), payload: { compositeScore: 62, intensity: "regulated" } },
    { projectId: project.id, type: GovernanceEventType.EVIDENCE_SUBMITTED, resourceType: "evidence", resourceId: ev2.id, actorEmail: ACTOR, timestamp: daysAgo(7), payload: { title: ev2.title } },
    { projectId: project.id, type: GovernanceEventType.GATE_APPROVED, resourceType: "gate", resourceId: gate2a.id, actorEmail: ACTOR, timestamp: daysAgo(5), payload: { gateName: "Vendor Security Assessment", caseTitle: case2.title } },
    { projectId: project.id, type: GovernanceEventType.GATE_APPROVED, resourceType: "gate", resourceId: gate2b.id, actorEmail: ACTOR, timestamp: daysAgo(4), payload: { gateName: "Contract & SLA Review", caseTitle: case2.title } },

    // AI mode change
    { projectId: project.id, type: GovernanceEventType.AI_MODE_CHANGED, resourceType: "project", resourceId: project.id, actorEmail: ACTOR, timestamp: daysAgo(3), payload: { from: "AI_ASSIST", to: "AI_REVIEW", reason: "EU AI Act Article 13 — credit scoring model deployment requires human oversight" } },

    // Case 3 lifecycle
    { projectId: project.id, type: GovernanceEventType.CASE_CREATED, resourceType: "case", resourceId: case3.id, actorEmail: "system@nexori.ai", timestamp: daysAgo(6), payload: { title: case3.title, phase: "change-delivery", source: "github" } },
    { projectId: project.id, type: GovernanceEventType.GATE_APPROVED, resourceType: "gate", resourceId: (await db.governanceGate.findFirst({ where: { caseId: case3.id, status: GateStatus.APPROVED, order: 1 } }))!.id, actorEmail: ACTOR, timestamp: daysAgo(3), payload: { gateName: "Code Review" } },
    { projectId: project.id, type: GovernanceEventType.EVIDENCE_SUBMITTED, resourceType: "evidence", resourceId: ev3.id, actorEmail: ACTOR, timestamp: daysAgo(2), payload: { title: ev3.title } },
    { projectId: project.id, type: GovernanceEventType.GATE_APPROVED, resourceType: "gate", resourceId: (await db.governanceGate.findFirst({ where: { caseId: case3.id, status: GateStatus.APPROVED, order: 2 } }))!.id, actorEmail: ACTOR, timestamp: daysAgo(1), payload: { gateName: "Security Scan" } },
    { projectId: project.id, type: GovernanceEventType.EVIDENCE_SUBMITTED, resourceType: "evidence", resourceId: ev4.id, actorEmail: ACTOR, timestamp: hoursAgo(12), payload: { title: ev4.title } },

    // Open approval requests (today)
    { projectId: project.id, type: GovernanceEventType.APPROVAL_REQUESTED, resourceType: "gate", resourceId: gate2c.id, actorEmail: ACTOR, timestamp: hoursAgo(5), payload: { gateName: "ICT Risk Register Update", approvalId: approvalReq.id, caseTitle: case2.title } },
  ];

  for (const evt of events) {
    await db.governanceEvent.create({ data: evt });
  }
  console.log(`   ✓ ${events.length} flight recorder events`);

  // ── 9. Summary ─────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  Demo Seed Complete");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Programme : ${program.name}`);
  console.log(`  Project   : ${project.name} (${project.key})`);
  console.log(`  AI Mode   : AI_REVIEW`);
  console.log(`  Cases     : 3 active`);
  console.log(`    Case 1  : AI Deployment — 2 APPROVED · 2 OPEN   → NO_GO`);
  console.log(`    Case 2  : 3rd Party    — 2 APPROVED · 1 PENDING → CONDITIONAL`);
  console.log(`    Case 3  : Change (GitHub PR) — 2 APPROVED · 1 OPEN → CONDITIONAL`);
  console.log(`  Evidence  : 4 items · 7 regulatory mappings`);
  console.log(`  Events    : ${events.length} in flight recorder`);
  console.log(`  Board     : ${githubConn ? "bakkaiahsf/salesforce-ai-pipeline (GitHub)" : "no GitHub connector found"}`);
  console.log("\n  Demo flow:");
  console.log("  1. Dashboard: NO_GO · 2 open gates · Delivery Confidence ~34%");
  console.log("  2. Cases → Case 1 → Approve 'AI Risk & Bias Assessment' gate → CONDITIONAL");
  console.log("  3. Dashboard → Pending Approvals → Approve 'ICT Risk Register Update' → closes Case 2 gate");
  console.log("  4. Release Readiness flips to GO once all required gates are approved");
  console.log("  5. AI Control → Emergency Lock → Unlock");
  console.log("  6. Intelligence → Push DORA guardrails to salesforce-ai-pipeline → PR + Jira Story");
  console.log("═══════════════════════════════════════════════════\n");

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
