"use client";

import { useState } from "react";

interface GateDef {
  slug: string;
  name: string;
  category: string;
  intensityTriggers: string[];
}

interface ForecastResult {
  epicKey: string;
  epicTitle: string;
  compositeScore: number;
  intensity: string;
  aiModeRecommended: string;
  gatesRequired: Array<{ slug: string; name?: string; order: number; reason: string }>;
  gatesSkipped: Array<{ slug: string; skipReason: string }>;
  totalGates: number;
  reducedFromBaseline: number;
}

const INTENSITY_CLS: Record<string, string> = {
  enhanced:  "text-critical border-critical bg-critical/10",
  regulated: "text-tertiary border-tertiary bg-tertiary/10",
  standard:  "text-primary border-primary bg-primary/10",
  minimal:   "text-on-surface-variant border-border-muted",
};

const INTENSITY_SCORE_COLOR: Record<string, string> = {
  enhanced:  "text-critical",
  regulated: "text-tertiary",
  standard:  "text-primary",
  minimal:   "text-on-surface-variant",
};

function Icon({ name, size = 16, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <span className={`material-symbols-outlined select-none leading-none ${className}`} style={{ fontSize: size }}>
      {name}
    </span>
  );
}

const EXAMPLES = [
  { title: "AI model deployment to production — credit scoring system", key: "PREVIEW-AI-01", ai: true, infra: false, tp: false, env: "production", data: "financial" },
  { title: "Infrastructure change — AWS VPC expansion", key: "PREVIEW-INFRA-01", ai: false, infra: true, tp: true, env: "production", data: "confidential" },
  { title: "Sprint feature release — low-risk UI change", key: "PREVIEW-UI-01", ai: false, infra: false, tp: false, env: "staging", data: "public" },
  { title: "Third-party API integration — KYC provider", key: "PREVIEW-TP-01", ai: false, infra: false, tp: true, env: "production", data: "personal" },
];

