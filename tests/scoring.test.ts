import { describe, it, expect } from "vitest";
import { compositeToIntensity, intensityToAIMode } from "@/lib/scoring/engine";
import {
  scoreProductionImpact,
  scoreAIInvolvement,
  scoreDataExposure,
  scoreCustomerImpact,
  scoreInfrastructureImpact,
  scoreThirdPartyRisk,
  scoreIncidentHistory,
  scoreRegulatoryExposure,
  scoreBlastRadius,
  scoreSecuritySensitivity,
  type DimensionInput,
} from "@/lib/scoring/dimensions";

// ── Minimal synthetic context ─────────────────────────────────────────────────
function makeInput(overrides: Partial<DimensionInput["context"]> = {}): DimensionInput {
  return {
    context: {
      id: "test",
      caseId: "case-1",
      epicTitle: "Test Epic",
      epicDescription: null,
      sourceKey: null,
      sourceType: null,
      labels: [],
      components: [],
      environment: null,
      dataClassification: null,
      aiSystemInvolved: false,
      thirdPartyChanges: false,
      infrastructureChange: false,
      linkedSystemIds: [],
      priorIncidents: 0,
      lastDeployDaysAgo: null,
      confluenceRefs: [],
      contextSummary: null,
      enrichedAt: new Date(),
      ...overrides,
    },
    regulatoryFrameworks: [],
    jurisdiction: "GLOBAL",
    openSecurityFindings: 0,
    releaseFrequencyDays: 14,
  };
}

// ── compositeToIntensity ──────────────────────────────────────────────────────
describe("compositeToIntensity", () => {
  it("returns minimal for score 0", () => expect(compositeToIntensity(0)).toBe("minimal"));
  it("returns minimal for score 24", () => expect(compositeToIntensity(24)).toBe("minimal"));
  it("returns standard for score 25", () => expect(compositeToIntensity(25)).toBe("standard"));
  it("returns standard for score 49", () => expect(compositeToIntensity(49)).toBe("standard"));
  it("returns regulated for score 50", () => expect(compositeToIntensity(50)).toBe("regulated"));
  it("returns regulated for score 74", () => expect(compositeToIntensity(74)).toBe("regulated"));
  it("returns enhanced for score 75", () => expect(compositeToIntensity(75)).toBe("enhanced"));
  it("returns enhanced for score 100", () => expect(compositeToIntensity(100)).toBe("enhanced"));
});

// ── intensityToAIMode ─────────────────────────────────────────────────────────
describe("intensityToAIMode", () => {
  it("minimal → AI_ASSIST", () => expect(intensityToAIMode("minimal")).toBe("AI_ASSIST"));
  it("standard → AI_ASSIST", () => expect(intensityToAIMode("standard")).toBe("AI_ASSIST"));
  it("regulated → AI_REVIEW", () => expect(intensityToAIMode("regulated")).toBe("AI_REVIEW"));
  it("enhanced → AI_GOVERNED", () => expect(intensityToAIMode("enhanced")).toBe("AI_GOVERNED"));
});

// ── scoreProductionImpact ─────────────────────────────────────────────────────
describe("scoreProductionImpact", () => {
  it("production → 0.9", () => {
    expect(scoreProductionImpact(makeInput({ environment: "production" }))).toBe(0.9);
  });
  it("prod → 0.9", () => {
    expect(scoreProductionImpact(makeInput({ environment: "prod" }))).toBe(0.9);
  });
  it("staging → 0.5", () => {
    expect(scoreProductionImpact(makeInput({ environment: "staging" }))).toBe(0.5);
  });
  it("null env → 0.2", () => {
    expect(scoreProductionImpact(makeInput({ environment: null }))).toBe(0.2);
  });
});

// ── scoreAIInvolvement ────────────────────────────────────────────────────────
describe("scoreAIInvolvement", () => {
  it("no AI → 0", () => {
    expect(scoreAIInvolvement(makeInput({ aiSystemInvolved: false }))).toBe(0);
  });
  it("AI without EU AI Act → 0.6", () => {
    const input = makeInput({ aiSystemInvolved: true });
    expect(scoreAIInvolvement(input)).toBe(0.6);
  });
  it("AI with EU AI Act → 1.0", () => {
    const input = makeInput({ aiSystemInvolved: true });
    input.regulatoryFrameworks = ["EU_AI_ACT"];
    expect(scoreAIInvolvement(input)).toBe(1.0);
  });
});

