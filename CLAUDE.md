# NexoriOS — Claude Code Master Context

> **Product:** NexoriOS — Enterprise Governance Operating Platform
> **Founder/Architect:** Bakkaiah (Salesforce Architect, 18yr, AI Agency Founder)
> **Stack:** Next.js · TypeScript · Tailwind CSS · ShadCN UI · Node.js · Prisma · PostgreSQL · Vercel
> **Repo target:** `nexori-governance-os` (new clean repo, not extended Nexus Console)

---

## 1. Product Identity — Read This First

NexoriOS is a **configurable governance operating platform** for regulated enterprises (banking, insurance, fintech). It is NOT a developer copilot, NOT a generic GRC suite, NOT another AI productivity tool.

**Winning product promise:**
> NexoriOS gives regulated organisations one control room for approvals, evidence, delivery risk, and AI oversight across change delivery — with AI that can be enabled, restricted, or switched off at any time.

**Regulatory backdrop (always on):**
- DORA: applied 17 Jan 2025 — ICT risk, incident traceability, third-party oversight
- EU AI Act: prohibited practices from 2 Feb 2025; GPAI/governance from 2 Aug 2025; full application 2 Aug 2026
- FCA / BoE: 75% of UK firms already using AI; data quality, privacy, third-party risk = top concerns
- PCI-DSS, SOC2, ISO 27001 — always relevant in banking context

**What we never do in this product:**
- AI making staffing, employee scoring, customer eligibility, or lending decisions
- Autonomous AI executing code without human-in-the-loop approval
- Bypassing governance gates for speed

---

## 2. Core Architecture — Immutable Decisions

Do not re-propose these. They are decided.

| Layer | Decision |
|---|---|
| Frontend | Next.js 14+ (App Router), TypeScript strict mode, Tailwind + ShadCN UI |
| Backend | Node.js + NestJS (preferred over Express for enterprise structure), Prisma ORM |
| Database | PostgreSQL via Supabase (managed) |
| AI Layer | Anthropic Claude APIs primary; OpenAI as secondary; RAG on pgvector |
| Auth | NextAuth.js Phase 1; Supabase Auth Phase 2; SSO deferred to Phase 2 |
| Infra | Vercel (frontend) + Railway/Render (backend) + GitHub Actions (CI) |
| Event model | Every governance action emits an immutable `GovernanceEvent` — no soft deletes |

### Core Domain Entities
```
Project
GovernanceCase
GovernanceGate          ← approval checkpoints
ApprovalRequest
EvidenceItem            ← immutable, append-only
RiskItem
AIControlSetting        ← per-project AI mode
AIUsageEvent            ← every AI call logged
GovernanceEvent         ← flight recorder (append-only)
RegulatoryMapping       ← evidence → DORA/AI Act/SOC2 control
ThirdPartyDependency    ← DORA third-party register
```

### AI Control Modes (5 states — always enforced)
1. `HUMAN_ONLY` — AI completely disabled, all workflows manual
2. `AI_ASSIST` — AI surfaces suggestions; human decides
3. `AI_REVIEW` — AI reviews, flags risk, human approves
4. `AI_CONTROLLED_ACTION` — AI acts within policy bounds; logged
5. `EMERGENCY_LOCK` — immediate AI shutdown, governance continues uninterrupted

---

## 3. MVP Module Boundaries

### ✅ IN MVP (Sprint 1–4)
- **Governance Timeline** — immutable flight recorder (approvals, risk, AI actions, decisions)
- **AI Control Center** — mode management, policy controls, emergency lock
- **Evidence Engine** — audit packs, release evidence, policy mapping output
- **Executive Governance Dashboard** — delivery health, approval status, risk visibility
- **Regulatory Mapping Engine** — DORA · EU AI Act · SOC2 · ISO controls

### 🔜 PHASE 2 (Do not build now)
SSO hardening · advanced RBAC · autonomous AI execution · marketplace · deep ERP integrations · multi-region · A2A agent protocol

### 🚫 NEVER in this product
Generic AI coding copilot features · developer productivity dashboards · autonomous SDLC flows · agent marketplace · non-governance analytics

---

## 4. Sprint Plan

| Sprint | Focus |
|---|---|
| 1 | Repo setup · GovernanceEvent schema · Dashboard shell · Timeline view |
| 2 | AI Control Center · GovernanceGate approvals · Evidence storage |
| 3 | Regulatory Mapping Engine · Risk dashboard · Approval workflows |
| 4 | Executive demo polish · Audit exports · Vercel hardening |

---

## 5. RAG Architecture Rules

NexoriOS uses RAG for evidence retrieval, regulatory mapping, and governance summaries.

**Always follow:**
- Embed GovernanceEvents, EvidenceItems, and RegulatoryMappings into pgvector
- Chunk size: 512 tokens max per chunk; 50-token overlap
- Retrieval: top-5 semantic + top-3 keyword (hybrid search)
- Every RAG query logged as `AIUsageEvent` with: query, retrieved_chunk_ids, model, tokens_in, tokens_out
- RAG responses always cited with source EvidenceItem IDs — no hallucination tolerated in governance context
- AI Act compliance: RAG outputs for governance decisions must be explainable and auditable

