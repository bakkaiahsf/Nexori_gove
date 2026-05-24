/**
 * Orchestration demo seed — adds connector, trigger rules, and enriches
 * existing cases with context / riskScore / adaptivePipeline / triggerEval.
 * Idempotent: safe to run multiple times.
 */
import { PrismaClient, TriggerAction, GateStatus, ApprovalStatus } from "@prisma/client";
import { DEMO_PROJECT_KEY } from "../src/lib/governance";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding orchestration demo data…");

  const project = await prisma.project.findUnique({
    where: { key: DEMO_PROJECT_KEY },
    select: { id: true },
  });
  if (!project) {
    console.error("❌ Project not found — run `npx prisma db seed` first.");
    process.exit(1);
  }

  // ── 1. Source Connector ────────────────────────────────────────────────────
  const existingConnector = await prisma.sourceConnector.findFirst({
    where: { name: "NexoriBank Jira" },
  });

  const connector =
    existingConnector ??
    (await prisma.sourceConnector.create({
      data: {
        type: "jira",
        name: "NexoriBank Jira",
        baseUrl: "https://nexoribank.atlassian.net",
        credentials: { email: "governance@nexoribank.com", apiToken: "DEMO_TOKEN" },
        webhookSecret: "demo-webhook-secret-nexori",
        projectKeys: ["BANK", "CARDS", "INFRA"],
        enabled: true,
      },
    }));
  console.log(`  ✓ SourceConnector: ${connector.id}`);

  // ── 2. GitHub Connector ────────────────────────────────────────────────────
  const existingGH = await prisma.sourceConnector.findFirst({
    where: { name: "NexoriBank GitHub" },
  });

  const ghConnector =
    existingGH ??
    (await prisma.sourceConnector.create({
      data: {
        type: "github",
        name: "NexoriBank GitHub",
        baseUrl: "https://api.github.com",
        credentials: { token: "DEMO_GITHUB_TOKEN" },
        webhookSecret: "demo-github-webhook-secret",
        projectKeys: ["nexoribank"],
        enabled: true,
      },
    }));
  console.log(`  ✓ GitHubConnector: ${ghConnector.id}`);

  // ── 3. Trigger Rules ───────────────────────────────────────────────────────
  const existingRules = await prisma.governanceTriggerRule.count({
    where: { projectId: project.id },
  });
  if (existingRules === 0) {
    await prisma.governanceTriggerRule.createMany({
      data: [
        {
          projectId: project.id,
          name: "Portfolio Epics → Full Pipeline",
          description:
            "Any Jira Portfolio Epic triggers full governance: context enrichment, risk scoring, adaptive gate pipeline.",
          source: "jira",
          eventType: "epic.created",
          conditions: [{ field: "issueType", op: "eq", value: "Portfolio Epic" }],
          action: TriggerAction.FULL_PIPELINE,
          priority: 200,
          enabled: true,
          createdBy: "admin@nexori.system",
        },
        {
          projectId: project.id,
          name: "PR to main (AI files) → Full Pipeline",
          description:
            "Pull requests targeting main with AI-related file changes require full governance review.",
          source: "github",
          eventType: "pr.opened",
          conditions: [
            { field: "targetBranch", op: "eq", value: "main" },
            { field: "labels", op: "contains", value: "governance-required" },
          ],
          action: TriggerAction.FULL_PIPELINE,
          priority: 180,
          enabled: true,
          createdBy: "admin@nexori.system",
        },
        {
          projectId: project.id,
          name: "Large PRs → Full Pipeline",
          description: "Pull requests changing more than 50 files require governance.",
          source: "github",
          eventType: "pr.opened",
          conditions: [{ field: "filesChanged", op: "gt", value: 50 }],
          action: TriggerAction.FULL_PIPELINE,
          priority: 150,
          enabled: true,
          createdBy: "admin@nexori.system",
        },
        {
          projectId: project.id,
          name: "Infrastructure Epics → Full Pipeline",
          description: "Jira Epics with 'infrastructure' component trigger governance.",
          source: "jira",
          eventType: "epic.created",
          conditions: [{ field: "components", op: "contains", value: "infrastructure" }],
          action: TriggerAction.FULL_PIPELINE,
          priority: 160,
          enabled: true,
          createdBy: "admin@nexori.system",
        },
        {
          projectId: project.id,
          name: "GitLab governance-required MRs → Classify",
          description: "GitLab MRs with governance-required label get risk classified.",
          source: "gitlab",
          eventType: "mr.opened",
          conditions: [{ field: "labels", op: "contains", value: "governance-required" }],
          action: TriggerAction.CLASSIFY_ONLY,
          priority: 120,
          enabled: true,
          createdBy: "admin@nexori.system",
        },
      ],
    });
    console.log("  ✓ GovernanceTriggerRules: 5 rules seeded");
  } else {
    console.log(`  ⚡ TriggerRules: ${existingRules} already exist — skipping`);
  }

  // ── 4. Enrich existing cases with context + riskScore + pipeline + connector ─
  const cases = await prisma.governanceCase.findMany({
    where: { projectId: project.id },
    include: {
      context: true,
      riskScore: true,
      adaptivePipeline: true,
      governanceGates: { orderBy: { order: "asc" } },
    },
  });

  const caseEnrichments = [
    {
      titleFragment: "Change Governance",
      sourceEpicKey: "BANK-2401",
      sourceGovEpicKey: "BANK-GOV-2401",
      context: {
        epicTitle: "Q4 Core Banking Change — Vector Scale Adjustment",
        epicDescription:
          "Adjust the vector scale algorithm in the core lending engine for Q4 delivery.",
        sourceKey: "BANK-2401",
        sourceType: "epic",
        labels: ["q4-delivery", "lending-engine", "production"],
        components: ["core-banking", "lending"],
        environment: "production",
        dataClassification: "financial",
        aiSystemInvolved: false,
        thirdPartyChanges: false,
        infrastructureChange: false,
        priorIncidents: 1,
        lastDeployDaysAgo: 14,
        contextSummary:
          "Core banking lending engine change affecting production. Prior incident in this component 30 days ago. Standard change with CAB approval required. Low AI involvement, no third-party changes.",
      },
      riskScore: {
        productionImpact: 0.75,
        customerImpact: 0.6,
        aiInvolvement: 0.05,
        dataExposure: 0.5,
        infraImpact: 0.3,
        regulatoryExp: 0.65,
        incidentHistory: 0.4,
        thirdPartyRisk: 0.1,
        deploymentCrit: 0.7,
        securitySens: 0.45,
        blastRadius: 0.55,
        compositeScore: 62,
        intensity: "regulated",
        scoringConfidence: 0.87,
        aiModeRecommended: "AI_REVIEW",
        reasoning:
          "Regulated intensity driven by high production impact (0.75) and deployment criticality (0.70). Prior incident history in this component elevates risk. CAB and security sign-off gates are required.",
      },
      pipeline: {
        gatesIncluded: [
          {
            slug: "security-signoff",
            order: 1,
            reason: "Production change in regulated component",
          },
          {
            slug: "cab-approval",
            order: 2,
            reason: "Change Advisory Board required for lending engine",
          },
        ],
        gatesSkipped: [
          { slug: "ai-risk-assessment", skipReason: "AI system not involved", conditionMet: true },
          {
            slug: "dpo-review",
            skipReason: "No personal data classification change",
            conditionMet: true,
          },
        ],
        inheritedApprovals: [],
        totalGateCount: 2,
        reducedFromBaseline: 2,
      },
      triggerEval: {
        sourceType: "jira",
        eventType: "epic.created",
        eventKey: "BANK-2401",
        matched: true,
        action: TriggerAction.FULL_PIPELINE,
        payload: {
          issueType: "Portfolio Epic",
          project: "BANK",
          summary: "Q4 Core Banking Change",
        },
      },
    },
    {
      titleFragment: "AI Model Validation",
      sourceEpicKey: "BANK-2415",
      sourceGovEpicKey: "BANK-GOV-2415",
      context: {
        epicTitle: "AI Model Validation — NEXORI-LR v3.1 EU Deployment",
        epicDescription:
          "EU AI Act compliance validation for NEXORI large-reasoning model production deployment.",
        sourceKey: "BANK-2415",
        sourceType: "epic",
        labels: ["eu-ai-act", "ai-governance", "model-deployment", "high-risk"],
        components: ["ai-platform", "model-registry"],
        environment: "production",
        dataClassification: "confidential",
        aiSystemInvolved: true,
        thirdPartyChanges: false,
        infrastructureChange: false,
        priorIncidents: 0,
        lastDeployDaysAgo: 45,
        contextSummary:
          "EU AI Act high-risk AI system deployment. NEXORI-LR model requires Article 9 risk management, bias/drift review, and human oversight confirmation before production. Two gates: AI Risk Assessment (approved) and Model Deployment Approval (pending).",
      },
      riskScore: {
        productionImpact: 0.8,
        customerImpact: 0.75,
        aiInvolvement: 0.95,
        dataExposure: 0.7,
        infraImpact: 0.4,
        regulatoryExp: 0.9,
        incidentHistory: 0.05,
        thirdPartyRisk: 0.2,
        deploymentCrit: 0.85,
        securitySens: 0.6,
        blastRadius: 0.7,
        compositeScore: 81,
        intensity: "enhanced",
        scoringConfidence: 0.93,
        aiModeRecommended: "AI_REVIEW",
        reasoning:
          "Enhanced intensity: EU AI Act high-risk classification (regulatory exposure 0.90), very high AI involvement (0.95), high customer impact (0.75). Model deployment to production requires Article 9 risk management and human approval chain.",
      },
      pipeline: {
        gatesIncluded: [
          {
            slug: "ai-risk-assessment",
            order: 1,
            reason: "EU AI Act Article 9 — mandatory for AI system",
          },
          {
            slug: "model-deployment-approval",
            order: 2,
            reason: "Human oversight required for AI Act compliance",
          },
          {
            slug: "dpo-review",
            order: 3,
            reason: "Confidential data classification — DPO sign-off required",
          },
        ],
        gatesSkipped: [
          {
            slug: "expedited-review",
            skipReason: "Enhanced intensity — expedited path not available",
            conditionMet: true,
          },
        ],
        inheritedApprovals: [],
        totalGateCount: 3,
        reducedFromBaseline: 1,
      },
      triggerEval: {
        sourceType: "jira",
        eventType: "epic.created",
        eventKey: "BANK-2415",
        matched: true,
        action: TriggerAction.FULL_PIPELINE,
        payload: {
          issueType: "Portfolio Epic",
          labels: ["eu-ai-act", "high-risk"],
          project: "BANK",
        },
      },
    },
    {
      titleFragment: "Third-Party Risk",
      sourceEpicKey: "BANK-2420",
      sourceGovEpicKey: "BANK-GOV-2420",
      context: {
        epicTitle: "Third-Party Risk Assessment — AWS Infrastructure Onboarding",
        epicDescription:
          "DORA Article 28 third-party ICT risk review for expanded AWS infrastructure dependency.",
        sourceKey: "BANK-2420",
        sourceType: "epic",
        labels: ["dora-art28", "third-party", "aws", "infrastructure"],
        components: ["infrastructure", "cloud"],
        environment: "production",
        dataClassification: "confidential",
        aiSystemInvolved: false,
        thirdPartyChanges: true,
        infrastructureChange: true,
        priorIncidents: 0,
        lastDeployDaysAgo: 60,
        contextSummary:
          "DORA Article 28 mandatory review for AWS as critical ICT third-party provider. Infrastructure change increases cloud dependency. DORA review approved; legal DPA amendment pending.",
      },
      riskScore: {
        productionImpact: 0.65,
        customerImpact: 0.55,
        aiInvolvement: 0.05,
        dataExposure: 0.65,
        infraImpact: 0.85,
        regulatoryExp: 0.8,
        incidentHistory: 0.05,
        thirdPartyRisk: 0.9,
        deploymentCrit: 0.6,
        securitySens: 0.55,
        blastRadius: 0.7,
        compositeScore: 71,
        intensity: "enhanced",
        scoringConfidence: 0.89,
        aiModeRecommended: "AI_ASSIST",
        reasoning:
          "Enhanced intensity driven by high third-party risk (0.90) and infrastructure impact (0.85). DORA Article 28 mandatory for critical ICT providers. Legal DPA amendment required before onboarding.",
      },
      pipeline: {
        gatesIncluded: [
          {
            slug: "dora-third-party-review",
            order: 1,
            reason: "DORA Article 28 mandatory for critical ICT provider",
          },
          {
            slug: "legal-signoff",
            order: 2,
            reason: "DPA amendment required for data processing change",
          },
          {
            slug: "security-signoff",
            order: 3,
            reason: "Infrastructure change in production environment",
          },
        ],
        gatesSkipped: [
          { slug: "ai-risk-assessment", skipReason: "No AI system involved", conditionMet: true },
        ],
        inheritedApprovals: [],
        totalGateCount: 3,
        reducedFromBaseline: 1,
      },
      triggerEval: {
        sourceType: "jira",
        eventType: "epic.created",
        eventKey: "BANK-2420",
        matched: true,
        action: TriggerAction.FULL_PIPELINE,
        payload: {
          issueType: "Portfolio Epic",
          components: ["infrastructure"],
          labels: ["dora-art28"],
        },
      },
    },
  ];

  // Get first trigger rule for linking
  const firstRule = await prisma.governanceTriggerRule.findFirst({
    where: { projectId: project.id, source: "jira" },
    orderBy: { priority: "desc" },
  });

  for (const enrich of caseEnrichments) {
    const govCase = cases.find((c) => c.title.includes(enrich.titleFragment));
    if (!govCase) {
      console.log(`  ⚠ Case not found: ${enrich.titleFragment}`);
      continue;
    }

    // Update case with connector link and epic keys
    await prisma.governanceCase.update({
      where: { id: govCase.id },
      data: {
        sourceEpicKey: enrich.sourceEpicKey,
        sourceGovEpicKey: enrich.sourceGovEpicKey,
        sourceConnectorId: connector.id,
      },
    });

    // Context
    if (!govCase.context) {
      await prisma.governanceContext.create({
        data: { caseId: govCase.id, ...enrich.context },
      });
    }

    // Risk score
    if (!govCase.riskScore) {
      await prisma.governanceRiskScore.create({
        data: { caseId: govCase.id, ...enrich.riskScore },
      });
    }

    // Adaptive pipeline
    if (!govCase.adaptivePipeline) {
      const riskScore = await prisma.governanceRiskScore.findUnique({
        where: { caseId: govCase.id },
      });
      if (riskScore) {
        await prisma.adaptivePipeline.create({
          data: {
            caseId: govCase.id,
            riskScoreId: riskScore.id,
            composerVersion: "1.0",
            gatesIncluded: enrich.pipeline.gatesIncluded,
            gatesSkipped: enrich.pipeline.gatesSkipped,
            inheritedApprovals: enrich.pipeline.inheritedApprovals,
            totalGateCount: enrich.pipeline.totalGateCount,
            reducedFromBaseline: enrich.pipeline.reducedFromBaseline,
          },
        });
      }
    }

    // Trigger evaluation
    const existingEval = await prisma.triggerEvaluation.findFirst({
      where: { caseId: govCase.id },
    });
    if (!existingEval) {
      await prisma.triggerEvaluation.create({
        data: {
          ruleId: firstRule?.id ?? null,
          connectorId: connector.id,
          projectId: project.id,
          caseId: govCase.id,
          ...enrich.triggerEval,
        },
      });
    }

    console.log(`  ✓ Enriched: ${govCase.title}`);
  }

  // ── 5. Add a 4th demo case — GitHub PR triggered ───────────────────────────
  const existingGHCase = await prisma.governanceCase.findFirst({
    where: { projectId: project.id, title: { contains: "Payment API" } },
  });

  if (!existingGHCase) {
    const ghRule = await prisma.governanceTriggerRule.findFirst({
      where: { projectId: project.id, source: "github" },
      orderBy: { priority: "desc" },
    });

    const newCase = await prisma.governanceCase.create({
      data: {
        projectId: project.id,
        title: "Payment API Refactor — PR #247 to main",
        description:
          "GitHub PR refactoring the payment processing API with 68 file changes including AI scoring module.",
        phase: "code-review",
        status: "active",
        sourceEpicKey: "nexoribank/core-api#247",
        sourceGovEpicKey: "BANK-GOV-2431",
        sourceConnectorId: ghConnector.id,
        ownedBy: "bakkaiahsf@gmail.com",
      },
    });

    await prisma.governanceContext.create({
      data: {
        caseId: newCase.id,
        epicTitle: "Payment API Refactor — PR #247",
        epicDescription: "Large PR refactoring payment processing with AI scoring module changes.",
        sourceKey: "nexoribank/core-api#247",
        sourceType: "pull_request",
        labels: ["governance-required", "ai-system", "payment"],
        components: ["payment-api", "ai-scoring"],
        environment: "production",
        dataClassification: "financial",
        aiSystemInvolved: true,
        thirdPartyChanges: false,
        infrastructureChange: false,
        priorIncidents: 0,
        lastDeployDaysAgo: 7,
        contextSummary:
          "Large PR (68 files) to main branch of core payment API. AI scoring module included — EU AI Act compliance review required. Financial data classification.",
      },
    });

    const ghRiskScore = await prisma.governanceRiskScore.create({
      data: {
        caseId: newCase.id,
        productionImpact: 0.7,
        customerImpact: 0.8,
        aiInvolvement: 0.6,
        dataExposure: 0.75,
        infraImpact: 0.3,
        regulatoryExp: 0.75,
        incidentHistory: 0.05,
        thirdPartyRisk: 0.1,
        deploymentCrit: 0.8,
        securitySens: 0.7,
        blastRadius: 0.65,
        compositeScore: 74,
        intensity: "enhanced",
        scoringConfidence: 0.85,
        aiModeRecommended: "AI_REVIEW",
        reasoning:
          "Enhanced intensity: high customer impact (0.80) on payment processing, AI involvement (0.60), financial data exposure (0.75). 68-file PR to main requires full governance review.",
      },
    });

    await prisma.adaptivePipeline.create({
      data: {
        caseId: newCase.id,
        riskScoreId: ghRiskScore.id,
        gatesIncluded: [
          {
            slug: "security-signoff",
            order: 1,
            reason: "Payment API with financial data — mandatory",
          },
          {
            slug: "ai-risk-assessment",
            order: 2,
            reason: "AI scoring module detected in changed files",
          },
          { slug: "cab-approval", order: 3, reason: "68-file change to production payment API" },
        ],
        gatesSkipped: [
          {
            slug: "dora-third-party-review",
            skipReason: "No third-party ICT provider change",
            conditionMet: true,
          },
        ],
        inheritedApprovals: [],
        totalGateCount: 3,
        reducedFromBaseline: 1,
      },
    });

    // Gate pipeline for this case
    const secGate = await prisma.governanceGate.create({
      data: {
        caseId: newCase.id,
        name: "Security Sign-off",
        description: "Payment API security review — OWASP, pentest scope.",
        order: 1,
        required: true,
        status: GateStatus.PENDING,
      },
    });

    const aiGate = await prisma.governanceGate.create({
      data: {
        caseId: newCase.id,
        name: "AI Risk Assessment",
        description: "EU AI Act Article 9 — AI scoring module risk review.",
        order: 2,
        required: true,
        status: GateStatus.PENDING,
      },
    });

    await prisma.governanceGate.create({
      data: {
        caseId: newCase.id,
        name: "CAB Approval",
        description: "Change Advisory Board sign-off for production payment API change.",
        order: 3,
        required: true,
        status: GateStatus.PENDING,
      },
    });

    // Create pending approval requests
    const adminUser = await prisma.user.findUnique({ where: { email: "bakkaiahsf@gmail.com" } });
    if (adminUser) {
      await prisma.approvalRequest.create({
        data: {
          gateId: secGate.id,
          requestedById: adminUser.id,
          status: ApprovalStatus.PENDING,
          notes: "Security review for PR #247 — payment processing refactor with 68 files changed.",
          expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        },
      });

      await prisma.approvalRequest.create({
        data: {
          gateId: aiGate.id,
          requestedById: adminUser.id,
          status: ApprovalStatus.PENDING,
          notes: "EU AI Act Article 9 risk assessment — AI scoring module changes detected.",
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      });
    }

    await prisma.triggerEvaluation.create({
      data: {
        ruleId: ghRule?.id ?? null,
        connectorId: ghConnector.id,
        projectId: project.id,
        sourceType: "github",
        eventType: "pr.opened",
        eventKey: "nexoribank/core-api#247",
        matched: true,
        action: TriggerAction.FULL_PIPELINE,
        caseId: newCase.id,
        payload: {
          prNumber: 247,
          repo: "nexoribank/core-api",
          targetBranch: "main",
          filesChanged: 68,
        },
      },
    });

    console.log("  ✓ GitHub PR case created with 3 gates (2 pending approval)");
  } else {
    console.log("  ⚡ GitHub PR case already exists — skipping");
  }

  console.log("\n✅ Orchestration seed complete.");
  console.log("   4 cases · 2 connectors (Jira + GitHub) · 5 trigger rules · full enrichment");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
