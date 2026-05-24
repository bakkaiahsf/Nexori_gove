-- GovernanceTemplate: admin-configurable governance blueprint table
-- Each template defines which gate categories apply at each stage.
-- AI composer selects specific gates from the gate library per template.

CREATE TABLE "governance_templates" (
  "id"                  TEXT NOT NULL,
  "name"                TEXT NOT NULL,
  "description"         TEXT,
  "icon"                TEXT,
  "effort"              TEXT NOT NULL DEFAULT 'MEDIUM',
  "stages"              JSONB NOT NULL DEFAULT '[]',
  "suggestedFrameworks" TEXT[] NOT NULL DEFAULT '{}',
  "suggestedDomains"    TEXT[] NOT NULL DEFAULT '{}',
  "isBuiltIn"           BOOLEAN NOT NULL DEFAULT false,
  "enabled"             BOOLEAN NOT NULL DEFAULT true,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "governance_templates_pkey" PRIMARY KEY ("id")
);

-- Seed built-in governance templates
INSERT INTO "governance_templates" ("id", "name", "description", "icon", "effort", "stages", "suggestedFrameworks", "suggestedDomains", "isBuiltIn", "enabled", "updatedAt") VALUES
(
  'tpl-agile-delivery',
  'Agile Delivery',
  'Sprint-based delivery with standard quality and release gates.',
  'sprint', 'LOW',
  '[{"stage":"Planning","gateCategories":["change-management"],"gateHints":["expedited-review"]},{"stage":"Development","gateCategories":["technical","security"],"gateHints":["technical-review","security-sign-off"]},{"stage":"Testing","gateCategories":["change-management"],"gateHints":["product-owner-sign-off","ui-ux-review"]},{"stage":"Release","gateCategories":["change-management"],"gateHints":["cab-approval"]}]',
  '{"SOC2"}', '{"fintech","retail","other"}',
  true, true, CURRENT_TIMESTAMP
),
(
  'tpl-ai-deployment',
  'AI System Deployment',
  'EU AI Act compliant pipeline for AI/ML systems entering production.',
  'psychology', 'HIGH',
  '[{"stage":"Planning","gateCategories":["ai-governance","regulatory"],"gateHints":["ai-risk-assessment","conformity-assessment"]},{"stage":"Development","gateCategories":["ai-governance","security"],"gateHints":["fundamental-rights","data-architecture-review"]},{"stage":"Testing","gateCategories":["ai-governance"],"gateHints":["ai-governance-committee"]},{"stage":"Release","gateCategories":["change-management","regulatory"],"gateHints":["product-owner-sign-off","cab-approval"]}]',
  '{"EU_AI_ACT","DORA","ISO_27001"}', '{"banking","insurance","healthcare","fintech"}',
  true, true, CURRENT_TIMESTAMP
),
(
  'tpl-regulatory-change',
  'Regulatory Change Programme',
  'DORA-compliant enterprise change delivery with full evidence trail.',
  'policy', 'HIGH',
  '[{"stage":"Planning","gateCategories":["regulatory","architecture"],"gateHints":["dora-third-party","architecture-team-review"]},{"stage":"Development","gateCategories":["architecture","security"],"gateHints":["data-architecture-review","security-sign-off"]},{"stage":"Testing","gateCategories":["regulatory","operational"],"gateHints":["technical-review"]},{"stage":"Release","gateCategories":["change-management","regulatory"],"gateHints":["product-owner-sign-off","cab-approval"]}]',
  '{"DORA","ISO_27001","SOC2"}', '{"banking","insurance","fintech"}',
  true, true, CURRENT_TIMESTAMP
),
(
  'tpl-third-party-onboarding',
  'Third-Party ICT Onboarding',
  'DORA Article 28 vendor onboarding with due diligence and exit planning.',
  'handshake', 'MEDIUM',
  '[{"stage":"Due Diligence","gateCategories":["regulatory","security"],"gateHints":["dora-third-party","security-sign-off"]},{"stage":"Onboarding","gateCategories":["regulatory","technical"],"gateHints":["dpo-review","technical-review"]},{"stage":"Integration","gateCategories":["architecture"],"gateHints":["architecture-team-review","data-architecture-review"]},{"stage":"Ongoing","gateCategories":["change-management"],"gateHints":["cab-approval"]}]',
  '{"DORA","ISO_27001"}', '{"banking","insurance","fintech"}',
  true, true, CURRENT_TIMESTAMP
),
(
  'tpl-data-infrastructure',
  'Data Infrastructure Change',
  'GDPR and PCI-DSS compliant data pipeline and infrastructure changes.',
  'storage', 'MEDIUM',
  '[{"stage":"Planning","gateCategories":["regulatory","architecture"],"gateHints":["dpo-review","data-architecture-review"]},{"stage":"Development","gateCategories":["security","architecture"],"gateHints":["security-sign-off","architecture-team-review"]},{"stage":"Testing","gateCategories":["technical"],"gateHints":["technical-review"]},{"stage":"Release","gateCategories":["change-management","regulatory"],"gateHints":["product-owner-sign-off","cab-approval"]}]',
  '{"GDPR","PCI_DSS","ISO_27001"}', '{"banking","fintech","healthcare"}',
  true, true, CURRENT_TIMESTAMP
),
(
  'tpl-custom',
  'Custom Configuration',
  'No preset template — define your governance gates and pipeline manually.',
  'build', 'CUSTOM',
  '[]',
  '{}', '{}',
  true, true, CURRENT_TIMESTAMP
);

