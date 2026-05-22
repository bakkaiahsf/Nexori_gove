# Regulatory Compliance Check

Run a quick regulatory compliance check on a feature, code change, or design decision.

## Usage
`/regulatory-check [describe what you're building or changing]`

## Steps

1. Delegate to the `regulatory-mapper` sub-agent

2. The agent will assess the feature/change against:
   - DORA (especially Art 5-16 ICT risk, Art 28-44 third-party risk)
   - EU AI Act (especially Art 9 risk management, Art 26 deployer obligations)
   - SOC2 CC6-CC9
   - GDPR Article 5, 25, 30 (if personal data involved)

3. Output a structured compliance flag report:

```
## Regulatory Check: [feature name]
Date: [ISO date]

### 🔴 Blockers (must address before release)
[list]

### 🟡 Significant (address within 2 sprints)
[list]

### 🟢 Advisory (track in backlog)
[list]

### ✅ No Issues Found
[list of checked areas with no issues]

### Recommended GovernanceGates
[list of gates to create for this feature]

### Evidence to Generate
[list of EvidenceItems to create]
```

## When to Run
- Before starting any new feature that touches: AI, user data, external integrations, approvals, audit logging
- Before any change to AIControlSetting logic
- Before adding any third-party service (DORA third-party register update required)
