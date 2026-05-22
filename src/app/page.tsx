export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center px-6">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="space-y-3">
          <p className="text-xs font-mono tracking-widest text-brand-500 uppercase">
            Enterprise Governance Platform
          </p>
          <h1 className="text-5xl font-bold tracking-tight text-white">NexoriOS</h1>
          <p className="text-lg text-slate-400 leading-relaxed">
            One control room for approvals, evidence, delivery risk, and AI oversight — built for
            regulated organisations operating under DORA and the EU AI Act.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-left">
          {[
            { label: "Governance Timeline", desc: "Immutable flight recorder for every decision" },
            { label: "AI Control Center", desc: "5-state AI mode management with emergency lock" },
            { label: "Evidence Engine", desc: "Audit packs mapped to DORA · EU AI Act · SOC2" },
            { label: "Regulatory Mapping", desc: "Evidence → control traceability out of the box" },
          ].map((module) => (
            <div
              key={module.label}
              className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-1"
            >
              <p className="text-sm font-semibold text-white">{module.label}</p>
              <p className="text-xs text-slate-500">{module.desc}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-slate-600">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span>Platform initialising — Sprint 1 in progress</span>
        </div>
      </div>
    </main>
  );
}
