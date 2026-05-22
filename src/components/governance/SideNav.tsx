"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", icon: "dashboard", label: "Command Center" },
  { href: "/timeline", icon: "history", label: "Timeline" },
  { href: "/ai-control", icon: "smart_toy", label: "AI Control" },
  { href: "/intelligence", icon: "policy", label: "Intelligence" },
];

function Icon({ name, fill = false, size = 20 }: { name: string; fill?: boolean; size?: number }) {
  return (
    <span
      className="material-symbols-outlined select-none"
      style={{
        fontSize: size,
        fontVariationSettings: fill ? "'FILL' 1" : "'FILL' 0",
      }}
    >
      {name}
    </span>
  );
}

export default function SideNav() {
  const pathname = usePathname();

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
      <nav className="flex-1 space-y-0.5">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-md px-lg py-md transition-all duration-150 ${
                active
                  ? "bg-secondary-container text-on-secondary-container border-r-2 border-primary"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest"
              }`}
            >
              <Icon name={item.icon} fill={active} />
              <span className="font-body-bold text-body-bold">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer links + Emergency */}
      <div className="mt-auto px-lg">
        <div className="pt-xl border-t border-border-muted space-y-sm mb-lg">
          <button className="flex items-center gap-md py-xs text-on-surface-variant hover:text-on-surface w-full text-left text-[12px] font-mono-technical transition-colors">
            <Icon name="verified_user" size={14} />
            <span>Audit Logs</span>
          </button>
          <button className="flex items-center gap-md py-xs text-on-surface-variant hover:text-on-surface w-full text-left text-[12px] font-mono-technical transition-colors">
            <Icon name="menu_book" size={14} />
            <span>Documentation</span>
          </button>
        </div>
        <button className="w-full bg-critical text-on-error-container font-label-caps text-label-caps py-md hover:brightness-110 active:scale-95 transition-all uppercase tracking-widest">
          Emergency Shutdown
        </button>
      </div>
    </aside>
  );
}
