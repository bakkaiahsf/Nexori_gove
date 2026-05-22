# Validate Schema Against Governance Rules

Validate the current Prisma schema against NexoriOS governance architecture rules.

## Usage
`/schema-validate`

## Steps

1. Read `/prisma/schema.prisma`

2. Check every model against governance rules:

### Append-Only Models (must have no UPDATE/DELETE routes)
- `GovernanceEvent`
- `EvidenceItem`
- `AIUsageEvent`

Verify: No Prisma middleware or service layer allows `update` or `delete` on these models.

### Required Fields Check
Every model must have:
- `id` — `@id @default(uuid())`
- `createdAt` — `@default(now())`
- `updatedAt` — `@updatedAt`
- `createdBy` — reference to User
- `tenantId` — String (for future multi-tenancy)
- `metadata` — Json? (for extensibility)

### Enum Completeness
- `AIControlMode` must have exactly: `HUMAN_ONLY | AI_ASSIST | AI_REVIEW | AI_CONTROLLED_ACTION | EMERGENCY_LOCK`
- `GovernanceGateStatus` must have: `PENDING | IN_REVIEW | APPROVED | WAIVED | SUPERSEDED | BLOCKED`
- `RiskSeverity` must have: `CRITICAL | HIGH | MEDIUM | LOW | INFORMATIONAL`

### Index Check
- `GovernanceEvent`: index on `(tenantId, projectId, createdAt)`
- `EvidenceItem`: index on `(tenantId, projectId, evidenceType)`
- `AIUsageEvent`: index on `(tenantId, projectId, createdAt)`
- `RegulatoryMapping`: index on `(framework, controlId)`

### Cascade Rules
- `GovernanceEvent` → Project: `onDelete: Restrict` (never cascade-delete audit records)
- `EvidenceItem` → Project: `onDelete: Restrict`

3. Output:
```
## Schema Validation Report
Date: [ISO date]

### ✅ Passing
[list]

### ❌ Violations (must fix)
[model] → [rule violated] → [fix]

### ⚠️ Warnings
[list]
```
