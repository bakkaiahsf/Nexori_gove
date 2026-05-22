# Create or Review a Governance Gate

Create or review a `GovernanceGate` for the current project. A GovernanceGate is a required approval checkpoint before delivery can proceed.

## Usage
`/governance-gate [create|review] [gate-name]`

## Steps

1. **Read context:** Check `/prisma/schema.prisma` for the current GovernanceGate schema, and `/src/types/governance.ts` for the GovernanceGate type definition.

2. **For CREATE — gather these fields:**
   - `name` — descriptive gate name (e.g., "Security Sign-Off", "Regulatory Approval")
   - `gateType` — enum: `SECURITY | REGULATORY | TECHNICAL | BUSINESS | LEGAL`
   - `requiredApprovers` — list of role names (not user IDs) who must approve
   - `minApprovals` — minimum approvals required (integer)
   - `blocksRelease` — boolean (almost always true)
   - `regulatoryMapping` — which DORA/EU AI Act/SOC2 control this gate satisfies
   - `evidenceRequired` — array of required EvidenceItem types

3. **For REVIEW — check:**
   - Is the gate status `APPROVED`, `PENDING`, or `BLOCKED`?
   - Are all required approvers represented?
   - Is the evidence complete?
   - Does this gate satisfy its regulatory mapping?

4. **Generate the Prisma mutation** for creating/updating the GovernanceGate

5. **Emit the GovernanceEvent** for the gate creation/update action

6. **Flag any regulatory implications** — e.g., if this gate maps to DORA Art 11 ICT continuity

7. **Output:**
   ```
   GovernanceGate: [name]
   Type: [gateType]
   Status: [status]
   Required Approvers: [list]
   Regulatory Mapping: [control references]
   Evidence Required: [list]
   GovernanceEvent ID: [UUID of emitted event]
   ```

Always remind: GovernanceGates cannot be deleted once created. They can only be `APPROVED`, `WAIVED` (with documented exception), or `SUPERSEDED`.
