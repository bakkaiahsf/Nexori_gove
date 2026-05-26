

 Here is Claude's plan:
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 NexoriOS — Sprint 5 Production Fix + Remaining Phases

 IMMEDIATE: Production Error Fix (DIGEST: 4170180255)

 Root Cause Analysis

 TypeScript check passes (npm run typecheck exits 0). The production Server Component render error is caused by one or more of:

 1. getConnector() dynamic require() risk — src/lib/connectors/index.ts uses require('./jira'), require('./github'), require('./gitlab') inside
  the function body. In Next.js App Router's webpack production bundle, dynamic require() strings may not be correctly resolved when the module
  is tree-shaken or split. Static imports eliminate this risk.
 2. Intelligence page unguarded Prisma queries — src/app/(app)/intelligence/page.tsx runs 6 Prisma queries including
 prisma.guardrailPush.findMany() with no try-catch. If the production database connection pooler (Supabase) has any issue with the new
 guardrail_pushes table on first hit, the entire page throws and the error boundary fires.
 3. Programs page same pattern — src/app/(app)/admin/programs/page.tsx calls prisma.program.findMany() (new table) with no error handling.
 4. Schema incomplete — GuardrailPush model declares connectorId String with no @relation to SourceConnector. Prisma generates the client
 without the FK constraint, which is valid, but it means SourceConnector has no guardrailPushes back-relation — creating an inconsistency in
 the generated client's type graph.

 Fix Plan (execute in order)

 Fix 1 — src/lib/connectors/index.ts: Replace dynamic require() with static imports
 // BEFORE (inside function body):
 const { JiraConnector } = require("./jira");

 // AFTER (top of file):
 import { JiraConnector } from "./jira";
 import { GitHubConnector } from "./github";
 import { GitLabConnector } from "./gitlab";

 export function getConnector(record: {...}): SourceConnector {
   if (record.type === "jira") return new JiraConnector(record);
   if (record.type === "github") return new GitHubConnector(record);
   if (record.type === "gitlab") return new GitLabConnector(record);
   throw new Error(`No connector implementation for type: ${record.type}`);
 }

 Fix 2 — src/app/(app)/intelligence/page.tsx: Wrap queries in try-catch
 export default async function ComplianceIntelligencePage() {
   let projects: ..., coverageRaw: ..., etc...
   try {
     [projects, coverageRaw, ...] = await Promise.all([...]);
     // sequential aiSetting query here
   } catch {
     // render empty state — "Intelligence data unavailable"
     return <EmptyState />;
   }
   // normal render
 }
 Use let with empty-array defaults before the try block so the render path always has safe values.

 Fix 3 — src/app/(app)/admin/programs/page.tsx: Same try-catch pattern
 export default async function ProgramsPage() {
   try {
     const [programs, allProjects] = await Promise.all([...]);
     return <ProgramsClient programs={programs} allProjects={allProjects} />;
   } catch {
     return <div>Programs data unavailable — database connectivity issue.</div>;
   }
 }

 Fix 4 — prisma/schema.prisma: Complete the GuardrailPush → SourceConnector relation

 In model GuardrailPush, add after the project relation:
 connector SourceConnector @relation(fields: [connectorId], references: [id], onDelete: Cascade)

 In model SourceConnector, add:
 guardrailPushes GuardrailPush[]

 Then run: npx prisma db push (harmless if schema already in sync after this addition).

 Fix 5 — Redeploy
 - npm run typecheck && npm run build locally to verify
 - git add -A && git commit -m "fix: production Server Component error — static connector imports + page resilience"
 - git push origin main
 - Verify Vercel deployment succeeds and intelligence/programs pages load

 Verification

 After deployment:
 - Navigate to /intelligence — page loads with framework posture grid (empty state OK if no guardrail pushes yet)
 - Navigate to /admin/programs — programs list renders
 - Navigate to / — Command Center loads
 - Navigate to /orchestration — loads with all cases

 ---
 Context (Original Sprint 5 Plan)

 Why this plan exists:
 The platform reached 58% alignment in Sprint 4 with strong backend foundations (11-dimension scoring, adaptive pipeline, waiver engine, RAG,
 all live). This plan consolidates 11 screens into 8, adds the critical missing structural layers (Program hierarchy, Gate Bundles,
 Guardrails-as-Code, multi-board), and wires the AI intelligence the backend already computes into every user-facing surface.

 Non-negotiable principles confirmed:
 - Tool-agnostic first: Jira, GitHub, GitLab are equal citizens; no hard-coding to any tool
 - Enterprise-configured: governance frameworks, trigger conditions, pipeline gates, SLAs are all admin-defined per project/program
 - Delivery boost target: 90% delivery efficiency improvement through intelligent governance (fewer surprises, earlier risk visibility,
 AI-guided reviews)
 - Exception dual-tracking: every waiver/exception lives in BOTH the platform (GovernanceWaiver) AND the originating tool (Jira story / GitHub
 issue / GitLab issue) — no single source of truth gaps
 - Screen minimum, intelligence maximum: consolidate to 8 core screens; AI does the heavy lifting in every view

 ---
 Architecture Overview

 Enterprise Admin configures:
   → Programs (groups of projects — e.g. "Digital Banking Platform")
   → Projects (each tagged to 1+ scrum boards — Jira / GitHub Projects / GitLab boards)
   → Frameworks per project (DORA, SOC2, GDPR, Agile, custom)
   → Trigger rules per project (which tool events activate governance)
   → Gate bundles per delivery stage (e.g. "Pre-Prod" bundle = Enterprise Sign-off + UI/UX Review)
   → Expert profiles (who reviews which gate types)

 NexoriOS then:
   → Listens to all connected tools (Jira, GitHub, GitLab — same interface)
   → Evaluates each event against trigger rules → FULL_PIPELINE / CLASSIFY_ONLY / SKIP
   → Runs: context enrichment → 11D risk scoring → adaptive pipeline with gate bundles
   → Routes gates to right experts, tracks SLAs, surfaces AI review of what is missing
   → Pushes governance standards to repos as PRs when frameworks qualify (Guardrails-as-Code)
   → Tracks all exceptions in platform AND originating tool
   → Records everything immutably (GovernanceEvent)

 ---
 Screen Consolidation: 11 → 8

 ┌─────────────────────────┬────────────────────────────────────────────────────────────────────────┬──────────────────────────────────────┐
 │       Old Screen        │                              New Location                              │                Reason                │
 ├─────────────────────────┼────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────┤
 │ Orchestration           │ Keep — enterprise hub                                                  │ Central layer for all tool events    │
 ├─────────────────────────┼────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────┤
 │ Command Center /        │ Keep — renamed Enterprise Hub                                          │ Portfolio-level view                 │
 ├─────────────────────────┼────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────┤
 │ Cases                   │ Keep                                                                   │ Per-project case tracking            │
 ├─────────────────────────┼────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────┤
 │ Release Gate            │ Keep — renamed Release Readiness                                       │ Pre-deployment gate check            │
 ├─────────────────────────┼────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────┤
 │ Flight Recorder         │ Keep                                                                   │ Immutable audit log                  │
 ├─────────────────────────┼────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────┤
 │ Evidence                │ Keep                                                                   │ Evidence + policy management         │
 ├─────────────────────────┼────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────┤
 │ Compliance Intelligence │ Keep (upgraded)                                                        │ Frameworks, posture, guardrails push │
 ├─────────────────────────┼────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────┤
 │ AI Control              │ Keep                                                                   │ Mode management + emergency lock     │
 ├─────────────────────────┼────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────┤
 │ Gov. AI Chat            │ Remove as standalone → persistent sliding panel in every view          │ Not a separate destination           │
 ├─────────────────────────┼────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────┤
 │ Gov. Forecast           │ Remove as standalone → inline panel in Cases + Compliance Intelligence │ Better UX inline                     │
 ├─────────────────────────┼────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────┤
 │ Intelligence (old)      │ Merged into Compliance Intelligence                                    │ Redundant                            │
 └─────────────────────────┴────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────┘

 Result: 8 core screens + persistent AI assistant panel + AI forecast inline.

 ---
 New Data Models Required

 // Program groups multiple projects
 model Program {
   id          String    @id @default(cuid())
   name        String
   description String?
   ownerEmail  String?
   status      String    @default("ACTIVE")
   projects    Project[]
   createdAt   DateTime  @default(now())
   updatedAt   DateTime  @updatedAt
 }

 // Multiple scrum boards per project (Jira board, GitHub Projects, etc.)
 model ProjectBoard {
   id          String          @id @default(cuid())
   projectId   String
   connectorId String
   boardId     String          // external board ID in the tool
   boardName   String
   boardType   String          // "scrum" | "kanban"
   enabled     Boolean         @default(true)
   project     Project         @relation(fields: [projectId], references: [id])
   connector   SourceConnector @relation(fields: [connectorId], references: [id])
   createdAt   DateTime        @default(now())
 }

 // Reusable gate bundles applied at delivery stages
 model GateBundle {
   id          String   @id @default(cuid())
   name        String   // e.g. "Pre-Production Sign-off"
   stage       String   // "planning" | "development" | "pre-prod" | "deployment"
   gateSlugs   String[] // array of GateDefinition slugs included
   frameworks  String[] // which frameworks trigger this bundle
   mandatory   Boolean  @default(false)
   isBuiltIn   Boolean  @default(false)
   projectId   String?  // null = global default, non-null = project override
   createdAt   DateTime @default(now())
   updatedAt   DateTime @updatedAt
 }

 // Tracks guardrails pushed to repos as PRs
 model GuardrailPush {
   id          String   @id @default(cuid())
   projectId   String
   connectorId String
   framework   String   // "GDPR" | "DORA" | "SOC2" etc.
   repoPath    String   // e.g. ".github/governance/gdpr-rules.yaml"
   prUrl       String?
   prNumber    Int?
   status      String   @default("PENDING") // "PENDING" | "MERGED" | "REJECTED" | "FAILED"
   rulesHash   String   // SHA256 of generated YAML — detect drift
   generatedAt DateTime @default(now())
   mergedAt    DateTime?
   project     Project  @relation(fields: [projectId], references: [id])
 }

 Also add to Project model:
 programId     String?
 program       Program?       @relation(fields: [programId], references: [id])
 boards        ProjectBoard[]
 guardrailPushes GuardrailPush[]

 ---
 Guardrails-as-Code Format

 When a project qualifies for a framework, NexoriOS generates and pushes a YAML rules file:

 # .github/governance/gdpr-rules.yaml
 framework: GDPR
 version: "1.0"
 enforced_by: NexoriOS
 project: PROJECT_KEY
 generated_at: 2026-05-25T00:00:00Z
 nexori_case_id: CASE_ID

 gates_required:
   - dpo-review
   - data-processing-assessment
   - privacy-by-design-check

 data_handling:
   personal_data_labeling: required
   encryption_at_rest: required
   retention_policy: required
   cross_border_transfer: review_required

 ai_guardrails:
   prompt_injection_check: enforced
   output_filtering: pii_redacted
   model_logging: required
   human_in_loop: required_for_decisions

 exception_tracking:
   platform_waivers: required
   jira_story: required  # dual-tracking

 Implementation: src/lib/guardrails/generator.ts → generates YAML from framework config
 Push: via SourceConnector.createPullRequest() — all connectors implement this

 ---
 Gate Bundles Pattern

 Gate bundles let admins pre-configure mandatory gate sets per delivery stage. Bundles compose into the adaptive pipeline:

 composeAdaptivePipeline():
   1. Start with baseline gates for risk intensity
   2. Evaluate skip conditions
   3. Apply gate bundles for current delivery stage → add bundle's gateSlugs if not already present
   4. Apply inheritance from related cases
   5. Route to experts

 Built-in bundles (seeded, admin-customisable):
 - pre-production: Enterprise Sign-off, UI/UX Review, Security Review
 - ai-system: AI Ethics Review, Bias Assessment, Human Override Check
 - third-party: Vendor Assessment, DORA Article 28 Check
 - data-change: DPO Review, Data Classification Sign-off

 ---
 Implementation Phases

 Phase 1 — Schema + Migration (1 day)

 Files to create/modify:
 - prisma/schema.prisma — add Program, ProjectBoard, GateBundle, GuardrailPush models; add programId + boards relation to Project
 - prisma/migrations/ — new migration file via npx prisma migrate dev --name add_program_board_bundle_guardrail
 - prisma/seed.ts — seed built-in gate bundles, update existing projects with programId = null

 Phase 2 — Program Hierarchy (1 day)

 Goal: Admin can create Programs and assign projects to them.
 - src/app/(app)/admin/programs/page.tsx — list programs, project count per program
 - src/app/api/admin/programs/route.ts — GET (list), POST (create)
 - src/app/api/admin/programs/[id]/route.ts — PATCH (rename, assign projects), DELETE
 - Update OrchestrationClient — group by Program at top level, Source Type within
 - Update EnterpriseHub (Command Center /) — program-level stats cards

 Phase 3 — Multi-Board Support (1 day)

 Goal: Each project can tag multiple scrum boards from any connector.
 - src/app/(app)/admin/projects/[id]/boards/page.tsx — board management per project
 - src/app/api/admin/projects/[id]/boards/route.ts — GET/POST boards
 - src/lib/connectors/index.ts — add listBoards(): Promise<Board[]> to SourceConnector interface
 - src/lib/connectors/jira.ts — implement listBoards via Jira boards API
 - src/lib/connectors/github.ts — implement listBoards (GitHub Projects)
 - src/lib/connectors/gitlab.ts — implement listBoards (GitLab boards)
 - TriggerRule admin UI — add "board scope" condition option

 Phase 4 — Gate Bundles Admin + Composer Integration (1 day)

 Goal: Admin configures bundles; pipeline composer applies them.
 - src/app/(app)/admin/gate-library/page.tsx — add Bundles tab (list, create, assign to stages)
 - src/app/api/admin/gate-bundles/route.ts — CRUD
 - src/lib/pipeline/composer.ts — after base pipeline composition, call applyGateBundles(caseContext) which fetches active bundles for the
 project and stage, adds missing gate slugs
 - Cases detail page — bundle name shown as group label on gate list ("Bundle: Pre-Production")

 Phase 5 — Compliance Intelligence Upgrade (2 days)

 Goal: Replace old /intelligence page with framework posture, gap analysis, and Guardrails-as-Code push.
 - src/app/(app)/intelligence/page.tsx — rewrite:
   - Framework posture cards (DORA, SOC2, GDPR, etc.) with % evidence coverage per project
   - Gap analysis: which required evidence is missing for each framework + AI narrative
   - Guardrails-as-Code panel: for each framework where project qualifies → "Push Rules" button
   - Policy RAG query panel (existing backend works — just surface it)
 - src/lib/guardrails/generator.ts — generate YAML for a given project + framework
 - src/app/api/guardrails/push/route.ts — POST: generate YAML → call connector.createPullRequest() → write GuardrailPush record +
 GovernanceEvent
 - src/app/api/guardrails/[id]/status/route.ts — GET: check PR merge status, update GuardrailPush.status

 Phase 6 — AI "What's Missing" Review Panel (1 day)

 Goal: Persistent AI reviewer that guides what is missing during every gate review.
 - src/components/governance/AiReviewPanel.tsx — sliding panel, available on Cases detail + Release Readiness + individual gate view
 - Calls src/app/api/ai/review/route.ts (streaming SSE) with: case context, current gate, evidence submitted, framework requirements
 - AI prompt: "Review the governance evidence for this gate against [framework] requirements. List exactly what is missing. Be specific about
 document names, approver roles, or evidence types needed. Cite policy sources."
 - Panel always visible in gate review views — not buried in a separate page

 Phase 7 — Exception Dual-Tracking (1 day)

 Goal: Every waiver/exception auto-creates a linked story in the originating tool.
 - src/lib/waiver/engine.ts — after createGovernanceWaiver(), if case has a sourceConnectorId:
   - Call connector.createStory() with title [EXCEPTION] {gate.name} — {case.title}, description = AI residual risk + compensating controls
   - Call connector.linkIssues(exceptionStoryKey, case.sourceEpicKey) to link back to original epic
   - Write GovernanceEvent(EXCEPTION_STORY_CREATED) with external story key
 - src/app/(app)/cases/[id]/page.tsx — show exception story link alongside waiver record
 - WaiverRequestButton — after submission, show "Exception story created in [connector type]: [key]"

 Phase 8 — GitHub + GitLab Writeback + Nav Cleanup (1 day)

 Goal: Full parity with Jira writeback; nav reduced to 8 core items.
 - src/lib/connectors/github-writeback.ts — writeGovernancePipelineToGitHub(): create GitHub Issue as [GOV] tracking issue with gate checklist
 (markdown task list), link to PR
 - src/lib/connectors/gitlab-writeback.ts — writeGovernancePipelineToGitLab(): create GitLab Issue as [GOV] tracking issue with gate checklist,
  link to MR
 - src/components/governance/SideNav.tsx — remove Gov. AI Chat and Gov. Forecast as nav items; add AI panel trigger icon (persistent
 bottom-right floating button in every view)
 - Gov. Forecast logic moved to inline "Forecast" tab on Cases list + on Compliance Intelligence

 ---
 Files That Must NOT Change (Production-Ready)

 - src/lib/scoring/engine.ts — 11D scoring: correct, do not touch
 - src/lib/pipeline/composer.ts — only extend with applyGateBundles(), don't rewrite
 - src/lib/pipeline/inheritance.ts — correct, do not touch
 - src/lib/pipeline/expert-router.ts — correct, do not touch
 - src/lib/intelligence/context.ts — correct, do not touch
 - src/lib/waiver/engine.ts — extend with dual-tracking, don't rewrite
 - src/lib/rag/ — correct, do not touch
 - src/lib/ai/router.ts — correct, do not touch
 - src/lib/governance.ts — extend only with new GovernanceEvent types
 - src/app/api/webhooks/jira/route.ts, github/route.ts, gitlab/route.ts — correct, do not touch
 - All trigger rule + orchestration pages (just built, working)

 ---
 Delivery Boost Mechanism

 The 90% delivery boost claim is backed by:
 1. Earlier risk signal — governance risk classified at PR/Epic creation, not at release
 2. Gate bundles — no surprise gates appear late in delivery; all gates visible from day 1
 3. AI What's Missing — teams know exactly what to submit for each gate; no back-and-forth
 4. Exception tracking — exceptions resolved in < 24h through dual-tracked Jira story (not email)
 5. Guardrails-as-Code — compliance rules enforced at code commit via repo rules; no manual checklist
 6. Sprint governance summary (future) — sprint planning includes gate effort estimates

 ---
 Verification Checklist

 - [ ] Admin creates Program "Digital Banking", assigns 3 projects → Orchestration shows program grouping
 - [ ] Admin tags Project with 2 Jira boards → trigger rules can scope to board
 - [ ] Admin creates Gate Bundle "Pre-Production": Enterprise Sign-off + UI/UX Review → new case shows both gates grouped as bundle
 - [ ] Project tagged GDPR + admin clicks "Push Rules" → YAML PR created in GitHub/GitLab → GuardrailPush.status = PENDING
 - [ ] PR merged in GitHub → status polled → GuardrailPush.status = MERGED → GovernanceEvent logged
 - [ ] Gate blocked → "What's Missing" AI panel lists specific missing evidence items with policy citations
 - [ ] Waiver requested on blocked gate → AI residual risk shown → approved → [EXCEPTION] Jira story auto-created + linked to original epic
 - [ ] GitHub PR opened to main → trigger rule matches → governance case → [GOV] GitHub Issue created with gate checklist
 - [ ] GitLab MR opened → same flow → [GOV] GitLab Issue with gate checklist
 - [ ] Nav shows 8 items; no standalone Gov. AI Chat or Gov. Forecast pages; AI panel accessible via floating button
 - [ ] Cases list has inline "Forecast" tab showing classification preview for new items