-- Migration: Trigger Engine, Pull Requests, and enum extensions
-- Adds governance_trigger_rules, trigger_evaluations, pull_requests
-- Adds CASE_CREATED, TRIGGER_MATCHED, TRIGGER_SKIPPED, CONNECTOR_EVENT_RECEIVED to GovernanceEventType
-- Adds FULL_PIPELINE, CLASSIFY_ONLY, SKIP TriggerAction enum

-- 1. New enum for trigger actions
DO $$ BEGIN
    CREATE TYPE "TriggerAction" AS ENUM ('FULL_PIPELINE', 'CLASSIFY_ONLY', 'SKIP');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Extend GovernanceEventType with new values (safe — ADD VALUE is idempotent-ish via DO blocks)
DO $$ BEGIN
    ALTER TYPE "GovernanceEventType" ADD VALUE IF NOT EXISTS 'CASE_CREATED';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE "GovernanceEventType" ADD VALUE IF NOT EXISTS 'TRIGGER_MATCHED';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE "GovernanceEventType" ADD VALUE IF NOT EXISTS 'TRIGGER_SKIPPED';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    ALTER TYPE "GovernanceEventType" ADD VALUE IF NOT EXISTS 'CONNECTOR_EVENT_RECEIVED';
EXCEPTION WHEN others THEN null; END $$;

-- 3. governance_trigger_rules
CREATE TABLE IF NOT EXISTS "governance_trigger_rules" (
    "id"          TEXT NOT NULL,
    "projectId"   TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "source"      TEXT NOT NULL,
    "eventType"   TEXT NOT NULL,
    "conditions"  JSONB NOT NULL,
    "action"      "TriggerAction" NOT NULL,
    "priority"    INTEGER NOT NULL DEFAULT 100,
    "enabled"     BOOLEAN NOT NULL DEFAULT true,
    "createdBy"   TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "governance_trigger_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "governance_trigger_rules_projectId_source_enabled_idx"
    ON "governance_trigger_rules"("projectId", "source", "enabled");

ALTER TABLE "governance_trigger_rules"
    DROP CONSTRAINT IF EXISTS "governance_trigger_rules_projectId_fkey";
ALTER TABLE "governance_trigger_rules"
    ADD CONSTRAINT "governance_trigger_rules_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. trigger_evaluations
CREATE TABLE IF NOT EXISTS "trigger_evaluations" (
    "id"          TEXT NOT NULL,
    "ruleId"      TEXT,
    "connectorId" TEXT,
    "projectId"   TEXT,
    "sourceType"  TEXT NOT NULL,
    "eventType"   TEXT NOT NULL,
    "eventKey"    TEXT NOT NULL,
    "matched"     BOOLEAN NOT NULL,
    "action"      "TriggerAction",
    "caseId"      TEXT,
    "payload"     JSONB NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trigger_evaluations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "trigger_evaluations_projectId_evaluatedAt_idx"
    ON "trigger_evaluations"("projectId", "evaluatedAt");

CREATE INDEX IF NOT EXISTS "trigger_evaluations_sourceType_eventKey_idx"
    ON "trigger_evaluations"("sourceType", "eventKey");

ALTER TABLE "trigger_evaluations"
    DROP CONSTRAINT IF EXISTS "trigger_evaluations_ruleId_fkey";
ALTER TABLE "trigger_evaluations"
    ADD CONSTRAINT "trigger_evaluations_ruleId_fkey"
    FOREIGN KEY ("ruleId") REFERENCES "governance_trigger_rules"("id");

-- 5. pull_requests
CREATE TABLE IF NOT EXISTS "pull_requests" (
    "id"               TEXT NOT NULL,
    "connectorId"      TEXT NOT NULL,
    "prNumber"         INTEGER NOT NULL,
    "repo"             TEXT NOT NULL,
    "title"            TEXT NOT NULL,
    "author"           TEXT NOT NULL,
    "targetBranch"     TEXT NOT NULL,
    "sourceBranch"     TEXT NOT NULL,
    "filesChanged"     INTEGER NOT NULL DEFAULT 0,
    "linesAdded"       INTEGER NOT NULL DEFAULT 0,
    "linesRemoved"     INTEGER NOT NULL DEFAULT 0,
    "labels"           TEXT[] NOT NULL DEFAULT '{}',
    "state"            TEXT NOT NULL DEFAULT 'open',
    "caseId"           TEXT,
    "governanceStatus" TEXT NOT NULL DEFAULT 'pending',
    "externalUrl"      TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mergedAt"         TIMESTAMP(3),
    "closedAt"         TIMESTAMP(3),

    CONSTRAINT "pull_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "pull_requests_connectorId_prNumber_idx"
    ON "pull_requests"("connectorId", "prNumber");

CREATE INDEX IF NOT EXISTS "pull_requests_caseId_idx"
    ON "pull_requests"("caseId");
