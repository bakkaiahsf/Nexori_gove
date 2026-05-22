# Sprint Review — Governance Check

Run a governance-focused sprint review to confirm all changes meet NexoriOS standards before demo or release.

## Usage
`/sprint-review [sprint-number]`

## Steps

1. Run `git log --oneline --since="[sprint-start]" --until="[sprint-end]"` to get all commits

2. For each changed file, check:
   - [ ] TypeScript strict mode — no `any` types introduced
   - [ ] Zod validation on all new/changed API routes
   - [ ] GovernanceEvents emitted for all new DB mutations
   - [ ] AIUsageEvents logged for all AI calls
   - [ ] No GovernanceGate or EvidenceItem UPDATE/DELETE operations
   - [ ] All new external dependencies added to ThirdPartyDependency register
   - [ ] Security review completed (delegate to `security-reviewer` agent)

3. Check open governance items:
   - Open GovernanceGates (should be 0 for release)
   - Unresolved HIGH/CRITICAL RiskItems (should be 0 for release)
   - Pending ApprovalRequests (should be 0 for release)

4. Compute and output ReleaseReadiness

5. Output sprint review summary:
```
## Sprint [N] Governance Review
Date: [ISO date]

### Code Quality
[pass/fail per check]

### Governance State
- Open Gates: [count]
- Open Risks (HIGH+): [count]
- Pending Approvals: [count]
- Release Readiness: READY / NOT READY / CONDITIONAL

### Actions Required Before Demo/Release
[ordered list]

### Demo Readiness
[yes/no + notes]
```
