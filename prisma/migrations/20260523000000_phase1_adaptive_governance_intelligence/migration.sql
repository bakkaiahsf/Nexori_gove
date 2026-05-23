CREATE EXTENSION IF NOT EXISTS vector;
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AIControlMode" ADD VALUE 'AI_GOVERNED';
ALTER TYPE "AIControlMode" ADD VALUE 'AI_RESTRICTED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "GovernanceEventType" ADD VALUE 'CONTEXT_ENRICHED';
ALTER TYPE "GovernanceEventType" ADD VALUE 'RISK_SCORED';
ALTER TYPE "GovernanceEventType" ADD VALUE 'PIPELINE_ADAPTED';
ALTER TYPE "GovernanceEventType" ADD VALUE 'GATE_SKIPPED';
ALTER TYPE "GovernanceEventType" ADD VALUE 'APPROVAL_INHERITED';
ALTER TYPE "GovernanceEventType" ADD VALUE 'WAIVER_REQUESTED';
ALTER TYPE "GovernanceEventType" ADD VALUE 'WAIVER_APPROVED';
ALTER TYPE "GovernanceEventType" ADD VALUE 'JIRA_WRITEBACK_COMPLETE';

-- AlterTable
ALTER TABLE "governance_cases" ADD COLUMN     "sourceConnectorId" TEXT,
ADD COLUMN     "sourceEpicKey" TEXT,
ADD COLUMN     "sourceGovEpicKey" TEXT;

-- AlterTable
ALTER TABLE "governance_gates" ADD COLUMN     "definitionSlug" TEXT,
ADD COLUMN     "inheritedFrom" TEXT,
ADD COLUMN     "skipReason" TEXT,
ADD COLUMN     "skipped" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sourceStoryKey" TEXT;

-- CreateTable
CREATE TABLE "source_connectors" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "credentials" JSONB NOT NULL,
    "webhookSecret" TEXT,
    "projectKeys" TEXT[],
    "fieldMapping" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_connectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "epic_snapshots" (
    "id" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "labels" TEXT[],
    "components" TEXT[],
    "customFields" JSONB,
    "timeline" JSONB,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "epic_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance_contexts" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "epicTitle" TEXT NOT NULL,
    "epicDescription" TEXT,
    "sourceKey" TEXT,
    "sourceType" TEXT,
    "labels" TEXT[],
    "components" TEXT[],
    "environment" TEXT,
    "dataClassification" TEXT,
    "aiSystemInvolved" BOOLEAN NOT NULL DEFAULT false,
    "thirdPartyChanges" BOOLEAN NOT NULL DEFAULT false,
    "infrastructureChange" BOOLEAN NOT NULL DEFAULT false,
    "linkedSystemIds" TEXT[],
    "priorIncidents" INTEGER NOT NULL DEFAULT 0,
    "lastDeployDaysAgo" INTEGER,
    "confluenceRefs" TEXT[],
    "contextSummary" TEXT,
    "enrichedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "governance_contexts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance_risk_scores" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "productionImpact" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "customerImpact" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aiInvolvement" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dataExposure" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "infraImpact" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "regulatoryExp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "incidentHistory" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "thirdPartyRisk" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deploymentCrit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "securitySens" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "blastRadius" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "compositeScore" DOUBLE PRECISION NOT NULL,
    "intensity" TEXT NOT NULL,
    "scoringConfidence" DOUBLE PRECISION NOT NULL,
    "aiModeRecommended" TEXT NOT NULL,
    "reasoning" TEXT,
    "retrievedPolicyIds" TEXT[],
    "scoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "governance_risk_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gate_definitions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "defaultSlaHours" INTEGER NOT NULL DEFAULT 24,
    "intensityTriggers" TEXT[],
    "skipConditions" JSONB,
    "requiredEvidence" TEXT[],
    "approverRoles" TEXT[],
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gate_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adaptive_pipelines" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "riskScoreId" TEXT NOT NULL,
    "composerVersion" TEXT NOT NULL DEFAULT '1.0',
    "gatesIncluded" JSONB NOT NULL,
    "gatesSkipped" JSONB NOT NULL,
    "inheritedApprovals" JSONB,
    "totalGateCount" INTEGER NOT NULL,
    "reducedFromBaseline" INTEGER NOT NULL DEFAULT 0,
    "composedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adaptive_pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance_waivers" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "caseId" TEXT,
    "gateId" TEXT,
    "requestedBy" TEXT NOT NULL,
    "waiverType" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "residualRisk" TEXT,
    "compensatingControls" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "auditBundle" JSONB,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "governance_waivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expert_profiles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "domains" TEXT[],
    "jurisdictions" TEXT[],
    "activeApprovals" INTEGER NOT NULL DEFAULT 0,
    "avgResolutionHours" DOUBLE PRECISION,
    "lastActiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expert_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_documents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" TEXT,
    "effectiveAt" TIMESTAMP(3),
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "indexedAt" TIMESTAMP(3),

    CONSTRAINT "policy_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_chunks" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "embedding" vector(1536),
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "epic_snapshots_connectorId_idx" ON "epic_snapshots"("connectorId");

-- CreateIndex
CREATE INDEX "epic_snapshots_sourceKey_idx" ON "epic_snapshots"("sourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "governance_contexts_caseId_key" ON "governance_contexts"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "governance_risk_scores_caseId_key" ON "governance_risk_scores"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "gate_definitions_slug_key" ON "gate_definitions"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "adaptive_pipelines_caseId_key" ON "adaptive_pipelines"("caseId");

-- CreateIndex
CREATE INDEX "governance_waivers_projectId_idx" ON "governance_waivers"("projectId");

-- CreateIndex
CREATE INDEX "governance_waivers_caseId_idx" ON "governance_waivers"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "expert_profiles_email_key" ON "expert_profiles"("email");

-- CreateIndex
CREATE INDEX "policy_chunks_documentId_idx" ON "policy_chunks"("documentId");

-- AddForeignKey
ALTER TABLE "epic_snapshots" ADD CONSTRAINT "epic_snapshots_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "source_connectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_contexts" ADD CONSTRAINT "governance_contexts_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "governance_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_risk_scores" ADD CONSTRAINT "governance_risk_scores_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "governance_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adaptive_pipelines" ADD CONSTRAINT "adaptive_pipelines_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "governance_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_waivers" ADD CONSTRAINT "governance_waivers_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_chunks" ADD CONSTRAINT "policy_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "policy_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

