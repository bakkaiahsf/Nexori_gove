import prisma from "@/lib/db";
import EvidenceClient from "@/components/governance/EvidenceClient";
import type { EvidenceItemData } from "@/components/governance/EvidenceClient";

export const dynamic = "force-dynamic";

export default async function Evidence({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  const project = searchParams.projectId
    ? await prisma.project.findUnique({
        where: { id: searchParams.projectId },
        select: { id: true, key: true },
      })
    : await prisma.project.findFirst({
        where: { status: "active" },
        orderBy: { createdAt: "asc" },
        select: { id: true, key: true },
      });

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="font-mono-technical text-on-surface-variant text-[12px]">
          No active projects —{" "}
          <a href="/admin/projects" className="text-primary underline">
            configure one
          </a>
        </p>
      </div>
    );
  }

  const [items, cases] = await Promise.all([
    prisma.evidenceItem.findMany({
      where: { projectId: project.id },
      include: {
        regulatoryMappings: {
          select: { framework: true, controlId: true, controlName: true, verifiedAt: true },
        },
        case: { select: { title: true, phase: true, status: true } },
      },
      orderBy: { submittedAt: "desc" },
    }),
    prisma.governanceCase.findMany({
      where: { projectId: project.id },
      select: { id: true, title: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const totalMapped = items.filter((i) => i.regulatoryMappings.length > 0).length;
  const verified = items.filter((i) => i.regulatoryMappings.some((m) => m.verifiedAt)).length;

  const serialisedItems: EvidenceItemData[] = items.map((i) => ({
    id: i.id,
    type: i.type,
    title: i.title,
    description: i.description,
    submittedBy: i.submittedBy,
    submittedAt: i.submittedAt.toISOString(),
    hash: i.hash,
    externalRef: i.externalRef,
    caseId: i.caseId,
    regulatoryMappings: i.regulatoryMappings.map((m) => ({
      framework: m.framework,
      controlId: m.controlId,
      controlName: m.controlName,
      verifiedAt: m.verifiedAt?.toISOString() ?? null,
    })),
    case: i.case
      ? { title: i.case.title, phase: i.case.phase, status: i.case.status }
      : null,
  }));

  return (
    <>
      <header className="h-16 px-xl flex items-center justify-between border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <div className="flex items-center gap-xl">
          <h1 className="font-headline-md text-headline-md text-on-surface">Evidence Vault</h1>
          <span className="font-body-base text-body-base text-on-surface-variant">
            Immutable · Append-Only · SHA-256 Hashed
          </span>
        </div>
        <div className="flex items-center gap-lg">
          <div className="text-right">
            <p className="font-mono-technical text-[10px] text-on-surface-variant">COVERAGE</p>
            <p className="font-body-bold text-body-bold text-primary">
              {totalMapped}/{items.length} MAPPED · {verified} VERIFIED
            </p>
          </div>
        </div>
      </header>

      {/* Summary bar */}
      <div className="px-xl pt-xl pb-0 shrink-0">
        <div className="max-w-[1200px] mx-auto grid grid-cols-4 gap-lg">
          {[
            { label: "TOTAL ITEMS", value: items.length, cls: "text-on-surface" },
            { label: "REG MAPPED", value: totalMapped, cls: "text-primary" },
            { label: "VERIFIED", value: verified, cls: "text-primary" },
            {
              label: "UNMAPPED",
              value: items.length - totalMapped,
              cls: items.length - totalMapped > 0 ? "text-tertiary" : "text-primary",
            },
          ].map(({ label, value, cls }) => (
            <div key={label} className="bg-surface border border-border-muted p-lg">
              <p className="font-mono-technical text-[10px] text-on-surface-variant mb-xs">
                {label}
              </p>
              <p className={`font-bold ${cls}`} style={{ fontSize: 36 }}>
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <EvidenceClient
        projectId={project.id}
        items={serialisedItems}
        cases={cases}
      />

      <footer className="h-8 bg-surface-container-low border-t border-border-muted flex items-center justify-between px-xl font-mono-technical text-[10px] text-on-surface-variant shrink-0">
        <div className="flex items-center gap-xl">
          <div className="flex items-center gap-xs">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span>EVIDENCE_VAULT: LOCKED · APPEND-ONLY</span>
          </div>
          <span>
            ITEMS: {items.length} · MAPPINGS: {items.flatMap((i) => i.regulatoryMappings).length}
          </span>
        </div>
        <span className="font-bold text-on-surface">{project.key}</span>
      </footer>
    </>
  );
}
