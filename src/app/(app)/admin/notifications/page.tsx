import prisma from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

const CHANNELS = [
  { id: "email", icon: "mail", label: "Email", desc: "Notify project managers and stakeholders by email" },
  { id: "jira", icon: "view_kanban", label: "Jira Issue", desc: "Create a Jira story or comment when risk is detected" },
  { id: "slack", icon: "chat", label: "Slack / Teams", desc: "Post to a project channel (configure webhook in Connectors)" },
  { id: "dashboard", icon: "dashboard", label: "Dashboard Only", desc: "Show in Project Hub only — no external notification" },
];

const TRIGGERS = [
  { event: "High-risk item detected", when: "Risk score exceeds threshold", default: "email + jira" },
  { event: "Readiness check rejected", when: "A required check is rejected", default: "email" },
  { event: "Missing evidence", when: "Evidence not submitted within 48h of gate opening", default: "jira" },
  { event: "Stale policy evidence", when: "Evidence older than 90 days on active item", default: "dashboard" },
  { event: "Weekly delivery summary", when: "Every Monday 09:00 project timezone", default: "email" },
  { event: "Sprint summary", when: "Sprint end detected via Jira", default: "email + jira" },
  { event: "Emergency lock engaged", when: "AI emergency shutdown activated", default: "email" },
];

export default async function NotificationRulesPage() {
  const projects = await prisma.project.findMany({
    select: { id: true, name: true, key: true },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <header className="h-16 px-xl flex items-center justify-between border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <div className="flex items-center gap-xl">
          <h1 className="font-headline-md text-headline-md text-on-surface">Notification Rules</h1>
          <span className="font-body-base text-body-base text-on-surface-variant text-[12px]">
            Configure how NexoriOS alerts your team — per project
          </span>
        </div>
        <span className="font-mono-technical text-[10px] text-on-surface-variant">
          {projects.length} PROJECT{projects.length !== 1 ? "S" : ""}
        </span>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-xl">
        <div className="max-w-[900px] mx-auto space-y-xl">

          {/* Channel overview */}
          <section className="bg-surface border border-border-muted">
            <div className="px-xl py-md border-b border-border-muted">
              <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">AVAILABLE CHANNELS</p>
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-border-muted">
              {CHANNELS.map((c) => (
                <div key={c.id} className="px-lg py-md flex items-start gap-md">
                  <span className="material-symbols-outlined text-primary select-none" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>
                    {c.icon}
                  </span>
                  <div>
                    <p className="font-body-bold text-[13px] text-on-surface">{c.label}</p>
                    <p className="font-mono-technical text-[10px] text-on-surface-variant mt-0.5">{c.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Default trigger → channel map */}
          <section className="bg-surface border border-border-muted">
            <div className="px-xl py-md border-b border-border-muted flex items-center justify-between">
              <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">DEFAULT NOTIFICATION TRIGGERS</p>
              <span className="font-mono-technical text-[9px] text-on-surface-variant">Customise per project via Project Hub → Configure Monitoring</span>
            </div>
            <div className="divide-y divide-border-muted">
              {TRIGGERS.map((t) => (
                <div key={t.event} className="px-xl py-md flex items-center gap-xl">
                  <div className="flex-1 min-w-0">
                    <p className="font-body-bold text-[13px] text-on-surface">{t.event}</p>
                    <p className="font-mono-technical text-[10px] text-on-surface-variant mt-0.5">{t.when}</p>
                  </div>
                  <span className="font-mono-technical text-[10px] border border-primary/40 text-primary px-2 py-0.5 shrink-0">
                    {t.default}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Per-project config links */}
          <section className="bg-surface border border-border-muted">
            <div className="px-xl py-md border-b border-border-muted">
              <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">CONFIGURE PER PROJECT</p>
            </div>
            {projects.length === 0 ? (
              <div className="px-xl py-lg">
                <p className="font-mono-technical text-[11px] text-on-surface-variant">No projects found. <Link href="/projects/start" className="text-primary hover:underline">Start or link a project →</Link></p>
              </div>
            ) : (
              <div className="divide-y divide-border-muted">
                {projects.map((p) => (
                  <div key={p.id} className="px-xl py-md flex items-center justify-between">
                    <div>
                      <p className="font-body-bold text-[13px] text-on-surface">{p.name}</p>
                      <p className="font-mono-technical text-[10px] text-on-surface-variant">{p.key}</p>
                    </div>
                    <div className="flex gap-sm">
                      <Link
                        href={`/projects/${p.id}`}
                        className="px-md py-xs border border-border-muted text-on-surface-variant font-mono-technical text-[10px] hover:border-primary hover:text-primary transition-colors"
                      >
                        PROJECT HUB →
                      </Link>
                      <Link
                        href={`/admin/trigger-rules?project=${p.id}`}
                        className="px-md py-xs border border-primary text-primary font-mono-technical text-[10px] hover:bg-primary/10 transition-colors"
                      >
                        MONITORING RULES →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="bg-surface-container-low border border-border-muted px-xl py-md">
            <p className="font-mono-technical text-[10px] text-on-surface-variant">
              Email and Slack/Teams require connector credentials. Configure in{" "}
              <Link href="/admin/connectors" className="text-primary hover:underline">Admin → Connectors</Link>.
              Jira notifications require a linked Jira connector per project.
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
