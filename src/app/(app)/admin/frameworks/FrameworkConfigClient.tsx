"use client";

import { useState } from "react";
import type { FrameworkInfo } from "./page";

const REGIONS = ["EU", "UK", "US", "APAC", "Global"] as const;
const INDUSTRIES = [
  "Banking & Financial Services",
  "Insurance",
  "Fintech / Payments",
  "Healthcare",
  "SaaS / Technology",
  "Government / Public Sector",
  "Retail / E-commerce",
  "Critical Infrastructure",
  "Manufacturing",
] as const;

function Icon({
  name,
  size = 18,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`material-symbols-outlined select-none leading-none ${className}`}
      style={{ fontSize: size }}
    >
      {name}
    </span>
  );
}

interface FrameworkWithActive extends FrameworkInfo {
  active: boolean;
}

interface ConnectorInfo {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
}

interface TriggerRuleInfo {
  id: string;
  source: string;
  name: string;
}

interface Props {
  projectId: string;
  projectName: string;
  frameworks: FrameworkWithActive[];
  connectors: ConnectorInfo[];
  triggerRules: TriggerRuleInfo[];
}

type AIAdvisorResult = {
  recommended: string[];
  reasoning: string;
  agileNotes: string;
};

export default function FrameworkConfigClient({
  projectId,
  projectName,
  frameworks,
  connectors,
  triggerRules,
}: Props) {
  const [selectedRegions, setSelectedRegions] = useState<string[]>(["EU"]);
  const [selectedIndustry, setSelectedIndustry] = useState<string>("Banking & Financial Services");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [advisorResult, setAdvisorResult] = useState<AIAdvisorResult | null>(null);
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorError, setAdvisorError] = useState<string | null>(null);

  function toggleRegion(r: string) {
    setSelectedRegions((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }

  async function runAdvisor() {
    setAdvisorLoading(true);
    setAdvisorError(null);
    setAdvisorResult(null);

    try {
      const res = await fetch("/api/ai/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "framework-advisor",
          projectId,
          messages: [
            {
              role: "system",
              content:
                "You are a governance compliance advisor for regulated enterprises. " +
                "Given an industry and operating regions, identify which regulatory frameworks are mandatory, " +
                "recommended, or optional. Consider both formal regulations and agile governance best practices. " +
                "Respond as JSON with keys: recommended (array of framework IDs from: DORA, EU_AI_ACT, SOC2, ISO_27001, PCI_DSS, GDPR), " +
                "reasoning (string, 2-3 sentences), agileNotes (string, what agile governance controls matter most). " +
                "Return ONLY valid JSON, no markdown.",
            },
            {
              role: "user",
              content: `Industry: ${selectedIndustry}. Operating regions: ${selectedRegions.join(", ")}. Project: ${projectName}. Which compliance frameworks should we activate and why? Include agile governance recommendations.`,
            },
          ],
          maxTokens: 512,
        }),
      });

      if (!res.ok || !res.body) {
        setAdvisorError("AI advisor unavailable. Check governance mode and API keys.");
        return;
      }

      // Read streaming response and accumulate text
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const parsed = JSON.parse(line.slice(6)) as {
              chunk?: string;
              done?: boolean;
              error?: string;
            };
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.chunk) fullText += parsed.chunk;
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }

      // Parse JSON — handle wrapped markdown code blocks
      const jsonStr = fullText
        .replace(/^```json?\n?/i, "")
        .replace(/\n?```$/i, "")
        .trim();
      const parsed = JSON.parse(jsonStr) as AIAdvisorResult;
      setAdvisorResult(parsed);
    } catch {
      setAdvisorError("Failed to get AI response. Please try again.");
    } finally {
      setAdvisorLoading(false);
    }
  }

  const recommendedIds = advisorResult?.recommended ?? [];

  return (
    <div className="p-xl">
      <div className="max-w-[1200px] mx-auto space-y-lg">
        {/* ── AI Compliance Advisor ── */}
        <div className="bg-surface border border-primary/30">
          <div className="px-xl py-lg border-b border-primary/20 flex items-center gap-md">
            <div className="w-8 h-8 bg-primary/10 border border-primary flex items-center justify-center">
              <Icon name="psychology" size={16} className="text-primary" />
            </div>
            <div>
              <p className="font-label-caps text-label-caps text-primary tracking-widest">
                AI COMPLIANCE ADVISOR
              </p>
              <p className="font-mono-technical text-[10px] text-on-surface-variant">
                Tell us your industry and regions — AI recommends which frameworks apply
              </p>
            </div>
          </div>

          <div className="p-xl grid grid-cols-12 gap-lg">
            {/* Industry */}
            <div className="col-span-12 lg:col-span-5">
              <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest mb-md">
                INDUSTRY SECTOR
              </p>
              <div className="grid grid-cols-1 gap-sm">
                {INDUSTRIES.map((ind) => (
                  <button
                    key={ind}
                    onClick={() => setSelectedIndustry(ind)}
                    className={`text-left px-md py-sm border font-body-base text-body-base text-[12px] transition-colors ${
                      selectedIndustry === ind
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border-muted text-on-surface-variant hover:border-primary hover:text-on-surface"
                    }`}
                  >
                    {ind}
                  </button>
                ))}
              </div>
            </div>

            {/* Region + Advisor */}
            <div className="col-span-12 lg:col-span-7 space-y-lg">
              <div>
                <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest mb-md">
                  OPERATING REGIONS
                </p>
                <div className="flex flex-wrap gap-sm">
                  {REGIONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => toggleRegion(r)}
                      className={`px-lg py-sm border font-mono-technical text-[11px] transition-colors ${
                        selectedRegions.includes(r)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border-muted text-on-surface-variant hover:border-primary"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => void runAdvisor()}
                disabled={advisorLoading || selectedRegions.length === 0}
                className="flex items-center gap-sm px-xl py-md bg-primary text-background font-mono-technical text-[11px] hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {advisorLoading ? (
                  <>
                    <span className="w-3 h-3 border border-background/40 border-t-background rounded-full animate-spin" />
                    ANALYSING COMPLIANCE POSTURE
                  </>
                ) : (
                  <>
                    <Icon name="auto_awesome" size={14} className="text-background" />
                    GET AI FRAMEWORK RECOMMENDATIONS
                  </>
                )}
              </button>

              {advisorError && (
                <div className="border border-critical/30 bg-critical/5 p-md">
                  <p className="font-mono-technical text-[11px] text-critical">{advisorError}</p>
                </div>
              )}

              {advisorResult && (
                <div className="border border-primary/20 bg-primary/5 p-lg space-y-md">
                  <p className="font-mono-technical text-[10px] text-primary tracking-widest">
                    AI RECOMMENDATION
                  </p>
                  <p className="font-body-base text-body-base text-on-surface text-[12px] leading-relaxed">
                    {advisorResult.reasoning}
                  </p>
                  <div>
                    <p className="font-mono-technical text-[10px] text-on-surface-variant mb-sm">
                      RECOMMENDED FRAMEWORKS
                    </p>
                    <div className="flex flex-wrap gap-sm">
                      {advisorResult.recommended.map((fw) => (
                        <span
                          key={fw}
                          className="px-2 py-0.5 bg-primary/10 text-primary border border-primary font-mono-technical text-[10px]"
                        >
                          {fw.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  </div>
                  {advisorResult.agileNotes && (
                    <div className="pt-md border-t border-primary/20">
                      <p className="font-mono-technical text-[10px] text-on-surface-variant mb-sm">
                        AGILE GOVERNANCE NOTES
                      </p>
                      <p className="font-body-base text-body-base text-on-surface-variant text-[12px] leading-relaxed">
                        {advisorResult.agileNotes}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Framework Library ── */}
        <div className="space-y-sm">
          <div className="flex items-center justify-between">
            <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
              FRAMEWORK LIBRARY
            </p>
            <p className="font-mono-technical text-[10px] text-on-surface-variant">
              {frameworks.filter((f) => f.active).length} active · {frameworks.length} available
            </p>
          </div>

          {frameworks.map((fw) => {
            const isRecommended = recommendedIds.includes(fw.id);
            const isExpanded = expandedId === fw.id;

            return (
              <div
                key={fw.id}
                className={`bg-surface border transition-colors ${
                  fw.active
                    ? "border-primary/40"
                    : isRecommended
                      ? "border-tertiary/40"
                      : "border-border-muted"
                }`}
              >
                <div
                  className="px-xl py-lg flex items-center gap-lg cursor-pointer hover:bg-surface-container-low transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : fw.id)}
                >
                  {/* Status dot */}
                  <div
                    className={`w-3 h-3 rounded-full shrink-0 ${fw.active ? "bg-primary" : isRecommended ? "bg-tertiary animate-pulse" : "bg-surface-container-highest border border-border-muted"}`}
                  />

                  {/* Labels */}
                  <div className="flex items-center gap-md flex-1 min-w-0">
                    <span className="font-body-bold text-body-bold text-on-surface">
                      {fw.label}
                    </span>
                    <span className="font-mono-technical text-[10px] text-on-surface-variant hidden md:block truncate">
                      {fw.full}
                    </span>
                    <span className="font-mono-technical text-[10px] px-2 py-0.5 border border-border-muted text-on-surface-variant shrink-0">
                      {fw.region}
                    </span>
                    {isRecommended && !fw.active && (
                      <span className="px-2 py-0.5 bg-tertiary/10 text-tertiary border border-tertiary font-mono-technical text-[10px] shrink-0 animate-pulse">
                        AI RECOMMENDED
                      </span>
                    )}
                    {fw.active && (
                      <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary font-mono-technical text-[10px] shrink-0">
                        ACTIVE · {fw.controlCount} CONTROLS
                      </span>
                    )}
                  </div>

                  <Icon
                    name={isExpanded ? "expand_less" : "expand_more"}
                    size={18}
                    className="text-on-surface-variant shrink-0"
                  />
                </div>

                {isExpanded && (
                  <div className="px-xl pb-xl border-t border-border-muted pt-lg grid grid-cols-12 gap-lg">
                    <div className="col-span-12 lg:col-span-7 space-y-md">
                      <p className="font-body-base text-body-base text-on-surface-variant text-[12px] leading-relaxed">
                        {fw.description}
                      </p>

                      <div>
                        <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest mb-sm">
                          MANDATORY FOR
                        </p>
                        <div className="flex flex-wrap gap-sm">
                          {fw.mandatoryFor.map((m) => (
                            <span
                              key={m}
                              className="px-2 py-0.5 bg-surface-container-high border border-border-muted font-mono-technical text-[10px] text-on-surface-variant"
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest mb-sm">
                          SECTORS
                        </p>
                        <p className="font-body-base text-body-base text-on-surface-variant text-[11px]">
                          {fw.sectors.join(" · ")}
                        </p>
                      </div>
                    </div>

                    <div className="col-span-12 lg:col-span-5 space-y-md">
                      <div>
                        <p className="font-mono-technical text-[10px] text-primary tracking-widest mb-sm">
                          AGILE GOVERNANCE CONTROLS
                        </p>
                        <div className="space-y-sm">
                          {fw.agileControls.map((ctrl) => (
                            <div key={ctrl} className="flex items-center gap-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                              <span className="font-mono-technical text-[10px] text-on-surface-variant">
                                {ctrl}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-md border-t border-border-muted space-y-sm">
                        <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">
                          CONNECTED TOOLS
                        </p>
                        {connectors.length === 0 ? (
                          <p className="font-mono-technical text-[10px] text-on-surface-variant/50">
                            No connectors registered
                          </p>
                        ) : (
                          connectors.map((c) => (
                            <div key={c.id} className="flex items-center gap-sm">
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${c.enabled ? "bg-primary" : "bg-on-surface-variant"}`}
                              />
                              <span className="font-mono-technical text-[10px] text-on-surface-variant">
                                {c.name} ({c.type.toUpperCase()})
                              </span>
                            </div>
                          ))
                        )}
                      </div>

                      {triggerRules.length > 0 && (
                        <div className="pt-md border-t border-border-muted">
                          <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest mb-sm">
                            TRIGGER RULES
                          </p>
                          {triggerRules.map((r) => (
                            <div key={r.id} className="flex items-center gap-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
                              <span className="font-mono-technical text-[10px] text-on-surface-variant">
                                {r.name} ({r.source})
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
