import prisma from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function EmergencyControlsPage() {
  const [projects, recentLocks] = await Promise.all([
    prisma.project.findMany({
      include: { aiControlSetting: { select: { mode: true, setBy: true, setAt: true, reason: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.governanceEvent.findMany({
      where: { type: "AI_EMERGENCY_LOCK" },
      orderBy: { timestamp: "desc" },
      take: 10,
      select: { id: true, actorEmail: true, timestamp: true, projectId: true, payload: true },
    }),
  ]);

  const lockedProjects = projects.filter((p) => p.aiControlSetting?.mode === "EMERGENCY_LOCK");
  const activeProjects = projects.filter((p) => p.aiControlSetting?.mode !== "EMERGENCY_LOCK");

  return (
    <>
      <header className="h-16 px-xl flex items-center justify-between border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <div className="flex items-center gap-xl">
          <h1 className="font-headline-md text-headline-md text-on-surface">Emergency Controls</h1>
          <span className="font-body-base text-body-base text-on-surface-variant text-[12px]">
            Emergency AI shutdown · Governance continues uninterrupted
          </span>
        </div>
        {lockedProjects.length > 0 && (
          <span className="px-md py-xs border border-critical text-critical font-mono-technical text-[10px]">
            {lockedProjects.length} PROJECT{lockedProjects.length !== 1 ? "S" : ""} LOCKED
          </span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-xl">
        <div className="max-w-[900px] mx-auto space-y-xl">

          {/* What emergency lock does */}
          <section className="bg-surface border border-border-muted">
            <div className="px-xl py-md border-b border-border-muted">
              <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">WHAT EMERGENCY LOCK DOES</p>
            </div>
            <div className="grid grid-cols-3 divide-x divide-border-muted">
              {[
                { icon: "cancel", label: "AI immediately disabled", desc: "No AI calls, no AI suggestions, no AI scoring", cls: "text-critical" },
                { icon: "check_circle", label: "Governance continues", desc: "Manual approvals, evidence, and reviews all work normally", cls: "text-primary" },
                { icon: "history", label: "All actions logged", desc: "Lock event recorded in Flight Recorder with actor and timestamp", cls: "text-primary" },
              ].map((item) => (
                <div key={item.label} className="px-lg py-lg text-center space-y-sm">
                  <span className={`material-symbols-outlined select-none ${item.cls}`} style={{ fontSize: 24, fontVariationSettings: "'FILL' 1" }}>
                    {item.icon}
                  </span>
                  <p className="font-body-bold text-[13px] text-on-surface">{item.label}</p>
                  <p className="font-mono-technical text-[10px] text-on-surface-variant">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Currently locked */}
          {lockedProjects.length > 0 && (
            <section className="bg-surface border border-critical/40">
              <div className="px-xl py-md border-b border-critical/30 flex items-center gap-md">
                <span className="material-symbols-outlined text-critical select-none" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}>warning</span>
                <p className="font-mono-technical text-[10px] text-critical tracking-widest">EMERGENCY LOCK ACTIVE</p>
              </div>
              <div className="divide-y divide-border-muted">
                {lockedProjects.map((p) => (
                  <div key={p.id} className="px-xl py-md flex items-center justify-between">
                    <div>
                      <p className="font-body-bold text-[13px] text-on-surface">{p.name}</p>
                      <p className="font-mono-technical text-[10px] text-on-surface-variant">
                        Locked by {p.aiControlSetting?.setBy} ·{" "}
                        {p.aiControlSetting?.setAt
                          ? new Date(p.aiControlSetting.setAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                          : "unknown time"}
                      </p>
                      {p.aiControlSetting?.reason && (
                        <p className="font-mono-technical text-[10px] text-critical mt-0.5">{p.aiControlSetting.reason}</p>
                      )}
                    </div>
                    <Link
                      href={`/ai-control?projectId=${p.id}`}
                      className="px-md py-xs border border-primary text-primary font-mono-technical text-[10px] hover:bg-primary/10 transition-colors"
                    >
                      RESTORE MODE →
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Active projects — per-project controls */}
          <section className="bg-surface border border-border-muted">
            <div className="px-xl py-md border-b border-border-muted">
              <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">
                PROJECT INTELLIGENCE MODES ({activeProjects.length} ACTIVE)
              </p>
            </div>
            <div className="divide-y divide-border-muted">
              {activeProjects.map((p) => {
                const mode = p.aiControlSetting?.mode ?? "AI_ASSIST";
                const modeCls =
                  mode === "HUMAN_ONLY" ? "text-on-surface-variant border-border-muted" :
                  mode === "EMERGENCY_LOCK" ? "text-critical border-critical" :
                  "text-primary border-primary";
                return (
                  <div key={p.id} className="px-xl py-md flex items-center justify-between">
                    <div>
                      <p className="font-body-bold text-[13px] text-on-surface">{p.name}</p>
                      <p className="font-mono-technical text-[10px] text-on-surface-variant">{p.key}</p>
                    </div>
                    <div className="flex items-center gap-md">
                      <span className={`font-mono-technical text-[9px] border px-1.5 py-0.5 ${modeCls}`}>
                        {mode.replace(/_/g, " ")}
                      </span>
                      <Link
                        href={`/ai-control?projectId=${p.id}`}
                        className="px-md py-xs border border-border-muted text-on-surface-variant font-mono-technical text-[10px] hover:border-critical hover:text-critical transition-colors"
                      >
                        MANAGE →
                      </Link>
                    </div>
                  </div>
                );
              })}
              {activeProjects.length === 0 && (
                <p className="px-xl py-lg font-mono-technical text-[11px] text-on-surface-variant">No active projects.</p>
              )}
            </div>
          </section>

          {/* Emergency lock audit trail */}
          {recentLocks.length > 0 && (
            <section className="bg-surface border border-border-muted">
              <div className="px-xl py-md border-b border-border-muted">
                <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">EMERGENCY LOCK HISTORY</p>
              </div>
              <div className="divide-y divide-border-muted">
                {recentLocks.map((e) => {
                  const proj = projects.find((p) => p.id === e.projectId);
                  return (
                    <div key={e.id} className="px-xl py-md flex items-center gap-xl">
                      <span className="font-mono-technical text-[9px] text-on-surface-variant w-[140px] shrink-0">
                        {new Date(e.timestamp).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono-technical text-[11px] text-on-surface">
                          {proj?.name ?? e.projectId} — Emergency lock engaged
                        </p>
                        {e.actorEmail && (
                          <p className="font-mono-technical text-[9px] text-on-surface-variant mt-0.5">{e.actorEmail}</p>
                        )}
                      </div>
                      {proj && (
                        <Link href={`/timeline?projectId=${proj.id}`} className="font-mono-technical text-[10px] text-primary hover:underline shrink-0">
                          VIEW LOG →
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <div className="bg-surface-container-low border border-border-muted px-xl py-md">
            <p className="font-mono-technical text-[10px] text-on-surface-variant">
              Emergency lock can also be triggered instantly from the sidebar button on any screen. Only users with the <strong>admin</strong> or <strong>governance-owner</strong> role can engage or release emergency controls.
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
