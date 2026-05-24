import prisma from "@/lib/db";
import Link from "next/link";
import GateLibraryClient from "./GateLibraryClient";
import { CATEGORY_META } from "./constants";
export type { GateWithStats } from "./constants";

export default async function GateLibraryPage() {
  const gates = await prisma.gateDefinition.findMany({
    orderBy: [{ isBuiltIn: "desc" }, { category: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      category: true,
      defaultSlaHours: true,
      intensityTriggers: true,
      requiredEvidence: true,
      approverRoles: true,
      isBuiltIn: true,
      enabled: true,
    },
  });

  const byCategory: Record<string, typeof gates> = {};
  for (const g of gates) {
    (byCategory[g.category] ??= []).push(g);
  }

  const stats = {
    total: gates.length,
    enabled: gates.filter((g) => g.enabled).length,
    builtIn: gates.filter((g) => g.isBuiltIn).length,
    custom: gates.filter((g) => !g.isBuiltIn).length,
  };

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
          <h1 className="font-headline-md text-headline-md text-on-surface">Gate Library</h1>
        </div>
        <div className="flex items-center gap-md">
          <span className="px-2 py-1 bg-primary/10 border border-primary text-primary font-mono-technical text-[10px]">
            {stats.enabled} / {stats.total} ACTIVE
          </span>
          <span className="px-2 py-1 bg-surface-container-low border border-border-muted text-on-surface-variant font-mono-technical text-[10px]">
            {stats.custom} CUSTOM
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-xl">
        <div className="max-w-[1200px] mx-auto space-y-xl">
          {/* Stats bar */}
          <div className="grid grid-cols-4 gap-md">
            {[
              { label: "TOTAL GATES", value: stats.total, cls: "text-on-surface" },
              {
                label: "ACTIVE",
                value: stats.enabled,
                cls: "text-primary",
              },
              { label: "BUILT-IN", value: stats.builtIn, cls: "text-on-surface-variant" },
              { label: "CUSTOM", value: stats.custom, cls: "text-tertiary" },
            ].map((s) => (
              <div key={s.label} className="bg-surface border border-border-muted p-lg text-center">
                <p className={`font-mono-technical text-[28px] font-bold ${s.cls}`}>{s.value}</p>
                <p className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest mt-xs">
                  {s.label}
                </p>
              </div>
            ))}
          </div>

          {/* Gate categories */}
          <GateLibraryClient gates={gates} byCategory={byCategory} />
        </div>
      </div>
    </>
  );
}
