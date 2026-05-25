"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { canEmergencyLock } from "@/lib/auth";

const NAV_GROUPS = [
  {
    label: "GOVERNANCE",
    items: [
      { href: "/orchestration", icon: "account_tree", label: "Delivery Orchestration" },
      { href: "/release-readiness", icon: "rocket_launch", label: "Release Readiness" },
      { href: "/", icon: "dashboard", label: "Command Center" },
      { href: "/cases", icon: "folder_open", label: "Cases" },
      { href: "/timeline", icon: "history", label: "Flight Recorder" },
      { href: "/evidence", icon: "inventory_2", label: "Evidence Hub" },
    ],
  },
  {
    label: "INTELLIGENCE",
    items: [
      { href: "/intelligence", icon: "psychology", label: "Assurance Intelligence" },
      { href: "/ai-control", icon: "security", label: "Intelligence Controls" },
    ],
  },
  {
    label: "ADMIN",
    items: [
      { href: "/admin/programs", icon: "account_tree", label: "Programs" },
      { href: "/admin/projects", icon: "folder_special", label: "Projects" },
      { href: "/admin/templates", icon: "category", label: "Governance Profiles" },
      { href: "/admin/connectors", icon: "hub", label: "Connectors" },
      { href: "/admin/experts", icon: "group", label: "Expert Profiles" },
    ],
  },
  {
    label: "PLATFORM CONFIG",
    items: [
      { href: "/admin", icon: "tune", label: "Configuration" },
      { href: "/admin/frameworks", icon: "policy", label: "Frameworks" },
      { href: "/admin/trigger-rules", icon: "rule", label: "Trigger Rules" },
      { href: "/admin/gate-library", icon: "checklist", label: "Assurance Packs" },
      { href: "/admin/policy", icon: "description", label: "Policy Corpus" },
    ],
  },
];

function Icon({ name, fill = false, size = 20 }: { name: string; fill?: boolean; size?: number }) {
  return (
    <span
      className="material-symbols-outlined select-none"
      style={{ fontSize: size, fontVariationSettings: fill ? "'FILL' 1" : "'FILL' 0" }}
    >
      {name}
    </span>
  );
}

function EmergencyShutdownButton() {
  const router = useRouter();
  const { data: session } = useSession();
  const [state, setState] = useState<"idle" | "confirming" | "loading">("idle");
  const allowed = canEmergencyLock(session?.user?.role ?? "viewer");

  if (!allowed) return null;

  if (state === "confirming") {
    return (
      <div className="space-y-xs">
        <p className="font-mono-technical text-[10px] text-critical text-center">
          CONFIRM SHUTDOWN?
        </p>
        <div className="flex gap-xs">
          <button
            onClick={async () => {
              setState("loading");
              try {
                await fetch("/api/ai-control/mode", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    mode: "EMERGENCY_LOCK",
                    setBy: session?.user?.email,
                    reason: `Emergency shutdown via sidebar by ${session?.user?.name ?? session?.user?.email}`,
                  }),
                });
                router.push("/ai-control");
                router.refresh();
              } catch {
                setState("idle");
              }
            }}
            className="flex-1 bg-critical text-on-error font-label-caps text-label-caps py-sm text-[10px] hover:brightness-110"
          >
            YES
          </button>
          <button
            onClick={() => setState("idle")}
            className="flex-1 border border-border-muted text-on-surface-variant font-label-caps text-label-caps py-sm text-[10px]"
          >
            CANCEL
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setState("confirming")}
      disabled={state === "loading"}
      className="w-full bg-critical text-on-error-container font-label-caps text-label-caps py-md hover:brightness-110 active:scale-95 transition-all uppercase tracking-widest"
    >
      {state === "loading" ? "ENGAGING..." : "Emergency Shutdown"}
    </button>
  );
}

export default function SideNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [signingOut, setSigningOut] = useState(false);

  const initials =
    session?.user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "??";

  const roleBadge: Record<string, string> = {
    admin: "text-primary border-primary",
    "governance-owner": "text-primary border-primary",
    approver: "text-tertiary border-tertiary",
    viewer: "text-on-surface-variant border-border-muted",
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-[240px] bg-surface-container-low border-r border-border-muted flex flex-col py-xl z-50">
      {/* Wordmark */}
      <div className="px-lg mb-xxl">
        <div className="flex items-center gap-md">
          <div className="w-8 h-8 bg-primary flex items-center justify-center shrink-0">
            <Icon name="policy" fill size={18} />
          </div>
          <div>
            <p className="font-label-caps text-label-caps tracking-widest text-primary uppercase leading-none">
              Enterprise Governance
            </p>
            <p className="text-[10px] text-on-surface-variant font-mono-technical mt-0.5">
              Operational Control
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto space-y-lg px-0">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-lg font-mono-technical text-[9px] text-on-surface-variant/50 tracking-widest mb-xs">
              {group.label}
            </p>
            {group.items.map((item) => {
              const active =
                pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-md px-lg py-sm transition-all duration-150 ${
                    active
                      ? "bg-secondary-container text-on-secondary-container border-r-2 border-primary"
                      : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest"
                  }`}
                >
                  <Icon name={item.icon} fill={active} size={18} />
                  <span className="font-body-bold text-body-bold text-[13px]">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="mt-auto px-lg">
        <div className="pt-xl border-t border-border-muted space-y-sm mb-lg">
          <Link
            href="/timeline"
            className="flex items-center gap-md py-xs text-on-surface-variant hover:text-on-surface w-full text-left text-[12px] font-mono-technical transition-colors"
          >
            <Icon name="verified_user" size={14} />
            <span>Audit Logs</span>
          </Link>
          <Link
            href="/audit-export"
            className="flex items-center gap-md py-xs text-on-surface-variant hover:text-on-surface w-full text-left text-[12px] font-mono-technical transition-colors"
          >
            <Icon name="download" size={14} />
            <span>Export Audit Pack</span>
          </Link>
        </div>

        <EmergencyShutdownButton />

        {/* User identity */}
        {session?.user && (
          <div className="mt-lg pt-md border-t border-border-muted flex items-center gap-md">
            <div className="w-7 h-7 bg-primary/10 border border-primary flex items-center justify-center shrink-0">
              <span className="font-mono-technical text-[10px] text-primary">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-body-bold text-body-bold text-on-surface text-[11px] truncate">
                {session.user.name}
              </p>
              <span
                className={`font-mono-technical text-[9px] border px-1 ${roleBadge[session.user.role] ?? roleBadge.viewer}`}
              >
                {session.user.role?.toUpperCase()}
              </span>
            </div>
            <button
              onClick={async () => {
                setSigningOut(true);
                await signOut({ callbackUrl: "/sign-in" });
              }}
              disabled={signingOut}
              title="Sign out"
              className="text-on-surface-variant hover:text-critical transition-colors shrink-0"
            >
              <Icon name="logout" size={14} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
