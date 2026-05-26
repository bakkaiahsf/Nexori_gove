# NexoriOS UX Simplification Fix — Project-First Operating Model

You are improving an existing NexoriOS implementation. Do not rewrite the backend architecture. Do not remove existing connector, scoring, case, evidence, AI, trigger rule, or flight recorder logic.

The goal is to make NexoriOS feel simple, project-first, and low-overhead.

## Core Principle

Users should not feel they are configuring governance.

They should feel:

“Start or link a project once. NexoriOS monitors delivery, highlights risk, creates required Jira/PR/evidence actions, and sends summaries automatically.”

Governance must be embedded into delivery, not a separate overhead.

## New UX Model

Replace scattered operational thinking with three areas:

1. Start / Link Project
2. Project Hub
3. Admin Console

## 1. Start / Link Project Flow

Create a guided wizard called:

“Start or Link Project”

Route:
`/projects/start`

Steps:

### Step 1 — Project Source
User chooses:
- Create new project manually
- Import from Jira
- Link GitHub repo
- Link GitLab project
- Link existing NexoriOS project

### Step 2 — Delivery Sources
Allow linking:
- Jira project
- Jira board
- GitHub repo
- GitLab project
- Confluence space/page
- Policy document

Do not require all sources.
Show optional/required clearly.

### Step 3 — Governance Profile
Default should be:

“Agile Governance”

This is lightweight and default for every project.

Other optional profiles:
- Regulated Delivery
- AI-Sensitive Delivery
- Critical Production Change
- Third-Party Risk
- Custom Profile

Important:
Agile Governance should be default.
All extra controls should be optional unless trigger rules or risk scoring require them.

### Step 4 — Monitoring Level
Options:

- Manual Only
  User runs assessments manually.

- Scheduled Summary
  NexoriOS generates weekly or sprint-based summaries.

- Active Monitoring
  Trigger rules monitor Jira/GitHub/GitLab and create alerts/actions.

- Full Assisted Assurance
  NexoriOS can create Jira items, PRs, evidence requests, and risk notifications when configured conditions are met.

### Step 5 — Notifications
User selects:
- Notify project manager
- Notify project channel
- Create Jira issue only
- Create Jira issue + notify channel
- Weekly summary only
- Sprint summary only

Channels:
- Email
- Slack/Teams placeholder
- Jira comment/story
- Project dashboard only

### Step 6 — Confirmation
Show:
- Linked sources
- Governance profile
- Monitoring schedule
- Notification rules
- What NexoriOS will do automatically
- What still requires human approval

Button:
“Activate Project Monitoring”

## 2. Project Hub

Project Hub must become the main daily screen.

Route:
`/projects/[id]`

Everything should be visible here.

Sections:

### A. Project Header
Show:
- project name
- program name
- Jira project/board
- GitHub/GitLab repo
- Confluence/policy links
- governance profile
- monitoring level
- last sync
- next scheduled summary

Primary actions:
- Run Assessment Now
- Sync Sources
- Generate Sprint Summary
- Generate Weekly Summary
- Configure Monitoring

### B. Delivery Confidence
Show:
- delivery confidence score
- release readiness
- open risk count
- evidence completeness
- pending human actions

Use simple verdict:
- On Track
- Needs Attention
- Blocked
- Ready to Release

### C. What Needs Attention
This is the most important section.

Show only actionable items:
- missing evidence
- overdue review
- risky PR
- stale policy evidence
- unresolved Jira governance issue
- failed connector sync
- trigger rule alert

Avoid showing all governance internals.

### D. Source Links
Show connected sources:
- Jira board
- Jira project
- GitHub repo
- GitLab project
- Confluence page
- policy document

Each source should show:
- connected / failed
- last sync
- open items
- retry button with clear error reason

### E. Assurance Items
Rename visible “Cases” to:

“Assurance Items”

Each item should show:
- source item
- owner
- status
- confidence impact
- required action
- linked Jira/GitHub/GitLab record

Actions:
- comment
- assign
- resolve
- reopen
- request evidence
- create Jira action

