import prisma from "@/lib/db";
import Link from "next/link";
import TemplatesClient from "./TemplatesClient";

export const dynamic = "force-dynamic";

export type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  effort: string;
  stages: {
    stage: string;
    gateCategories: string[];
    gateHints: string[];
  }[];
  suggestedFrameworks: string[];
  suggestedDomains: string[];
  isBuiltIn: boolean;
  createdAt: Date;
};

export default async function TemplatesPage() {
  const [templates, gateCount] = await Promise.all([
    prisma.governanceTemplate.findMany({
      where: { enabled: true },
      orderBy: [{ isBuiltIn: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
        effort: true,
        stages: true,
        suggestedFrameworks: true,
        suggestedDomains: true,
        isBuiltIn: true,
        createdAt: true,
      },
    }),
    prisma.gateDefinition.count({ where: { enabled: true } }),
  ]);

  const typed = templates.map((t) => ({
    ...t,
    stages: t.stages as TemplateRow["stages"],
  }));

  return (
    <>
      <header className="h-16 px-xl flex items-center justify-between border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <div className="flex items-center gap-lg">
          <Link
            href="/admin"
            className="text-on-surface-variant hover:text-on-surface font-mono-technical text-[11px]"
          >
            ← ADMIN
          </Link>
          <h1 className="font-headline-md text-headline-md text-on-surface">
            Governance Profiles
          </h1>
        </div>
        <div className="flex items-center gap-md font-mono-technical text-[10px]">
          <span className="px-2 py-1 bg-primary/10 border border-primary text-primary">
            {templates.length} PROFILES
          </span>
          <span className="px-2 py-1 border border-border-muted text-on-surface-variant">
            {gateCount} GATES IN LIBRARY
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-xl">
        <div className="max-w-[1200px] mx-auto space-y-xl">
          {/* Explanation */}
          <div className="bg-surface border border-primary/20 p-xl">
            <p className="font-mono-technical text-[10px] text-primary tracking-widest mb-sm">
              WHAT ARE GOVERNANCE PROFILES?
            </p>
            <p className="font-body-base text-body-base text-on-surface-variant leading-relaxed text-[12px]">
              Profiles set the <strong>governance intensity</strong> for a delivery. Choose a profile
              based on your change&apos;s risk level — the platform AI automatically selects the right gates,
              routes approvals, and adapts the pipeline to the specific context. No manual gate
              configuration required. Higher intensity profiles unlock stronger regulatory assurance and
              audit evidence coverage.
            </p>
          </div>

          <TemplatesClient templates={typed} />
        </div>
      </div>
    </>
  );
}
