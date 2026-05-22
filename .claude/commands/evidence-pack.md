# Generate Evidence Pack

Generate an audit-ready evidence pack for the current project and date range.

## Usage
`/evidence-pack [project-id] [from-date] [to-date] [framework]`

Framework options: `DORA | EU_AI_ACT | SOC2 | ISO27001 | ALL`

## Steps

1. Delegate to the `evidence-generator` sub-agent for full evidence pack production
2. Query parameters to pass to the agent:
   - `projectId` — from the current working context
   - `dateRange` — from/to in ISO 8601
   - `framework` — the regulatory framework to map against
   - `includeAIEvents` — always true
   - `includeThirdParty` — always true

3. The agent will:
   - Fetch all GovernanceEvents in the date range
   - Fetch all EvidenceItems associated with the project
   - Fetch all ApprovalRequests and their outcomes
   - Fetch all AIUsageEvents
   - Compute ReleaseReadiness
   - Map evidence to the requested regulatory framework
   - Identify gaps (explicitly — not silently)

4. Output the evidence pack as a Markdown document to `/docs/evidence-packs/[project-id]-[date]-[framework].md`

5. Generate a SHA-256 hash of the document and record it as an `EvidenceItem` of type `AUDIT_PACK`

6. Emit a `GovernanceEvent` of type `EVIDENCE_PACK_GENERATED`

## Important
Never generate evidence that doesn't exist. If a required EvidenceItem is missing, flag it as a gap — do not synthesise substitute evidence.
