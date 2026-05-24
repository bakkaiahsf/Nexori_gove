import prisma from "@/lib/db";
import Link from "next/link";
import ExpertProfilesClient from "./ExpertProfilesClient";
import type { ExpertData } from "./constants";
export type { ExpertData } from "./constants";

export default async function ExpertProfilesPage() {
  const experts = await prisma.expertProfile.findMany({
    orderBy: [{ activeApprovals: "desc" }, { name: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      domains: true,
      jurisdictions: true,
      activeApprovals: true,
      avgResolutionHours: true,
      lastActiveAt: true,
      createdAt: true,
    },
  });

  const stats = {
    total: experts.length,
    active: experts.filter((e) => e.activeApprovals > 0).length,
    avgLoad:
      experts.length > 0
        ? Math.round(experts.reduce((s, e) => s + e.activeApprovals, 0) / experts.length)
        : 0,
    domains: [...new Set(experts.flatMap((e) => e.domains))].length,
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
          <h1 className="font-headline-md text-headline-md text-on-surface">Expert Profiles</h1>
        </div>
        <div className="flex items-center gap-md">
          <span className="px-2 py-1 bg-primary/10 border border-primary text-primary font-mono-technical text-[10px]">
            {stats.total} EXPERTS
          </span>
          <span className="px-2 py-1 bg-surface-container-low border border-border-muted text-on-surface-variant font-mono-technical text-[10px]">
            {stats.domains} DOMAINS
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-xl">
        <div className="max-w-[1200px] mx-auto space-y-xl">
          {/* Stats bar */}
          <div className="grid grid-cols-4 gap-md">
            {[
              { label: "TOTAL EXPERTS", value: stats.total, cls: "text-on-surface" },
              { label: "ACTIVE", value: stats.active, cls: "text-primary" },
              { label: "AVG LOAD", value: stats.avgLoad, cls: "text-tertiary" },
              { label: "DOMAINS", value: stats.domains, cls: "text-on-surface" },
            ].map((s) => (
              <div key={s.label} className="bg-surface border border-border-muted p-lg text-center">
                <p className={`font-mono-technical text-[28px] font-bold ${s.cls}`}>{s.value}</p>
                <p className="font-mono-technical text-[9px] text-on-surface-variant tracking-widest mt-xs">
                  {s.label}
                </p>
              </div>
            ))}
          </div>

          <ExpertProfilesClient experts={experts} />
        </div>
      </div>
    </>
  );
}