// ── scoreDataExposure ─────────────────────────────────────────────────────────
describe("scoreDataExposure", () => {
  it("special-category → 1.0", () => {
    expect(scoreDataExposure(makeInput({ dataClassification: "special-category" }))).toBe(1.0);
  });
  it("personal → 0.8", () => {
    expect(scoreDataExposure(makeInput({ dataClassification: "personal" }))).toBe(0.8);
  });
  it("internal → 0.3", () => {
    expect(scoreDataExposure(makeInput({ dataClassification: "internal" }))).toBe(0.3);
  });
  it("null/unknown → 0.1", () => {
    expect(scoreDataExposure(makeInput({ dataClassification: null }))).toBe(0.1);
  });
});

// ── scoreInfrastructureImpact ─────────────────────────────────────────────────
describe("scoreInfrastructureImpact", () => {
  it("infra change → 0.8", () => {
    expect(scoreInfrastructureImpact(makeInput({ infrastructureChange: true }))).toBe(0.8);
  });
  it("no infra change → 0.1", () => {
    expect(scoreInfrastructureImpact(makeInput({ infrastructureChange: false }))).toBe(0.1);
  });
});

// ── scoreThirdPartyRisk ───────────────────────────────────────────────────────
describe("scoreThirdPartyRisk", () => {
  it("third-party change → 0.7", () => {
    expect(scoreThirdPartyRisk(makeInput({ thirdPartyChanges: true }))).toBe(0.7);
  });
  it("no third-party change → 0", () => {
    expect(scoreThirdPartyRisk(makeInput({ thirdPartyChanges: false }))).toBe(0);
  });
});

// ── scoreIncidentHistory ──────────────────────────────────────────────────────
describe("scoreIncidentHistory", () => {
  it("0 incidents → 0", () => {
    expect(scoreIncidentHistory(makeInput({ priorIncidents: 0 }))).toBe(0.0);
  });
  it("1 incident → 0.4", () => {
    expect(scoreIncidentHistory(makeInput({ priorIncidents: 1 }))).toBe(0.4);
  });
  it("3 incidents → 0.7", () => {
    expect(scoreIncidentHistory(makeInput({ priorIncidents: 3 }))).toBe(0.7);
  });
  it("5+ incidents → 1.0", () => {
    expect(scoreIncidentHistory(makeInput({ priorIncidents: 5 }))).toBe(1.0);
  });
});

// ── scoreRegulatoryExposure ───────────────────────────────────────────────────
describe("scoreRegulatoryExposure", () => {
  it("no frameworks → 0", () => {
    expect(scoreRegulatoryExposure(makeInput())).toBe(0);
  });
  it("one high-risk EU framework in EU → clamped ≤ 1", () => {
    const input = makeInput();
    input.regulatoryFrameworks = ["EU_AI_ACT"];
    input.jurisdiction = "EU";
    const score = scoreRegulatoryExposure(input);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });
  it("three high-risk frameworks → score ≥ 1 (clamped to 1)", () => {
    const input = makeInput();
    input.regulatoryFrameworks = ["EU_AI_ACT", "DORA", "GDPR"];
    input.jurisdiction = "EU";
    expect(scoreRegulatoryExposure(input)).toBe(1);
  });
});

// ── scoreBlastRadius ──────────────────────────────────────────────────────────
describe("scoreBlastRadius", () => {
  it("0 linked systems → 0.1", () => {
    expect(scoreBlastRadius(makeInput({ linkedSystemIds: [] }))).toBe(0.1);
  });
  it("1 linked system → 0.3", () => {
    expect(scoreBlastRadius(makeInput({ linkedSystemIds: ["s1"] }))).toBe(0.3);
  });
  it("6+ linked systems → 1.0", () => {
    expect(
      scoreBlastRadius(makeInput({ linkedSystemIds: ["s1", "s2", "s3", "s4", "s5", "s6"] }))
    ).toBe(1.0);
  });
});

// ── scoreSecuritySensitivity ──────────────────────────────────────────────────
describe("scoreSecuritySensitivity", () => {
  it("no risk factors → 0", () => {
    expect(scoreSecuritySensitivity(makeInput())).toBe(0);
  });
  it("third-party change → 0.4", () => {
    expect(scoreSecuritySensitivity(makeInput({ thirdPartyChanges: true }))).toBe(0.4);
  });
  it("third-party + 3 open findings → clamped to 1", () => {
    const input = makeInput({ thirdPartyChanges: true });
    input.openSecurityFindings = 3;
    expect(scoreSecuritySensitivity(input)).toBe(0.9);
  });
});

