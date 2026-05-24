"use client";

import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense } from "react";

const DEMO_ACCOUNTS = [
  {
    email: "bakkaiahsf@gmail.com",
    role: "ADMIN",
    label: "Governance Lead",
    desc: "Full access — approve, lock, configure",
  },
  {
    email: "approver@nexori.ai",
    role: "APPROVER",
    label: "Senior Approver",
    desc: "Approve/reject gates and approval requests",
  },
  {
    email: "viewer@nexori.ai",
    role: "VIEWER",
    label: "Board Observer",
    desc: "Read-only — view all governance data",
  },
];

const VALUE_PROPS = [
  {
    icon: "verified_user",
    title: "Immutable Audit Trail",
    desc: "Every governance decision, AI action, and approval recorded as an immutable flight recorder event. Zero gaps.",
  },
  {
    icon: "security",
    title: "AI Control Center",
    desc: "Five-mode AI governance — from full human-only to AI-controlled — with one-click emergency shutdown.",
  },
  {
    icon: "policy",
    title: "Regulatory Ready",
    desc: "DORA, EU AI Act, SOC2, ISO 27001 compliance built into the platform core, not bolted on.",
  },
  {
    icon: "verified",
    title: "Gate-Based Delivery",
    desc: "Mandatory governance checkpoints before every release. No bypass without a documented exception.",
  },
];