-- Add sign-off gate definitions missing from the initial seed
-- Data Architecture sign-off gate
INSERT INTO "gate_definitions" ("id", "slug", "name", "description", "category", "defaultSlaHours", "intensityTriggers", "requiredEvidence", "approverRoles", "isBuiltIn", "enabled", "createdAt")
SELECT
  'gate-data-arch-review',
  'data-architecture-review',
  'Data Architecture Sign-off',
  'Data architecture team review of schema changes, data pipeline design, storage decisions, and data governance compliance.',
  'architecture', 48,
  ARRAY['regulated','enhanced','critical'],
  ARRAY['DOCUMENT','DIAGRAM'],
  ARRAY['architecture','data-architecture'],
  true, true, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "gate_definitions" WHERE "slug" = 'data-architecture-review');

-- UI/UX sign-off gate
INSERT INTO "gate_definitions" ("id", "slug", "name", "description", "category", "defaultSlaHours", "intensityTriggers", "requiredEvidence", "approverRoles", "isBuiltIn", "enabled", "createdAt")
SELECT
  'gate-ui-ux-review',
  'ui-ux-review',
  'UI/UX Design Sign-off',
  'UX team and design review of interface changes, user journeys, accessibility compliance, and design system consistency.',
  'technical', 24,
  ARRAY['standard','regulated','enhanced'],
  ARRAY['DOCUMENT','SCREENSHOT'],
  ARRAY['ux','product'],
  true, true, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "gate_definitions" WHERE "slug" = 'ui-ux-review');

-- Product Owner functional sign-off gate
INSERT INTO "gate_definitions" ("id", "slug", "name", "description", "category", "defaultSlaHours", "intensityTriggers", "requiredEvidence", "approverRoles", "isBuiltIn", "enabled", "createdAt")
SELECT
  'gate-product-owner-sign-off',
  'product-owner-sign-off',
  'Product Owner Functional Sign-off',
  'Product Owner confirmation that the delivered functionality meets acceptance criteria and business requirements.',
  'change-management', 24,
  ARRAY['standard','regulated','enhanced','critical'],
  ARRAY['TEST_RESULT','DOCUMENT'],
  ARRAY['product'],
  true, true, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "gate_definitions" WHERE "slug" = 'product-owner-sign-off');

-- Architecture team sign-off gate
INSERT INTO "gate_definitions" ("id", "slug", "name", "description", "category", "defaultSlaHours", "intensityTriggers", "requiredEvidence", "approverRoles", "isBuiltIn", "enabled", "createdAt")
SELECT
  'gate-architecture-team-review',
  'architecture-team-review',
  'Architecture Team Sign-off',
  'Enterprise architecture team review of structural changes, integration patterns, non-functional requirements, and technology decisions.',
  'architecture', 48,
  ARRAY['regulated','enhanced','critical'],
  ARRAY['DOCUMENT','DIAGRAM'],
  ARRAY['architecture'],
  true, true, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "gate_definitions" WHERE "slug" = 'architecture-team-review');