**Prompt engineering defaults for governance RAG:**
```
System: You are a governance evidence assistant for a regulated financial organisation.
Only use retrieved context to answer. If context is insufficient, say so explicitly.
Never invent governance evidence. Cite all source IDs.
```

---

## 6. Code Quality Rules — Non-Negotiable

- TypeScript strict mode always (`"strict": true` in tsconfig)
- No `any` types — use `unknown` + type guards
- Every API route has input validation (Zod)
- Every governance mutation is wrapped in a DB transaction
- Every AI call wrapped in `AIGovernanceMiddleware` — logs tokens, mode, outcome
- No direct DB writes without emitting a `GovernanceEvent`
- Prisma migrations only (never raw ALTER TABLE in production)
- ESLint + Prettier enforced via GitHub Actions
- Test coverage: unit tests for domain logic; integration tests for governance flows
- Security: parameterised queries only; no string interpolation in SQL; OWASP top-10 awareness

---

## 7. File & Folder Conventions

```
/src
  /app               ← Next.js App Router pages
  /components
    /governance      ← governance-specific UI components
    /ai-control      ← AI control plane UI
    /evidence        ← evidence engine UI
    /shared          ← reusable primitives
  /lib
    /governance      ← domain logic (pure functions)
    /ai              ← AI governance middleware + RAG
    /regulatory      ← DORA/EU AI Act mapping logic
    /db              ← Prisma client + query helpers
  /api               ← NestJS controllers or Next.js API routes
  /types             ← shared TypeScript types
  /schemas           ← Zod validation schemas
  /hooks             ← React hooks
/prisma              ← schema.prisma + migrations
/tests               ← unit + integration
/.claude             ← Claude Code agents, commands, settings
```

---

## 8. Domain Language Glossary

Always use these exact terms — never synonyms:

| Term | Meaning |
|---|---|
| `GovernanceGate` | A required checkpoint before delivery can proceed |
| `GovernanceEvent` | Any immutable recorded action in the governance flight recorder |
| `EvidenceItem` | A piece of audit evidence (immutable, append-only) |
| `AIControlSetting` | The current AI mode for a project |
| `AIUsageEvent` | A logged record of every AI invocation |
| `RegulatoryMapping` | A link between an EvidenceItem and a regulatory control |
| `ThirdPartyDependency` | A DORA-required record of ICT third-party providers |
| `ReleaseReadiness` | The computed state of whether a project may proceed to production |
| `EmergencyLock` | Immediate AI shutdown mode; governance always continues |

---

## 9. Regulatory Flag Rules (Always Active)

When writing code or features, always flag if:
- An AI output could be used for employment, lending, or customer-eligibility decisions (EU AI Act high-risk)
- A feature handles personal data without documented lawful basis (GDPR)
- AI is invoked without a corresponding `AIUsageEvent` log entry
- A governance decision is made without a `GovernanceEvent` record
- A third-party AI/model provider is introduced without a `ThirdPartyDependency` record (DORA)
- Any feature bypasses a `GovernanceGate` without documented exception

---

## 10. Output Defaults for Claude Code

- Code: production-ready, no placeholder comments, no TODO stubs unless explicitly asked
- Architecture proposals: RFC format (Problem → Options → Decision → Data Model → API → Open Questions)
- Schema changes: always include Prisma migration file alongside the schema change
- API design: RESTful first; GraphQL only if explicitly requested
- UI components: ShadCN base components + Tailwind utility classes; no inline styles
- Tests: Jest + React Testing Library for frontend; Jest + Supertest for API
- End every complex output with **Open Decisions** + **Next Steps**

---

## 11. Token Optimisation Directives

These rules apply to all Claude Code sessions to minimise token waste:

1. **Read selectively** — only read files relevant to the current task; do not bulk-read entire directories
2. **Use schema files first** — check `/prisma/schema.prisma` and `/src/types/` before reading implementation files
3. **Incremental context** — load one layer at a time (types → schema → API → UI)
4. **Compact summaries** — when summarising existing code, produce a 5-line max summary before proposing changes
5. **Diff-first edits** — always show a targeted diff rather than rewriting entire files
6. **Agent delegation** — use sub-agents (see `.claude/agents/`) for specialised tasks rather than expanding context in one session
7. **No redundant reads** — if a file was read earlier in the session, reference the cached content; do not re-read

---

## 12. Current Project State

- Phase: Pre-code (research complete, architecture decided)
- Next immediate action: Scaffold new `nexori-governance-os` repository
- Research complete: BRBPHRM GovernOS research pack + NexoriOS platform pack
- Design plugin: Figma (via MCP) — connected for UI/UX work
- Key regulatory deadlines: EU AI Act full application 2 Aug 2026

---

*Last updated: 2026-05-22 by Claude Code setup session*
