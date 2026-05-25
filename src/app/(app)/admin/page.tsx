import Link from "next/link";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

const ADMIN_SECTIONS = [
  {
    href: "/admin/projects",
    icon: "folder_special",
    title: "Projects & Programs",
    description:
      "Onboard new projects and programmes. View governance readiness, link connectors, and track GO/NO_GO status across your entire portfolio.",
    badge: "PORTFOLIO",
    badgeCls: "text-primary border-primary bg-primary/10",
  },
  {
    href: "/admin/frameworks",
    icon: "policy",
    title: "Compliance Frameworks",
    description:
      "Select regulatory frameworks, set region and industry context. AI advisor suggests what your enterprise must adhere to.",
    badge: "CONFIGURATION",
    badgeCls: "text-primary border-primary bg-primary/10",
  },
  {
    href: "/admin/trigger-rules",
    icon: "rule",
    title: "Governance Trigger Rules",
    description:
      "Define which tool events activate governance. Set conditions per Jira issue type, GitHub PR target branch, GitLab MR labels, and more.",
    badge: "ORCHESTRATION",
    badgeCls: "text-tertiary border-tertiary bg-tertiary/10",
  },
  {
    href: "/admin/connectors",
    icon: "hub",
    title: "Tool Connectors",
    description:
      "Manage Jira, GitHub, and GitLab connections. View webhook endpoints, test connectivity, and monitor event logs.",
    badge: "INTEGRATIONS",
    badgeCls: "text-primary border-primary bg-primary/10",
  },
  {
    href: "/admin/gate-library",
    icon: "checklist",
    title: "Gate Library",
    description:
      "Define reusable governance gates with skip conditions, SLAs, and required evidence types. Built-in gates plus admin-created custom gates.",
    badge: "GATE ENGINE",
    badgeCls: "text-primary border-primary bg-primary/10",
  },
  {
    href: "/admin/experts",
    icon: "group",
    title: "Expert Profiles",
    description:
      "Register governance reviewers with domain expertise, jurisdiction coverage, and workload caps. AI routes approvals to the right expert.",
    badge: "ROUTING",
    badgeCls: "text-primary border-primary bg-primary/10",
  },
  {
    href: "/admin/policy",
    icon: "description",
    title: "Policy Document RAG",
    description:
      "Upload internal policies and SOPs. The platform indexes them into a governance-aware RAG corpus. AI cites policy chunks in every response.",
    badge: "INTELLIGENCE",
    badgeCls: "text-tertiary border-tertiary bg-tertiary/10",
  },
];

export default async function AdminHub({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  const project = searchParams.projectId
    ? await prisma.project.findUnique({ where: { id: searchParams.projectId }, select: { id: true, name: true, key: true } })
    : await prisma.project.findFirst({ where: { status: "active" }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, key: true } });

  const [connectorCount, ruleCount, gateCount] = await Promise.all([
    prisma.sourceConnector.count(),
    project
      ? prisma.governanceTriggerRule.count({ where: { projectId: project.id } })
      : Promise.resolve(0),
    prisma.gateDefinition.count({ where: { enabled: true } }),
  ]);

  return (
    <>
      <header className="h-16 px-xl flex items-center justify-between border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <div className="flex items-center gap-xl">
          <h1 className="font-headline-md text-headline-md text-on-surface">Admin Configuration</h1>
          <span className="font-body-base text-body-base text-on-surface-variant">
            {project?.name ?? "No project"} · Enterprise governance settings
          </span>
        </div>
        <div className="flex items-center gap-md font-mono-technical text-[10px] text-on-surface-variant">
          <span>{connectorCount} CONNECTORS</span>
          <span className="text-border-muted">·</span>
          <span>{ruleCount} TRIGGER RULES</span>
          <span className="text-border-muted">·</span>
          <span>{gateCount} GATES</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-xl">
        <div className="max-w-[1200px] mx-auto space-y-lg">
          {/* Platform flexibility banner */}
          <div className="bg-surface border border-primary/30 p-xl grid grid-cols-12 gap-lg">
            <div className="col-span-12 lg:col-span-8">
              <p className="font-mono-technical text-[10px] text-primary tracking-widest mb-sm">
                ADAPTIVE GOVERNANCE ENGINE
              </p>
              <h2 className="font-headline-md text-headline-md text-on-surface mb-md">
                Configure exactly how your enterprise runs governance
              </h2>
              <p className="font-body-base text-body-base text-on-surface-variant leading-relaxed">
                NexoriOS is not a fixed-rules platform. Every aspect of governance — which
                frameworks apply, which events trigger a gate pipeline, what gates are required at
                each risk intensity, who reviews what — is configurable by your governance
                administrators. The AI engine then orchestrates delivery teams through your exact
                process.
              </p>
            </div>
            <div className="col-span-12 lg:col-span-4 flex flex-col justify-center gap-md">
              {[
                { label: "Agile-native", desc: "PR + sprint + deployment governance" },
                { label: "Tool-agnostic", desc: "Jira · GitHub · GitLab · Azure DevOps" },
                { label: "Region-aware", desc: "EU · UK · US · APAC · Global" },
                { label: "AI-advised", desc: "Framework suggestions per industry" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  <div>
                    <span className="font-body-bold text-body-bold text-on-surface text-[12px]">
                      {item.label}
                    </span>
                    <span className="font-mono-technical text-[10px] text-on-surface-variant">
                      {" "}
                      — {item.desc}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Admin section cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
            {ADMIN_SECTIONS.map((section) => (
              <Link
                key={section.href}
                href={section.href}
                className="bg-surface border border-border-muted hover:border-primary transition-colors p-xl flex flex-col gap-lg group"
              >
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 bg-surface-container-high border border-border-muted flex items-center justify-center group-hover:border-primary group-hover:bg-primary/5 transition-colors">
                    <span
                      className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors"
                      style={{ fontSize: 20 }}
                    >
                      {section.icon}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 font-mono-technical text-[9px] border ${section.badgeCls}`}
                  >
                    {section.badge}
                  </span>
                </div>
                <div>
                  <h3 className="font-body-bold text-body-bold text-on-surface mb-sm group-hover:text-primary transition-colors">
                    {section.title}
                  </h3>
                  <p className="font-body-base text-body-base text-on-surface-variant text-[12px] leading-relaxed">
                    {section.description}
                  </p>
                </div>
                <div className="mt-auto pt-md border-t border-border-muted flex items-center justify-between">
                  <span className="font-mono-technical text-[10px] text-on-surface-variant">
                    CONFIGURE →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <footer className="h-8 bg-surface-container-low border-t border-border-muted flex items-center px-xl font-mono-technical text-[10px] text-on-surface-variant shrink-0">
        <span>ADMIN_CONSOLE: ACTIVE · PROJECT: {project?.key ?? "N/A"}</span>
      </footer>
    </>
  );
}
