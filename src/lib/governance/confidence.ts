export interface ConfidenceInput {
  approvedGates: number;
  totalGates: number;
  compositeRiskScore: number;   // 0–100, higher = riskier
  scoringConfidence: number;    // 0–1, AI's own confidence in the score
  reducedFromBaseline: number;  // gates removed by adaptive engine
  openCriticalRisks: number;
  waiverCount: number;
}

export interface ConfidenceResult {
  score: number;
  verdict: "READY" | "CONDITIONAL" | "BLOCKED";
  label: string;
  cls: string;
  drivers: Array<{ label: string; value: string; positive: boolean }>;
}

export function computeDeliveryConfidence(input: ConfidenceInput): ConfidenceResult {
  const {
    approvedGates,
    totalGates,
    compositeRiskScore,
    scoringConfidence,
    reducedFromBaseline,
    openCriticalRisks,
    waiverCount,
  } = input;

  const gateCompletion = totalGates > 0 ? (approvedGates / totalGates) * 50 : 50;
  const riskInverse = ((100 - compositeRiskScore) / 100) * 30;
  const aiConfidence = scoringConfidence * 15;
  const efficiencyBonus = reducedFromBaseline > 0 ? 5 : 0;
  const criticalPenalty = Math.min(openCriticalRisks * 10, 30);
  const waiverPenalty = waiverCount > 0 ? 5 : 0;

  const raw = gateCompletion + riskInverse + aiConfidence + efficiencyBonus - criticalPenalty - waiverPenalty;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  let verdict: ConfidenceResult["verdict"];
  if (openCriticalRisks > 0 || score < 40) verdict = "BLOCKED";
  else if (score >= 72) verdict = "READY";
  else verdict = "CONDITIONAL";

  const verdictMeta: Record<ConfidenceResult["verdict"], { label: string; cls: string }> = {
    READY: { label: "DELIVERY READY", cls: "text-primary border-primary" },
    CONDITIONAL: { label: "CONDITIONAL", cls: "text-tertiary border-tertiary" },
    BLOCKED: { label: "BLOCKED", cls: "text-critical border-critical" },
  };

  const drivers: ConfidenceResult["drivers"] = [
    {
      label: "Gate Completion",
      value: `${approvedGates}/${totalGates}`,
      positive: totalGates > 0 && approvedGates / totalGates >= 0.7,
    },
    {
      label: "Risk Score",
      value: `${Math.round(compositeRiskScore)}/100`,
      positive: compositeRiskScore < 50,
    },
    {
      label: "AI Confidence",
      value: `${Math.round(scoringConfidence * 100)}%`,
      positive: scoringConfidence >= 0.7,
    },
  ];
  if (reducedFromBaseline > 0)
    drivers.push({
      label: "Gates Saved",
      value: `−${reducedFromBaseline}`,
      positive: true,
    });
  if (openCriticalRisks > 0)
    drivers.push({
      label: "Critical Risks",
      value: String(openCriticalRisks),
      positive: false,
    });

  return { score, verdict, ...verdictMeta[verdict], drivers };
}

/** Compute confidence from aggregated case data across a project */
export function computeProjectConfidence(cases: Array<{
  approvedGates: number;
  totalGates: number;
  compositeScore: number;
  scoringConfidence: number;
  reducedFromBaseline: number;
  criticalRisks: number;
  waiverCount: number;
}>): ConfidenceResult {
  if (cases.length === 0) {
    return computeDeliveryConfidence({
      approvedGates: 0, totalGates: 0, compositeRiskScore: 0,
      scoringConfidence: 1, reducedFromBaseline: 0, openCriticalRisks: 0, waiverCount: 0,
    });
  }
  const totals = cases.reduce(
    (acc, c) => ({
      approvedGates: acc.approvedGates + c.approvedGates,
      totalGates: acc.totalGates + c.totalGates,
      compositeRiskScore: acc.compositeRiskScore + c.compositeScore,
      scoringConfidence: acc.scoringConfidence + c.scoringConfidence,
      reducedFromBaseline: acc.reducedFromBaseline + c.reducedFromBaseline,
      openCriticalRisks: acc.openCriticalRisks + c.criticalRisks,
      waiverCount: acc.waiverCount + c.waiverCount,
    }),
    { approvedGates: 0, totalGates: 0, compositeRiskScore: 0, scoringConfidence: 0, reducedFromBaseline: 0, openCriticalRisks: 0, waiverCount: 0 }
  );
  return computeDeliveryConfidence({
    ...totals,
    compositeRiskScore: totals.compositeRiskScore / cases.length,
    scoringConfidence: totals.scoringConfidence / cases.length,
  });
}
