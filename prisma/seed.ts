/**
 * NexoriOS — Governance Seed Data
 * Realistic DORA ICT Risk Programme demo data.
 * Idempotent: upserts the project, skips if data already exists.
 */
import { PrismaClient, GateStatus, ApprovalStatus, RiskSeverity, RiskStatus, EvidenceType, RegulatoryFramework, GovernanceEventType, AIControlMode } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding NexoriOS governance data...");

  // ── Project ──────────────────────────────────────────────────────────────
  const project = await prisma.project.upsert({
    where: { key: "DORA-Q4-25" },
    update: {},
    create: {
      key: "DORA-Q4-25",
      name: "DORA ICT Risk Programme Q4-2025",
      description: "Enterprise ICT risk governance programme aligned to DORA Article 5–16 and EU AI Act obligations.",
      domain: "financial-services",
      classification: "confidential",
      ownerEmail: "bakkaiahsf@gmail.com",
      status: "active",
    },
  });
  console.log(`  ✓ Project: ${project.name}`);

  // ── AI Control Setting ────────────────────────────────────────────────────
  await prisma.aIControlSetting.upsert({
    where: { projectId: project.id },
    update: {},
    create: {
      projectId: project.id,
      mode: AIControlMode.AI_ASSIST,
      setBy: "bakkaiahsf@gmail.com",
      reason: "Default governance mode — AI surfaces suggestions, human decides.",
    },
  });
  console.log("  ✓ AIControlSetting: AI_ASSIST");

  // Skip if cases already seeded
  const existingCases = await prisma.governanceCase.count({ where: { projectId: project.id } });
  if (existingCases > 0) {
    console.log("  ⚡ Data already seeded — skipping.");
    return;
  }

  // ── Users ─────────────────────────────────────────────────────────────────
  const adminUser = await prisma.user.upsert({
    where: { email: "bakkaiahsf@gmail.com" },
    update: {},
    create: { email: "bakkaiahsf@gmail.com", name: "Governance Lead", role: "admin" },
  });
  const approverUser = await prisma.user.upsert({
    where: { email: "cab@nexori.test" },
    update: {},
    create: { email: "cab@nexori.test", name: "CAB Chair", role: "approver" },
  });
  console.log("  ✓ Users: admin + approver");

  // ── GovernanceCases ───────────────────────────────────────────────────────
  const caseChange = await prisma.governanceCase.create({
    data: {
      projectId: project.id,
      title: "Change Governance Review",
      description: "Q4 change delivery governance — security, CAB, and release readiness gates.",
      phase: "change-delivery",
      status: "active",
      ownedBy: adminUser.email,
    },
  });

  const caseAI = await prisma.governanceCase.create({
    data: {
      projectId: project.id,
      title: "AI Model Validation — NEXORI-LR",
      description: "EU AI Act compliance validation for the NEXORI large-reasoning model prior to production deployment.",
      phase: "ai-deployment",
      status: "active",
      ownedBy: adminUser.email,
    },
  });

  const caseTP = await prisma.governanceCase.create({
    data: {
      projectId: project.id,
      title: "Third-Party Risk Assessment — AWS",
      description: "DORA Article 28 third-party ICT risk review for AWS infrastructure.",
      phase: "third-party-onboarding",
      status: "active",
      ownedBy: adminUser.email,
    },
  });
  console.log("  ✓ GovernanceCases: 3");

  // ── GovernanceGates ───────────────────────────────────────────────────────
  const gateSecuritySignoff = await prisma.governanceGate.create({
    data: {
      caseId: caseChange.id,
      name: "Security Sign-off",
      description: "Penetration test complete, CVEs resolved, SIEM alerts reviewed.",
      order: 1,
      required: true,
      status: GateStatus.APPROVED,
      approvedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      approvedBy: approverUser.email,
    },
  });

  const gateCAB = await prisma.governanceGate.create({
    data: {
      caseId: caseChange.id,
      name: "CAB Approval",
      description: "Change Advisory Board sign-off for production release.",
      order: 2,
      required: true,
      status: GateStatus.PENDING,
    },
  });

  const gateAIRisk = await prisma.governanceGate.create({
    data: {
      caseId: caseAI.id,
      name: "AI Risk Assessment Checkpoint",
      description: "EU AI Act Article 9 risk management — bias, drift, explainability review.",
      order: 1,
      required: true,
      status: GateStatus.APPROVED,
      approvedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      approvedBy: adminUser.email,
    },
  });

  const gateModelDeploy = await prisma.governanceGate.create({
    data: {
      caseId: caseAI.id,
      name: "Model Deployment Approval",
      description: "Final human approval for production AI model deployment.",
      order: 2,
      required: true,
      status: GateStatus.PENDING,
    },
  });

  const gateDORAReview = await prisma.governanceGate.create({
    data: {
      caseId: caseTP.id,
      name: "DORA Third-Party Review",
      description: "DORA Article 28 third-party ICT risk assessment complete.",
      order: 1,
      required: true,
      status: GateStatus.APPROVED,
      approvedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      approvedBy: adminUser.email,
    },
  });

  const gateLegal = await prisma.governanceGate.create({
    data: {
      caseId: caseTP.id,
      name: "Legal Sign-off",
      description: "Contract review and DPA amendment for data processing activities.",
      order: 2,
      required: true,
      status: GateStatus.OPEN,
    },
  });

  console.log("  ✓ GovernanceGates: 6 (3 APPROVED, 1 OPEN, 2 PENDING)");

  // ── ApprovalRequests (PENDING) ────────────────────────────────────────────
  const approvalCAB = await prisma.approvalRequest.create({
    data: {
      gateId: gateCAB.id,
      requestedById: adminUser.id,
      status: ApprovalStatus.PENDING,
      notes: "Change request NX-99201 — Vector Scale Adjustment to core lending engine. Low-risk, tested in UAT.",
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
  });

  const approvalModelDeploy = await prisma.approvalRequest.create({
    data: {
      gateId: gateModelDeploy.id,
      requestedById: adminUser.id,
      status: ApprovalStatus.PENDING,
      notes: "NEXORI-LR model v3.1 — neural weight override applied. Alignment score 99.7%. Requires executive sign-off.",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  console.log("  ✓ ApprovalRequests: 2 PENDING");

  // ── RiskItems ─────────────────────────────────────────────────────────────
  await prisma.riskItem.createMany({
    data: [
      {
        projectId: project.id,
        title: "Unauthorized API Egress — Node Cluster VII",
        description: "Anomalous outbound API calls detected from Node Cluster VII. Source unconfirmed. Possible data exfiltration vector.",
        category: "security",
        severity: RiskSeverity.CRITICAL,
        status: RiskStatus.OPEN,
        owner: adminUser.email,
        source: "governance-event",
        raisedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
      {
        projectId: project.id,
        title: "AI Model Alignment Drift — L-Model-2",
        description: "Performance deviation observed in localized reasoning unit. Drift exceeds 0.003 threshold. Monitoring active.",
        category: "ai",
        severity: RiskSeverity.HIGH,
        status: RiskStatus.MITIGATING,
        owner: adminUser.email,
        mitigation: "Increased monitoring frequency. Rollback plan prepared. Human override enabled.",
        source: "ai-extracted",
        raisedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      },
      {
        projectId: project.id,
        title: "Data Locality Certificate Expired",
        description: "GDPR compliance: AWS Frankfurt module-16 data locality certificate expired. Cross-border transfer risk.",
        category: "regulatory",
        severity: RiskSeverity.HIGH,
        status: RiskStatus.OPEN,
        owner: approverUser.email,
        source: "manual",
        raisedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
      {
        projectId: project.id,
        title: "Key Rotation Schedule Overdue",
        description: "Encryption key rotation for production secrets overdue by 12 days. ISO 27001 A.10.1.2 non-compliance.",
        category: "operational",
        severity: RiskSeverity.MEDIUM,
        status: RiskStatus.OPEN,
        owner: adminUser.email,
        source: "manual",
        raisedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project.id,
        title: "Backup Verification Incomplete",
        description: "Monthly DR backup integrity check not completed for 2 storage volumes.",
        category: "technical",
        severity: RiskSeverity.LOW,
        status: RiskStatus.OPEN,
        owner: adminUser.email,
        source: "manual",
        raisedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
    ],
  });
  console.log("  ✓ RiskItems: 5 (1 CRITICAL, 2 HIGH, 1 MEDIUM, 1 LOW)");

  // ── EvidenceItems ─────────────────────────────────────────────────────────
  const ev1 = await prisma.evidenceItem.create({
    data: {
      projectId: project.id,
      caseId: caseChange.id,
      type: EvidenceType.TEST_RESULT,
      title: "Penetration Test Report — Q4 2025",
      description: "External pen test by CyberArk. 0 critical, 2 medium CVEs (both remediated).",
      submittedBy: adminUser.email,
      hash: "sha256:a3f9b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1",
      externalRef: "PENTEST-2025-Q4-001",
    },
  });

  const ev2 = await prisma.evidenceItem.create({
    data: {
      projectId: project.id,
      caseId: caseAI.id,
      type: EvidenceType.AUDIT_LOG,
      title: "AI Training Data Audit — NEXORI-LR",
      description: "Complete audit of training data provenance, bias analysis, and data quality metrics.",
      submittedBy: adminUser.email,
      hash: "sha256:b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5",
      externalRef: "AI-AUDIT-2025-Q4-002",
    },
  });

  const ev3 = await prisma.evidenceItem.create({
    data: {
      projectId: project.id,
      caseId: caseTP.id,
      type: EvidenceType.SIGNED_ATTESTATION,
      title: "DORA Third-Party Risk Attestation — AWS",
      description: "Signed attestation of DORA Article 28 third-party ICT risk assessment.",
      submittedBy: approverUser.email,
      hash: "sha256:c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
    },
  });

  const ev4 = await prisma.evidenceItem.create({
    data: {
      projectId: project.id,
      type: EvidenceType.DOCUMENT,
      title: "Encryption Configuration Review",
      description: "AES-256-GCM implementation review across all data stores. In-transit TLS 1.3 verified.",
      submittedBy: adminUser.email,
      hash: "sha256:d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7",
    },
  });

  console.log("  ✓ EvidenceItems: 4");

  // ── RegulatoryMappings ────────────────────────────────────────────────────
  await prisma.regulatoryMapping.createMany({
    data: [
      { projectId: project.id, evidenceId: ev1.id, framework: RegulatoryFramework.DORA, controlId: "DORA-Art-9", controlName: "ICT security policies", mappedBy: adminUser.email },
      { projectId: project.id, evidenceId: ev1.id, framework: RegulatoryFramework.ISO_27001, controlId: "ISO-A.12.6.1", controlName: "Management of technical vulnerabilities", mappedBy: adminUser.email },
      { projectId: project.id, evidenceId: ev2.id, framework: RegulatoryFramework.EU_AI_ACT, controlId: "AIA-Art-9", controlName: "Risk management system", mappedBy: adminUser.email },
      { projectId: project.id, evidenceId: ev2.id, framework: RegulatoryFramework.EU_AI_ACT, controlId: "AIA-Art-10", controlName: "Data and data governance", mappedBy: adminUser.email },
      { projectId: project.id, evidenceId: ev3.id, framework: RegulatoryFramework.DORA, controlId: "DORA-Art-28", controlName: "Third-party ICT risk management", mappedBy: adminUser.email },
      { projectId: project.id, evidenceId: ev3.id, framework: RegulatoryFramework.GDPR, controlId: "GDPR-Art-44", controlName: "Cross-border data transfer", mappedBy: approverUser.email },
      { projectId: project.id, evidenceId: ev4.id, framework: RegulatoryFramework.ISO_27001, controlId: "ISO-A.10.1.1", controlName: "Encryption policy", mappedBy: adminUser.email },
      { projectId: project.id, evidenceId: ev4.id, framework: RegulatoryFramework.PCI_DSS, controlId: "PCI-Req-3.5", controlName: "Protect stored cardholder data", mappedBy: adminUser.email },
    ],
  });
  console.log("  ✓ RegulatoryMappings: 8");

  // ── ThirdPartyDependencies (DORA Article 28) ──────────────────────────────
  await prisma.thirdPartyDependency.createMany({
    data: [
      {
        projectId: project.id,
        vendorName: "OpenAI",
        serviceType: "ai-model",
        criticality: "critical",
        contractRef: "OPENAI-2025-ENT-001",
        dataProcessed: "governance queries, evidence summaries",
        regionOfHosting: "US-East",
        certifications: ["SOC2-TypeII", "ISO-27001"],
        registeredBy: adminUser.email,
        nextReviewDue: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project.id,
        vendorName: "Anthropic",
        serviceType: "ai-model",
        criticality: "critical",
        contractRef: "ANTHROPIC-2025-ENT-001",
        dataProcessed: "governance queries, regulatory analysis",
        regionOfHosting: "US-West",
        certifications: ["SOC2-TypeII"],
        registeredBy: adminUser.email,
        nextReviewDue: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project.id,
        vendorName: "Supabase",
        serviceType: "cloud",
        criticality: "important",
        contractRef: "SUPABASE-2025-PRO-001",
        dataProcessed: "governance data, evidence, audit logs",
        regionOfHosting: "ap-south-1",
        certifications: ["SOC2-TypeII"],
        registeredBy: adminUser.email,
        nextReviewDue: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      },
      {
        projectId: project.id,
        vendorName: "Vercel",
        serviceType: "cloud",
        criticality: "standard",
        contractRef: "VERCEL-2025-PRO-001",
        dataProcessed: "application serving, edge compute",
        regionOfHosting: "global",
        certifications: ["SOC2-TypeII", "ISO-27001"],
        registeredBy: adminUser.email,
        nextReviewDue: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      },
    ],
  });
  console.log("  ✓ ThirdPartyDependencies: 4 (DORA Art. 28 compliant)");

  // ── GovernanceEvents (flight recorder) ───────────────────────────────────
  const eventBase = { projectId: project.id, actorId: adminUser.id, actorEmail: adminUser.email };
  await prisma.governanceEvent.createMany({
    data: [
      { ...eventBase, type: GovernanceEventType.PROJECT_CREATED, resourceType: "project", resourceId: project.id, payload: { name: project.name }, timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
      { ...eventBase, type: GovernanceEventType.THIRD_PARTY_REGISTERED, resourceType: "third-party", payload: { vendor: "OpenAI", criticality: "critical" }, timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      { ...eventBase, type: GovernanceEventType.THIRD_PARTY_REGISTERED, resourceType: "third-party", payload: { vendor: "Anthropic", criticality: "critical" }, timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      { ...eventBase, type: GovernanceEventType.GATE_APPROVED, resourceType: "gate", resourceId: gateDORAReview.id, payload: { gateName: "DORA Third-Party Review", caseTitle: caseTP.title }, timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      { ...eventBase, type: GovernanceEventType.GATE_APPROVED, resourceType: "gate", resourceId: gateAIRisk.id, payload: { gateName: "AI Risk Assessment Checkpoint", caseTitle: caseAI.title }, timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
      { ...eventBase, type: GovernanceEventType.EVIDENCE_SUBMITTED, resourceType: "evidence", resourceId: ev2.id, payload: { title: ev2.title, type: "AUDIT_LOG" }, timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
      { ...eventBase, type: GovernanceEventType.GATE_APPROVED, resourceType: "gate", resourceId: gateSecuritySignoff.id, payload: { gateName: "Security Sign-off", caseTitle: caseChange.title }, timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
      { ...eventBase, type: GovernanceEventType.EVIDENCE_SUBMITTED, resourceType: "evidence", resourceId: ev1.id, payload: { title: ev1.title, type: "TEST_RESULT" }, timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
      { ...eventBase, type: GovernanceEventType.REGULATORY_MAPPING_ADDED, resourceType: "mapping", payload: { framework: "DORA", controlId: "DORA-Art-9", evidenceTitle: ev1.title }, timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
      { ...eventBase, type: GovernanceEventType.RISK_RAISED, resourceType: "risk", payload: { title: "Data Locality Certificate Expired", severity: "HIGH" }, timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      { ...eventBase, type: GovernanceEventType.APPROVAL_REQUESTED, resourceType: "approval", resourceId: approvalCAB.id, payload: { gateName: "CAB Approval", notes: "Change request NX-99201" }, timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000) },
      { ...eventBase, type: GovernanceEventType.APPROVAL_REQUESTED, resourceType: "approval", resourceId: approvalModelDeploy.id, payload: { gateName: "Model Deployment Approval", notes: "NEXORI-LR v3.1" }, timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000) },
      { ...eventBase, type: GovernanceEventType.RISK_RAISED, resourceType: "risk", payload: { title: "Unauthorized API Egress — Node Cluster VII", severity: "CRITICAL" }, timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000) },
      { ...eventBase, type: GovernanceEventType.AI_INVOCATION, resourceType: "ai", payload: { model: "gpt-4o-mini", action: "governance-assist", outcome: "success", tokensIn: 63, tokensOut: 38 }, timestamp: new Date(Date.now() - 60 * 60 * 1000) },
    ],
  });
  console.log("  ✓ GovernanceEvents: 14 (flight recorder seeded)");

  console.log(`\n✅ Seed complete. Project ID: ${project.id}`);
  console.log(`   Health score inputs: 3/6 gates approved, 1 CRITICAL risk, 2 PENDING approvals`);
}

main()
  .catch((e) => { console.error("Seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
