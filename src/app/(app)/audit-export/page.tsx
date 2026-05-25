import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <span
      className="material-symbols-outlined select-none leading-none"
      style={{ fontSize: size, fontVariationSettings: "'FILL' 0" }}
    >
      {name}
    </span>
  );
}

export default async function AuditExport({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  const project = searchParams.projectId
    ? await prisma.project.findUnique({ where: { id: searchParams.projectId }, select: { id: true, name: true, key: true } })
    : await prisma.project.findFirst({ where: { status: "active" }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, key: true } });

  const [eventsCount, evidenceCount, mappingsCount, risksCount, gatesCount, thirdPartyCount] =
    project
      ? await Promise.all([
          prisma.governanceEvent.count({ where: { projectId: project.id } }),
          prisma.evidenceItem.count({ where: { projectId: project.id } }),
          prisma.regulatoryMapping.count({ where: { projectId: project.id } }),
          prisma.riskItem.count({ where: { projectId: project.id } }),
          prisma.governanceGate.count({ where: { case: { projectId: project.id } } }),
          prisma.thirdPartyDependency.count({ where: { projectId: project.id } }),
        ])
      : [0, 0, 0, 0, 0, 0];

  const exportedAt = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const packs = [
    {
      id: "full-json",
      title: "Full Audit Pack",
      subtitle: "Complete governance export — JSON",
      description:
        "All governance events, evidence items, gate decisions, risk items, regulatory mappings, and third-party dependencies. Suitable for external auditors and regulatory review.",
      icon: "inventory_2",
      href: "/api/audit-export?format=json",
      items: [
        { label: "Governance Events", count: eventsCount },
        { label: "Evidence Items", count: evidenceCount },
        { label: "Control Mappings", count: mappingsCount },
        { label: "Risk Items", count: risksCount },
        { label: "Gates", count: gatesCount },
        { label: "Third-Party Deps", count: thirdPartyCount },
      ],
      frameworks: ["DORA", "EU AI ACT", "SOC2", "ISO 27001"],
      cls: "border-primary",
      badge: "JSON",
      badgeCls: "bg-primary/10 text-primary border border-primary",
    },
    {
      id: "csv",
      title: "Event Log CSV",
      subtitle: "Governance flight recorder — CSV",
      description:
        "Flat CSV export of all immutable governance events. Compatible with Excel, Splunk, and SIEM tools. Ideal for compliance teams doing control testing.",
      icon: "table_chart",
      href: "/api/audit-export?format=csv",
      items: [{ label: "Governance Events", count: eventsCount }],
      frameworks: ["All frameworks"],
      cls: "border-border-muted",
      badge: "CSV",
      badgeCls: "bg-surface-container-high text-on-surface border border-border-muted",
    },
  ];

  return (
    <>
      <header className="h-16 px-xl flex items-center justify-between border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <div className="flex items-center gap-xl">
          <h1 className="font-headline-md text-headline-md text-on-surface">Audit Export</h1>
          <span className="font-body-base text-body-base text-on-surface-variant">
            Sprint 4 · Regulatory Pack Generator
          </span>
        </div>
        <div className="font-mono-technical text-[10px] text-on-surface-variant">
          GENERATED: {exportedAt}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-xl">
        <div className="max-w-[900px] mx-auto space-y-xl">
          {/* Context */}
          <div className="bg-surface border border-border-muted p-xl">
            <div className="flex items-start gap-lg">
              <div className="w-10 h-10 bg-primary/10 border border-primary flex items-center justify-center shrink-0">
                <Icon name="shield" size={20} />
              </div>
              <div>
                <h3 className="font-body-bold text-body-bold text-on-surface mb-sm">
                  {project?.name ?? "NexoriOS"} — Governance Audit Pack
                </h3>
                <p className="font-body-base text-body-base text-on-surface-variant">
                  These exports are generated from the immutable governance flight recorder. Every
                  record is append-only and SHA-256 hashed. Suitable for DORA Article 25 ICT risk
                  reporting, EU AI Act Article 11 technical documentation, and SOC 2 Type II audit
                  evidence.
                </p>
                <div className="flex gap-md mt-md flex-wrap">
                  {["DORA Art. 25", "EU AI Act Art. 11", "SOC2 CC6", "ISO 27001 A.8"].map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 font-mono-technical text-[10px] border border-primary text-primary bg-primary/5"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Export packs */}
          {packs.map((pack) => (
            <div key={pack.id} className={`bg-surface border ${pack.cls} overflow-hidden`}>
              <div className="p-xl border-b border-border-muted flex items-start justify-between gap-lg">
                <div className="flex items-start gap-lg">
                  <div className="w-10 h-10 bg-surface-container-high border border-border-muted flex items-center justify-center shrink-0">
                    <Icon name={pack.icon} size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-md mb-xs">
                      <h3 className="font-body-bold text-body-bold text-on-surface">
                        {pack.title}
                      </h3>
                      <span
                        className={`px-2 py-0.5 font-mono-technical text-[10px] ${pack.badgeCls}`}
                      >
                        {pack.badge}
                      </span>
                    </div>
                    <p className="font-mono-technical text-[11px] text-on-surface-variant mb-sm">
                      {pack.subtitle}
                    </p>
                    <p className="font-body-base text-body-base text-on-surface-variant text-[12px] max-w-[560px]">
                      {pack.description}
                    </p>
                  </div>
                </div>
                <a
                  href={pack.href}
                  download
                  className="shrink-0 flex items-center gap-sm px-lg py-md bg-primary text-on-primary font-label-caps text-label-caps hover:brightness-110 active:scale-95 transition-all"
                >
                  <Icon name="download" size={16} />
                  DOWNLOAD
                </a>
              </div>
              <div className="p-xl">
                <div className="grid grid-cols-3 gap-md mb-lg">
                  {pack.items.map(({ label, count }) => (
                    <div
                      key={label}
                      className="bg-surface-container-low border border-border-muted p-md"
                    >
                      <p className="font-mono-technical text-[10px] text-on-surface-variant">
                        {label}
                      </p>
                      <p className="font-body-bold text-body-bold text-primary mt-xs">{count}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-md flex-wrap">
                  {pack.frameworks.map((f) => (
                    <span
                      key={f}
                      className="font-mono-technical text-[10px] text-on-surface-variant"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* Compliance notice */}
          <div className="bg-surface-container-low border border-border-muted p-lg">
            <p className="font-mono-technical text-[10px] text-on-surface-variant leading-relaxed">
              COMPLIANCE NOTE: All exported records are immutable and cryptographically bound to the
              governance ledger. Records may not be altered after creation. Any modification
              constitutes a governance breach and must be reported per DORA Article 19 incident
              notification requirements. Export timestamp is authoritative for audit purposes.
            </p>
          </div>
        </div>
      </div>

      <footer className="h-8 bg-surface-container-low border-t border-border-muted flex items-center justify-between px-xl font-mono-technical text-[10px] text-on-surface-variant shrink-0">
        <div className="flex items-center gap-xl">
          <div className="flex items-center gap-xs">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span>AUDIT_ENGINE: READY</span>
          </div>
          <span>PROJECT: {project?.key ?? "—"}</span>
        </div>
        <span className="font-bold text-on-surface">v0.1.0-MVP</span>
      </footer>
    </>
  );
}