### F. Evidence & Documents
Show:
- linked Confluence pages
- uploaded policy documents
- evidence linked to Jira/PR/release
- missing evidence
- reusable evidence

Actions:
- link Confluence
- upload policy/evidence
- request evidence
- generate evidence pack

### G. Monitoring & Schedule
Show:
- active trigger rules
- schedule frequency
- notification recipients
- last run
- next run
- last result

Allow:
- pause monitoring
- manual run
- change schedule
- change notification route

### H. Summary Generator
Support:
- weekly governance summary
- sprint governance summary
- release readiness summary
- risk summary
- evidence gap summary

Output should be usable for:
- sprint meeting
- steering committee
- governance review
- release approval

## 3. Admin Console

Admin should be clear and concise.

Admin is only for setup and enterprise standards.

Admin navigation:

- Programs
- Projects & Sources
- Connectors
- Governance Profiles
- Monitoring Rules
- Notification Rules
- Policy & Frameworks
- Expert Reviewers
- Emergency Controls

Do not mix day-to-day project work into Admin.

## Trigger Rules UX

Trigger rules should not feel technical first.

Rename:
“Trigger Rules”
to:
“Monitoring Rules”

Each rule should clearly show:
- program
- project
- source tool
- Jira board / GitHub repo / GitLab project
- condition
- action
- schedule
- notification target

Examples:
- When high-risk Jira epic is created → create assurance item + notify project manager
- When GitHub PR touches payment files → create readiness check
- When evidence is stale → create Jira task
- Before sprint review → generate governance summary
- Every Friday → send project confidence summary

Actions:
- Create Jira story
- Add Jira comment
- Notify project manager
- Notify project channel
- Generate summary
- Create guardrails PR
- Dashboard only

## Manual vs Automated Monitoring

MVP must support both.

### Manual Mode
User clicks:
- Run Assessment Now
- Generate Summary
- Create Jira Action
- Create Guardrails PR

### Scheduled Mode
System runs based on schedule:
- weekly
- sprint start
- sprint end
- daily
- custom cron

### Triggered Mode
System reacts to:
- Jira epic created/updated
- GitHub PR opened
- GitLab MR opened
- evidence stale
- risk score threshold exceeded
- release readiness changed

## Language Changes

Avoid governance-heavy wording.

Use:
- Delivery Confidence
- Assurance Items
- Readiness Checks
- Monitoring Rules
- Risk Acceptance
- Evidence Pack
- Project Summary
- Operational Drift
- Intelligence Controls

Avoid overusing:
- governance
- compliance
- AI
- gate
- pipeline
- control

## Human Intervention Reduction

NexoriOS should reduce human effort by:
- auto-detecting risks
- auto-linking Jira/PR/evidence
- auto-generating summaries
- auto-creating Jira tasks when configured
- auto-detecting missing evidence
- auto-suggesting reviewers
- auto-highlighting only important risks
- auto-preparing release sign-off documents

But humans must still approve:
- final release decision
- risk acceptance
- AI mode escalation
- regulatory sign-off
- security sign-off

## Do Not Change

Do not rewrite:
- scoring engine
- connector layer
- AI router
- RAG
- evidence models
- governance event system
- trigger rule backend
- waiver/risk acceptance engine
- guardrails PR logic

Only improve:
- UX flow
- naming
- context grounding
- project-first navigation
- monitoring setup
- summary generation
- notification clarity

## Success Criteria

After this change:

1. A user can start or link a project in one guided flow.
2. Every project has Jira/GitHub/GitLab/Confluence/policy context in one hub.
3. Agile Governance is default and lightweight.
4. Extra controls are optional or risk-triggered.
5. Users can choose manual, scheduled, or active monitoring.
6. Weekly and sprint summaries can be generated.
7. Risks can create Jira actions or notifications when configured.
8. Project managers see only what needs attention.
9. Admin remains configuration-only.
10. Governance feels embedded into delivery, not added overhead.

Final product experience:

“Connect the project once. NexoriOS monitors, summarizes, highlights risk, creates required actions, and keeps delivery confidence visible.”