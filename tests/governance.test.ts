import { describe, it, expect } from "vitest";
import { computeHealthScore } from "@/lib/governance";

describe("computeHealthScore", () => {
  it("all approved, no risks, full evidence → 100", () => {
    expect(computeHealthScore(10, 10, 0, 0, 10, 10)).toBe(100);
  });

  it("no gates, no risks, no evidence → 100 (all components default to max)", () => {
    expect(computeHealthScore(0, 0, 0, 0, 0, 0)).toBe(100);
  });

  it("0/10 gates approved → gate component 0 (60% weight)", () => {
    const score = computeHealthScore(0, 10, 0, 0, 10, 10);
    // gate=0, risk=25, evidence=15 → 40
    expect(score).toBe(40);
  });

  it("5/10 gates approved → gate component 30", () => {
    const score = computeHealthScore(5, 10, 0, 0, 10, 10);
    // gate=30, risk=25, evidence=15 → 70
    expect(score).toBe(70);
  });

  it("critical risk presence reduces score", () => {
    const noRisk   = computeHealthScore(10, 10, 0, 5, 10, 10);
    const withRisk = computeHealthScore(10, 10, 3, 5, 10, 10);
    expect(withRisk).toBeLessThan(noRisk);
  });

  it("partial evidence reduces score", () => {
    const full    = computeHealthScore(10, 10, 0, 0, 10, 10);
    const partial = computeHealthScore(10, 10, 0, 0, 5, 10);
    expect(partial).toBeLessThan(full);
  });

  it("score is always 0–100", () => {
    // Edge: more critical than total (shouldn't happen but must not explode)
    const score = computeHealthScore(0, 20, 10, 10, 0, 20);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