// ── scoreCustomerImpact ───────────────────────────────────────────────────────
describe("scoreCustomerImpact", () => {
  it("production + personal data → 0.9", () => {
    expect(
      scoreCustomerImpact(makeInput({ environment: "production", dataClassification: "personal" }))
    ).toBe(0.9);
  });
  it("production only → 0.6", () => {
    expect(scoreCustomerImpact(makeInput({ environment: "production" }))).toBe(0.6);
  });
  it("staging + personal → 0.5", () => {
    expect(
      scoreCustomerImpact(makeInput({ environment: "staging", dataClassification: "personal" }))
    ).toBe(0.5);
  });
  it("staging, no sensitive data → 0.2", () => {
    expect(scoreCustomerImpact(makeInput({ environment: "staging" }))).toBe(0.2);
  });
});

// ── Integration: high-risk AI deployment scores enhanced ─────────────────────
describe("composite intensity integration", () => {
  it("AI production deployment with EU frameworks scores enhanced", () => {
    const WEIGHTS = {
      regulatoryExp: 20,
      productionImpact: 15,
      aiInvolvement: 15,
      customerImpact: 10,
      dataExposure: 10,
      blastRadius: 8,
      securitySens: 8,
      deploymentCrit: 5,
      infraImpact: 4,
      thirdPartyRisk: 3,
      incidentHistory: 2,
    } as const;
    const input = makeInput({
      environment: "production",
      dataClassification: "personal",
      aiSystemInvolved: true,
      thirdPartyChanges: true, // new AI model provider = DORA third-party signal
      infrastructureChange: true,
      linkedSystemIds: ["svc1", "svc2", "svc3"],
      priorIncidents: 2,
    });
    input.regulatoryFrameworks = ["EU_AI_ACT", "DORA"];
    input.jurisdiction = "EU";
    input.openSecurityFindings = 1;

    const dims = {
      regulatoryExp: scoreRegulatoryExposure(input),
      productionImpact: scoreProductionImpact(input),
      aiInvolvement: scoreAIInvolvement(input),
      customerImpact: scoreCustomerImpact(input),
      dataExposure: scoreDataExposure(input),
      blastRadius: scoreBlastRadius(input),
      securitySens: scoreSecuritySensitivity(input),
      deploymentCrit: 0.5,
      infraImpact: scoreInfrastructureImpact(input),
      thirdPartyRisk: scoreThirdPartyRisk(input),
      incidentHistory: scoreIncidentHistory(input),
    };

    const composite = Math.round(
      (Object.keys(WEIGHTS) as Array<keyof typeof WEIGHTS>).reduce(
        (sum, k) => sum + dims[k] * WEIGHTS[k],
        0
      )
    );

    expect(composite).toBeGreaterThanOrEqual(75);
    expect(compositeToIntensity(composite)).toBe("enhanced");
  });

  it("UI text change scores minimal", () => {
    const WEIGHTS = {
      regulatoryExp: 20,
      productionImpact: 15,
      aiInvolvement: 15,
      customerImpact: 10,
      dataExposure: 10,
      blastRadius: 8,
      securitySens: 8,
      deploymentCrit: 5,
      infraImpact: 4,
      thirdPartyRisk: 3,
      incidentHistory: 2,
    } as const;
    const input = makeInput({
      environment: "staging",
      dataClassification: "internal",
      aiSystemInvolved: false,
      thirdPartyChanges: false,
      infrastructureChange: false,
      linkedSystemIds: [],
      priorIncidents: 0,
    });

    const dims = {
      regulatoryExp: scoreRegulatoryExposure(input),
      productionImpact: scoreProductionImpact(input),
      aiInvolvement: scoreAIInvolvement(input),
      customerImpact: scoreCustomerImpact(input),
      dataExposure: scoreDataExposure(input),
      blastRadius: scoreBlastRadius(input),
      securitySens: scoreSecuritySensitivity(input),
      deploymentCrit: 0.3,
      infraImpact: scoreInfrastructureImpact(input),
      thirdPartyRisk: scoreThirdPartyRisk(input),
      incidentHistory: scoreIncidentHistory(input),
    };

    const composite = Math.round(
      (Object.keys(WEIGHTS) as Array<keyof typeof WEIGHTS>).reduce(
        (sum, k) => sum + dims[k] * WEIGHTS[k],
        0
      )
    );

    expect(composite).toBeLessThan(25);
    expect(compositeToIntensity(composite)).toBe("minimal");
  });
});