function SignInForm() {
  const params = useSearchParams();
  const router = useRouter();
  const callbackUrl = params.get("callbackUrl") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    setErrorMsg("");
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });
    if (result?.ok) {
      router.push(callbackUrl);
      router.refresh();
    } else {
      setState("error");
      setErrorMsg("Invalid email or access code.");
    }
  }

  async function quickLogin(demoEmail: string) {
    setState("loading");
    const result = await signIn("credentials", {
      email: demoEmail,
      password: "nexori2025",
      redirect: false,
      callbackUrl,
    });
    if (result?.ok) {
      router.push(callbackUrl);
      router.refresh();
    } else {
      setState("error");
    }
  }

  return (
    <div className="min-h-screen bg-[#080f18] flex overflow-hidden">
      {/* ── Left: Marketing Panel ── */}
      <div className="hidden lg:flex flex-col justify-between w-[58%] bg-[#0a1220] border-r border-[#1e2d42] p-[60px] relative overflow-hidden">
        {/* Background grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(#50dbcb 1px, transparent 1px), linear-gradient(90deg, #50dbcb 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Top: Wordmark */}
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-12">
            <div className="w-10 h-10 bg-[#50dbcb] flex items-center justify-center shrink-0">
              <span
                className="material-symbols-outlined text-[#080f18]"
                style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}
              >
                policy
              </span>
            </div>
            <div>
              <p className="font-mono-technical text-[11px] text-[#50dbcb] tracking-[0.2em] uppercase leading-none">
                Enterprise Governance
              </p>
              <p className="font-mono-technical text-[9px] text-[#4a6080] mt-0.5">
                Operational Control Platform
              </p>
            </div>
          </div>

          {/* Hero statement */}
          <div className="mb-14">
            <h1
              className="text-white leading-tight mb-4"
              style={{ fontSize: 42, fontWeight: 700, letterSpacing: "-0.02em" }}
            >
              Governance that moves
              <br />
              <span style={{ color: "#50dbcb" }}>as fast as you do.</span>
            </h1>
            <p className="text-[#4a6080] text-[15px] leading-relaxed max-w-[440px]">
              NexoriOS gives regulated organisations one control room for approvals, evidence,
              delivery risk, and AI oversight. Built for DORA, EU AI Act, and the pace of modern
              enterprise.
            </p>
          </div>

          {/* Value props */}
          <div className="grid grid-cols-2 gap-4 mb-14">
            {VALUE_PROPS.map((vp) => (
              <div
                key={vp.title}
                className="border border-[#1e2d42] bg-[#080f18]/60 p-5 hover:border-[#50dbcb]/30 transition-colors"
              >
                <span
                  className="material-symbols-outlined text-[#50dbcb] mb-3 block"
                  style={{ fontSize: 18, fontVariationSettings: "'FILL' 0" }}
                >
                  {vp.icon}
                </span>
                <p className="text-white text-[12px] font-semibold mb-1">{vp.title}</p>
                <p className="text-[#4a6080] text-[11px] leading-relaxed">{vp.desc}</p>
              </div>
            ))}
          </div>

          {/* Regulatory stat bar */}
          <div className="flex items-center gap-6 border-t border-[#1e2d42] pt-6">
            {["DORA Art. 25–30", "EU AI Act Art. 11", "SOC2 Type II", "ISO 27001"].map((reg) => (
              <div key={reg} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#50dbcb]" />
                <span className="font-mono-technical text-[10px] text-[#4a6080]">{reg}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom stats */}
        <div className="relative z-10 grid grid-cols-3 gap-6 pt-8 border-t border-[#1e2d42]">
          {[
            { value: "100%", label: "AI Actions Logged" },
            { value: "0", label: "Governance Gaps" },
            { value: "5-Mode", label: "AI Control Spectrum" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-[#50dbcb] text-2xl font-bold leading-none mb-1">{s.value}</p>
              <p className="font-mono-technical text-[10px] text-[#4a6080]">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: Auth Panel ── */}
      <div className="flex-1 flex flex-col justify-center px-8 lg:px-16 py-12">
        {/* Mobile wordmark */}
        <div className="flex items-center gap-3 mb-10 lg:hidden">
          <div className="w-8 h-8 bg-[#50dbcb] flex items-center justify-center">
            <span
              className="material-symbols-outlined text-[#080f18]"
              style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}
            >
              policy
            </span>
          </div>
          <p className="font-mono-technical text-[11px] text-[#50dbcb] tracking-widest uppercase">
            NexoriOS
          </p>
        </div>

        <div className="max-w-[380px] w-full mx-auto">
          <div className="mb-8">
            <h2 className="text-white text-2xl font-bold tracking-tight mb-1">Access Platform</h2>
            <p className="font-mono-technical text-[11px] text-[#4a6080]">
              Authenticated access only · All sessions logged
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 mb-8">
            <div>
              <label className="font-mono-technical text-[10px] text-[#4a6080] tracking-widest block mb-1.5">
                EMAIL
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@organisation.com"
                className="w-full bg-[#0a1220] border border-[#1e2d42] text-white font-mono-technical text-[13px] px-4 py-3 focus:outline-none focus:border-[#50dbcb] placeholder:text-[#2a3d54] transition-colors"
              />
            </div>
            <div>
              <label className="font-mono-technical text-[10px] text-[#4a6080] tracking-widest block mb-1.5">
                ACCESS CODE
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••••"
                className="w-full bg-[#0a1220] border border-[#1e2d42] text-white font-mono-technical text-[13px] px-4 py-3 focus:outline-none focus:border-[#50dbcb] placeholder:text-[#2a3d54] transition-colors"
              />
            </div>

            {state === "error" && (
              <p className="font-mono-technical text-[11px] text-red-400">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={state === "loading"}
              className="w-full bg-[#50dbcb] text-[#080f18] font-mono-technical text-[12px] tracking-widest py-3 hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-50 mt-2"
            >
              {state === "loading" ? "AUTHENTICATING..." : "SIGN IN"}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="border-t border-[#1e2d42] pt-6">
            <p className="font-mono-technical text-[10px] text-[#4a6080] tracking-widest mb-3">
              DEMO ACCESS — CODE: nexori2025
            </p>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  onClick={() => quickLogin(acc.email)}
                  disabled={state === "loading"}
                  className="w-full text-left border border-[#1e2d42] px-4 py-3 hover:border-[#50dbcb]/40 hover:bg-[#50dbcb]/5 transition-colors disabled:opacity-50 group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono-technical text-[12px] text-white group-hover:text-[#50dbcb] transition-colors">
                        {acc.label}
                      </p>
                      <p className="font-mono-technical text-[10px] text-[#4a6080] mt-0.5">
                        {acc.desc}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 font-mono-technical text-[9px] border shrink-0 ml-4 ${
                        acc.role === "ADMIN"
                          ? "text-[#50dbcb] border-[#50dbcb]/40 bg-[#50dbcb]/10"
                          : acc.role === "APPROVER"
                            ? "text-amber-400 border-amber-400/40 bg-amber-400/10"
                            : "text-[#4a6080] border-[#1e2d42]"
                      }`}
                    >
                      {acc.role}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <p className="mt-8 font-mono-technical text-[10px] text-[#2a3d54] text-center">
            DORA · EU AI ACT · SOC2 · ISO 27001 — Compliant
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignIn() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#080f18]" />}>
      <SignInForm />
    </Suspense>
  );
}
