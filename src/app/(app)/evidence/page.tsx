import prisma from "@/lib/db";
import { DEMO_PROJECT_KEY } from "@/lib/governance";
import { EvidenceType, RegulatoryFramework } from "@prisma/client";

export const dynamic = "force-dynamic";

const TYPE_META: Record<EvidenceType, { label: string; icon: string }> = {
  DOCUMENT: { label: "Document", icon: "description" },
  TEST_RESULT: { label: "Test Result", icon: "science" },
  AUDIT_LOG: { label: "Audit Log", icon: "receipt_long" },
  SCREENSHOT: { label: "Screenshot", icon: "screenshot_monitor" },
  SIGNED_ATTESTATION: { label: "Attestation", icon: "verified_user" },
  POLICY_REFERENCE: { label: "Policy Ref", icon: "policy" },
  EXTERNAL_LINK: { label: "External Link", icon: "open_in_new" },
};

const FRAMEWORK_CLS: Record<RegulatoryFramework, string> = {
  DORA: "text-primary border-primary bg-primary/10",
  EU_AI_ACT: "text-tertiary border-tertiary bg-tertiary/10",
  SOC2: "text-primary border-primary bg-primary/10",
  ISO_27001: "text-on-surface-variant border-border-muted",
  PCI_DSS: "text-on-surface-variant border-border-muted",
  GDPR: "text-tertiary border-tertiary bg-tertiary/10",
};

function Icon({ name, size = 16 }: { name: string; size?: number }) {
  return (
    <span
      className="material-symbols-outlined select-none leading-none"
      style={{ fontSize: size, fontVariationSettings: "'FILL' 0" }}
    >
      {name}
    </span>
  );
}

export default async function Evidence() {
  const project = await prisma.project.findUnique({
    where: { key: DEMO_PROJECT_KEY },
    select: { id: true },
  });

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="font-mono-technical text-on-surface-variant text-[12px]">
          No project — run: <code className="text-primary">npx prisma db seed</code>
        </p>
      </div>
    );
  }

  const items = await prisma.evidenceItem.findMany({
    where: { projectId: project.id },
    include: {
      regulatoryMappings: {
        select: { framework: true, controlId: true, controlName: true, verifiedAt: true },
      },
      case: { select: { title: true, phase: true } },
    },
    orderBy: { submittedAt: "desc" },
  });

  const totalMapped = items.filter((i) => i.regulatoryMappings.length > 0).length;
  const verified = items.filter((i) => i.regulatoryMappings.some((m) => m.verifiedAt)).length;

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

      <div className="flex-1 overflow-y-auto custom-scrollbar p-xl">
        <div className="max-w-[1200px] mx-auto">
          {/* Summary bar */}
          <div className="grid grid-cols-4 gap-lg mb-xl">
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
                <p
                  className={`font-display-lg text-display-lg font-bold ${cls}`}
                  style={{ fontSize: 36 }}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Evidence table */}
          <div className="bg-surface border border-border-muted overflow-hidden">
            <div className="p-xl border-b border-border-muted flex items-center justify-between">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
                EVIDENCE REGISTER
              </h3>
              <span className="font-mono-technical text-[11px] text-on-surface-variant">
                {items.length} ITEM{items.length !== 1 ? "S" : ""}
              </span>
            </div>
            {items.length === 0 ? (
              <div className="p-xl">
                <p className="font-mono-technical text-[11px] text-on-surface-variant">
                  No evidence items submitted yet.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border-muted">
                {items.map((item) => {
                  const typeMeta = TYPE_META[item.type] ?? {
                    label: item.type,
                    icon: "description",
                  };
                  return (
                    <div
                      key={item.id}
                      className="p-xl hover:bg-surface-container-high transition-colors"
                    >
                      <div className="flex items-start gap-lg">
                        <div className="w-8 h-8 bg-surface-container-high border border-border-muted flex items-center justify-center shrink-0 mt-0.5">
                          <Icon name={typeMeta.icon} size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-md mb-sm flex-wrap">
                            <span className="font-body-bold text-body-bold text-on-surface">
                              {item.title}
                            </span>
                            <span className="px-2 py-0.5 font-mono-technical text-[10px] border border-border-muted text-on-surface-variant">
                              {typeMeta.label}
                            </span>
                            {item.case && (
                              <span className="font-mono-technical text-[10px] text-on-surface-variant">
                                {item.case.title}
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className="font-body-base text-body-base text-on-surface-variant text-[12px] mb-md line-clamp-2">
                              {item.description}
                            </p>
                          )}
                          {/* Regulatory mappings */}
                          {item.regulatoryMappings.length > 0 && (
                            <div className="flex flex-wrap gap-xs mt-sm">
                              {item.regulatoryMappings.map((m) => (
                                <span
                                  key={`${m.framework}-${m.controlId}`}
                                  className={`px-2 py-0.5 font-mono-technical text-[10px] border ${FRAMEWORK_CLS[m.framework] ?? "text-on-surface-variant border-border-muted"}`}
                                  title={m.controlName ?? m.controlId}
                                >
                                  {m.framework.replace("_", " ")} · {m.controlId}
                                  {m.verifiedAt && " ✓"}
                                </span>
                              ))}
                            </div>
                          )}
                          {item.regulatoryMappings.length === 0 && (
                            <span className="px-2 py-0.5 font-mono-technical text-[10px] border border-tertiary/50 text-tertiary bg-tertiary/5">
                              UNMAPPED — no regulatory control linked
                            </span>
                          )}
                        </div>
                        <div className="text-right shrink-0 space-y-xs">
                          <p className="font-mono-technical text-[10px] text-on-surface-variant">
                            {new Date(item.submittedAt).toLocaleDateString("en-GB")}
                          </p>
                          <p className="font-mono-technical text-[10px] text-on-surface-variant">
                            {item.submittedBy}
                          </p>
                          {item.hash && (
                            <p className="font-mono-technical text-[9px] text-on-surface-variant font-bold">
                              SHA256:{item.hash.slice(0, 12)}…
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

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
        <span className="font-bold text-on-surface">v0.1.0-MVP</span>
      </footer>
    </>
  );
}