export default function ForecastClient({
  projectId,
  projectName,
  gateDefinitions,
}: {
  projectId: string;
  projectName: string;
  gateDefinitions: GateDef[];
}) {
  const [epicTitle, setEpicTitle] = useState("");
  const [epicKey, setEpicKey] = useState("PREVIEW-001");
  const [aiSystem, setAiSystem] = useState(false);
  const [thirdParty, setThirdParty] = useState(false);
  const [infraChange, setInfraChange] = useState(false);
  const [environment, setEnvironment] = useState("production");
  const [dataClass, setDataClass] = useState("confidential");
  const [labels, setLabels] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<ForecastResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  function loadExample(ex: typeof EXAMPLES[0]) {
    setEpicTitle(ex.title);
    setEpicKey(ex.key);
    setAiSystem(ex.ai);
    setInfraChange(ex.infra);
    setThirdParty(ex.tp);
    setEnvironment(ex.env);
    setDataClass(ex.data);
  }

  async function forecast() {
    if (!epicTitle.trim() || !projectId || state === "loading") return;
    setState("loading");
    setErrorMsg("");
    setResult(null);

    try {
      const res = await fetch("/api/governance/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          epicKey: epicKey.trim() || "PREVIEW-001",
          epicTitle: epicTitle.trim(),
          aiSystemInvolved: aiSystem,
          thirdPartyChanges: thirdParty,
          infrastructureChange: infraChange,
          environment,
          dataClassification: dataClass,
          labels: labels ? labels.split(",").map((l) => l.trim()).filter(Boolean) : [],
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setErrorMsg(typeof err.error === "string" ? err.error : `Request failed (${res.status})`);
        setState("error");
        return;
      }

      const data = await res.json() as ForecastResult;
      setResult(data);
      setState("done");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Network error");
      setState("error");
    }
  }

  return (
    <>
      <header className="h-16 px-xl flex items-center justify-between border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <div className="flex items-center gap-xl">
          <h1 className="font-headline-md text-headline-md text-on-surface">Governance Forecast</h1>
          <span className="font-body-base text-body-base text-on-surface-variant">{projectName} · Preview only — no DB writes</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-xl">
        <div className="max-w-[1000px] mx-auto space-y-xl">

          {/* Explainer */}
          <div className="bg-surface border border-border-muted p-lg grid grid-cols-4 gap-md">
            {[
              { icon: "edit_note",     label: "Describe Change",    desc: "Enter title, type, and characteristics" },
              { icon: "analytics",     label: "Score & Classify",   desc: "11-dimension risk scoring engine runs" },
              { icon: "account_tree",  label: "Pipeline Preview",   desc: "See which gates would be required" },
              { icon: "rocket_launch", label: "Plan Your Sprint",   desc: "Know governance load before you commit" },
            ].map((s) => (
              <div key={s.label} className="text-center space-y-sm">
                <div className="w-8 h-8 bg-primary/10 border border-primary mx-auto flex items-center justify-center">
                  <Icon name={s.icon} size={16} className="text-primary" />
                </div>
                <p className="font-body-bold text-body-bold text-on-surface text-[11px]">{s.label}</p>
                <p className="font-mono-technical text-[10px] text-on-surface-variant">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-12 gap-xl">
            {/* Input form */}
            <div className="col-span-12 lg:col-span-5 space-y-lg">
              <div className="bg-surface border border-border-muted">
                <div className="px-xl py-lg border-b border-border-muted">
                  <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">CHANGE DESCRIPTOR</p>
                </div>
                <div className="p-xl space-y-lg">
                  <div>
                    <label className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest block mb-xs">CHANGE TITLE *</label>
                    <input
                      value={epicTitle}
                      onChange={(e) => setEpicTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && void forecast()}
                      placeholder="e.g. Deploy AI credit scoring model to production"
                      className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-body-base text-body-base text-on-surface outline-none focus:border-primary transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-md">
                    <div>
                      <label className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest block mb-xs">ENVIRONMENT</label>
                      <select
                        value={environment}
                        onChange={(e) => setEnvironment(e.target.value)}
                        className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[11px] text-on-surface outline-none focus:border-primary"
                      >
                        {["production", "staging", "development", "sandbox"].map((e) => (
                          <option key={e} value={e}>{e}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest block mb-xs">DATA CLASS</label>
                      <select
                        value={dataClass}
                        onChange={(e) => setDataClass(e.target.value)}
                        className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[11px] text-on-surface outline-none focus:border-primary"
                      >
                        {["public", "personal", "financial", "confidential", "restricted"].map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-sm">
                    <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">CHARACTERISTICS</p>
                    {[
                      { label: "AI System Involved", value: aiSystem, set: setAiSystem, icon: "psychology" },
                      { label: "Third-Party Changes", value: thirdParty, set: setThirdParty, icon: "hub" },
                      { label: "Infrastructure Change", value: infraChange, set: setInfraChange, icon: "storage" },
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        onClick={() => opt.set(!opt.value)}
                        className={`w-full flex items-center gap-md px-md py-sm border transition-colors text-left ${
                          opt.value ? "border-primary bg-primary/10" : "border-border-muted hover:border-primary/40"
                        }`}
                      >
                        <Icon name={opt.icon} size={14} className={opt.value ? "text-primary" : "text-on-surface-variant"} />
                        <span className={`font-mono-technical text-[11px] ${opt.value ? "text-primary" : "text-on-surface-variant"}`}>
                          {opt.label}
                        </span>
                        <span className={`ml-auto font-mono-technical text-[10px] ${opt.value ? "text-primary" : "text-on-surface-variant"}`}>
                          {opt.value ? "YES" : "NO"}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest block mb-xs">
                      LABELS (COMMA-SEPARATED)
                    </label>
                    <input
                      value={labels}
                      onChange={(e) => setLabels(e.target.value)}
                      placeholder="e.g. governance-required, eu-ai-act, high-risk"
                      className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[11px] text-on-surface outline-none focus:border-primary transition-colors"
                    />
                  </div>

                  {errorMsg && <p className="font-mono-technical text-[10px] text-critical">{errorMsg}</p>}

                  <button
                    onClick={() => void forecast()}
                    disabled={!epicTitle.trim() || !projectId || state === "loading"}
                    className="w-full flex items-center justify-center gap-sm py-md bg-primary text-background font-mono-technical text-[11px] hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {state === "loading" ? (
                      <><span className="w-3 h-3 border border-background/40 border-t-background rounded-full animate-spin" /> SCORING…</>
                    ) : (
                      <><Icon name="analytics" size={14} className="text-background" /> RUN GOVERNANCE FORECAST</>
                    )}
                  </button>
                </div>
              </div>

              {/* Examples */}
              <div className="bg-surface border border-border-muted">
                <div className="px-xl py-md border-b border-border-muted">
                  <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">QUICK EXAMPLES</p>
                </div>
                <div className="divide-y divide-border-muted">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex.key}
                      onClick={() => loadExample(ex)}
                      className="w-full text-left px-xl py-md hover:bg-surface-container-low transition-colors group"
                    >
                      <p className="font-mono-technical text-[11px] text-on-surface group-hover:text-primary leading-snug">
                        {ex.title}
                      </p>
                      <p className="font-mono-technical text-[9px] text-on-surface-variant mt-xs">
                        {ex.env} · {ex.data} {ex.ai ? "· AI system" : ""} {ex.tp ? "· third-party" : ""}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Result */}
            <div className="col-span-12 lg:col-span-7">
              {state === "idle" && !result && (
                <div className="bg-surface border border-border-muted h-full flex flex-col items-center justify-center p-xl text-center gap-md">
                  <div className="w-12 h-12 bg-primary/10 border border-primary flex items-center justify-center">
                    <Icon name="analytics" size={24} className="text-primary" />
                  </div>
                  <p className="font-body-bold text-body-bold text-on-surface">Governance forecast awaiting input</p>
                  <p className="font-mono-technical text-[11px] text-on-surface-variant max-w-[300px]">
                    Describe your change on the left. The platform will preview the exact risk score and gate pipeline — no database writes.
                  </p>
                </div>
              )}

              {result && (
                <div className="space-y-lg">
                  {/* Score card */}
                  <div className="bg-surface border border-border-muted">
                    <div className="px-xl py-lg border-b border-border-muted flex items-center justify-between">
                      <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">FORECAST RESULT</p>
                      <span className="font-mono-technical text-[9px] text-on-surface-variant">PREVIEW — NOT PERSISTED</span>
                    </div>
                    <div className="p-xl">
                      <div className="flex items-start gap-xl mb-xl">
                        <div className="text-center shrink-0">
                          <p className={`font-bold leading-none ${INTENSITY_SCORE_COLOR[result.intensity] ?? "text-on-surface"}`}
                            style={{ fontSize: 52 }}>
                            {Math.round(result.compositeScore)}
                          </p>
                          <p className="font-mono-technical text-[9px] text-on-surface-variant">RISK SCORE</p>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-sm flex-wrap mb-md">
                            <span className={`px-3 py-1 font-mono-technical text-[11px] border font-bold ${INTENSITY_CLS[result.intensity] ?? ""}`}>
                              {result.intensity?.toUpperCase()} INTENSITY
                            </span>
                            <span className="font-mono-technical text-[10px] border border-border-muted text-on-surface-variant px-2 py-0.5">
                              AI MODE: {result.aiModeRecommended?.replace(/_/g, " ")}
                            </span>
                          </div>
                          <p className="font-body-bold text-body-bold text-on-surface text-[13px]">{result.epicTitle}</p>
                          <p className="font-mono-technical text-[10px] text-on-surface-variant mt-xs">{result.epicKey}</p>
                        </div>
                      </div>

                      {/* Pipeline preview */}
                      <div className="space-y-md">
                        <div className="flex items-center justify-between">
                          <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">GATE PIPELINE</p>
                          <div className="flex items-center gap-md">
                            <span className="font-mono-technical text-[10px] text-primary">{result.totalGates} GATES</span>
                            {result.reducedFromBaseline > 0 && (
                              <span className="font-mono-technical text-[10px] text-tertiary">
                                ↓ {result.reducedFromBaseline} SKIPPED BY POLICY
                              </span>
                            )}
                          </div>
                        </div>

                        {result.gatesRequired.length > 0 ? (
                          <div className="space-y-xs">
                            {result.gatesRequired.map((g, i) => {
                              const def = gateDefinitions.find((d) => d.slug === g.slug);
                              return (
                                <div key={i} className="flex items-start gap-md bg-primary/5 border border-primary/20 px-md py-sm">
                                  <span className="font-mono-technical text-[10px] text-primary w-4 shrink-0 mt-0.5">{i + 1}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-mono-technical text-[11px] text-on-surface">{def?.name ?? g.slug}</p>
                                    <p className="font-mono-technical text-[9px] text-on-surface-variant mt-0.5 truncate">{g.reason}</p>
                                  </div>
                                  {def?.category && (
                                    <span className="font-mono-technical text-[9px] text-on-surface-variant border border-border-muted px-1.5 py-0.5 shrink-0">
                                      {def.category}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="bg-primary/5 border border-primary/20 px-md py-lg text-center">
                            <Icon name="check_circle" size={20} className="text-primary mb-sm" />
                            <p className="font-mono-technical text-[11px] text-primary">MINIMAL — No gates required</p>
                            <p className="font-mono-technical text-[10px] text-on-surface-variant mt-xs">
                              Risk score below threshold. Standard quality checks apply.
                            </p>
                          </div>
                        )}

                        {result.gatesSkipped.length > 0 && (
                          <div className="space-y-xs mt-md">
                            <p className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest">GATES SKIPPED BY ADAPTIVE POLICY</p>
                            {result.gatesSkipped.map((g, i) => {
                              const def = gateDefinitions.find((d) => d.slug === g.slug);
                              return (
                                <div key={i} className="flex items-center gap-md border border-border-muted px-md py-xs opacity-60">
                                  <Icon name="skip_next" size={11} className="text-on-surface-variant shrink-0" />
                                  <span className="font-mono-technical text-[10px] text-on-surface-variant line-through flex-1">
                                    {def?.name ?? g.slug}
                                  </span>
                                  <span className="font-mono-technical text-[9px] text-on-surface-variant">{g.skipReason}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action */}
                  <div className="bg-surface border border-border-muted px-xl py-lg flex items-center justify-between">
                    <div>
                      <p className="font-mono-technical text-[10px] text-on-surface-variant">
                        This is a preview. To activate governance, configure a trigger rule that matches this change type.
                      </p>
                    </div>
                    <a
                      href="/admin/trigger-rules"
                      className="flex items-center gap-sm font-mono-technical text-[10px] text-primary hover:underline whitespace-nowrap"
                    >
                      <Icon name="rule" size={12} className="text-primary" />
                      CONFIGURE RULES →
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <footer className="h-8 bg-surface-container-low border-t border-border-muted flex items-center px-xl font-mono-technical text-[10px] text-on-surface-variant shrink-0">
        <span>GOVERNANCE FORECAST · PREVIEW MODE · NO DATABASE WRITES · 11-DIMENSION SCORING ENGINE</span>
      </footer>
    </>
  );
}
