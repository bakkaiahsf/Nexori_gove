"use client";

import { useState } from "react";

// ── Icon helper ───────────────────────────────────────────────────────────────
function Icon({ name, size = 24, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <span
      className={`material-symbols-outlined select-none ${className}`}
      style={{ fontSize: size }}
    >
      {name}
    </span>
  );
}

// ── Governance data types (static mock — will be replaced by API in Step 4) ──
type BadgeKind = "GATE" | "APPR" | "EVID" | "RISK";

interface GovernanceItem {
  id: string;
  kind: BadgeKind;
  label: string;
}

interface GovernanceCase {
  id: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  items: GovernanceItem[];
}

interface Program {
  id: string;
  label: string;
  meta: string;
  cases: GovernanceCase[];
}

const BADGE_STYLES: Record<BadgeKind, string> = {
  GATE: "bg-blue-500 text-white",
  APPR: "bg-orange-500 text-white",
  EVID: "bg-indigo-500 text-white",
  RISK: "bg-rose-500 text-white",
};

const PROGRAMS: Program[] = [
  {
    id: "p1",
    label: "DORA ICT Risk Programme",
    meta: "Governance Program • 3 Active Cases",
    cases: [
      {
        id: "c1",
        icon: "verified_user",
        iconBg: "bg-emerald-100",
        iconColor: "text-emerald-600",
        label: "Change Governance Review",
        items: [
          { id: "i1", kind: "GATE", label: "Security Sign-off" },
          { id: "i2", kind: "APPR", label: "CAB Approval Pending" },
        ],
      },
      {
        id: "c2",
        icon: "psychology",
        iconBg: "bg-purple-100",
        iconColor: "text-purple-600",
        label: "AI Model Validation",
        items: [
          { id: "i3", kind: "EVID", label: "Training Data Audit" },
          { id: "i4", kind: "RISK", label: "Bias Risk Assessment" },
        ],
      },
      {
        id: "c3",
        icon: "corporate_fare",
        iconBg: "bg-amber-100",
        iconColor: "text-amber-600",
        label: "Third-Party Risk Assessment",
        items: [],
      },
    ],
  },
];

const PICKER_ITEMS: { kind: BadgeKind; icon: string; label: string; bg: string }[] = [
  { kind: "GATE", icon: "lock_clock",    label: "Gov Gate",   bg: "bg-blue-500" },
  { kind: "APPR", icon: "approval",      label: "Approval",   bg: "bg-orange-500" },
  { kind: "EVID", icon: "folder_open",   label: "Evidence",   bg: "bg-indigo-500" },
  { kind: "RISK", icon: "warning_amber", label: "Risk Item",  bg: "bg-rose-500" },
];

// ── GovernanceItem (leaf node) ────────────────────────────────────────────────
function ItemCard({ item }: { item: GovernanceItem }) {
  return (
    <div className="relative pl-6 py-2">
      <div className="tree-line-h !left-[12px] !w-[12px]" />
      <div className="bg-slate-50 p-3 rounded-lg border border-dashed border-slate-200 flex items-center gap-3">
        <div
          className={`w-6 h-6 flex items-center justify-center rounded text-[10px] font-black leading-none ${BADGE_STYLES[item.kind]}`}
        >
          {item.kind}
        </div>
        <p className="text-sm text-slate-700 flex-1">{item.label}</p>
        <Icon name="drag_indicator" size={16} className="text-slate-400" />
      </div>
    </div>
  );
}

// ── GovernanceCase (child node) ───────────────────────────────────────────────
function CaseCard({ gc }: { gc: GovernanceCase }) {
  const [expanded, setExpanded] = useState(gc.id === "c1");

  return (
    <div className="relative pl-6 py-2">
      <div className="tree-line-h" />
      <div
        className="bg-white p-3 rounded-lg shadow-sm border border-slate-100 flex items-center gap-3 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className={`w-8 h-8 flex items-center justify-center ${gc.iconBg} ${gc.iconColor} rounded-lg`}>
          <Icon name={gc.icon} size={20} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-900">{gc.label}</p>
        </div>
        <Icon
          name={expanded ? "expand_less" : "expand_more"}
          size={18}
          className="text-slate-400"
        />
      </div>

      {expanded && gc.items.length > 0 && (
        <div className="ml-4 mt-2 relative">
          <div className="tree-line-v !left-[12px]" />
          {gc.items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Program (root node) ───────────────────────────────────────────────────────
function ProgramCard({ program }: { program: Program }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="relative mb-4">
      <div
        className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-100 z-10 relative cursor-pointer select-none"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="w-10 h-10 flex items-center justify-center bg-primary/10 text-primary rounded-lg">
          <Icon name="folder_open" size={24} />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-slate-900">{program.label}</h3>
          <p className="text-xs text-slate-500">{program.meta}</p>
        </div>
        <Icon name={open ? "expand_less" : "expand_more"} className="text-slate-400" />
      </div>

      {open && (
        <div className="ml-6 mt-2 relative">
          <div className="tree-line-v" />
          {program.cases.map((gc) => (
            <CaseCard key={gc.id} gc={gc} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── AI Control mode badge ─────────────────────────────────────────────────────
function AiModeBadge() {
  return (
    <span className="hidden sm:flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-1 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
      AI Assist
    </span>
  );
}

// ── Bottom navigation ─────────────────────────────────────────────────────────
type NavItem = { icon: string; label: string; active: boolean };
const NAV: NavItem[] = [
  { icon: "grid_view",   label: "Canvas",   active: true },
  { icon: "folder_open", label: "Evidence", active: false },
  { icon: "tune",        label: "Control",  active: false },
];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function GovernanceCanvas() {
  const [view, setView] = useState<"mobile" | "desktop">("mobile");

  return (
    <div className="bg-background-light text-slate-900 min-h-screen flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 glass border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary rounded-lg text-white">
            <Icon name="account_tree" size={22} />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-none text-slate-900">NexoriOS</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
              Governance Canvas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <AiModeBadge />
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setView("mobile")}
              className={`flex items-center justify-center w-10 h-8 rounded-lg transition-colors ${
                view === "mobile"
                  ? "bg-white shadow-sm text-primary"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Icon name="smartphone" size={20} />
            </button>
            <button
              onClick={() => setView("desktop")}
              className={`flex items-center justify-center w-10 h-8 rounded-lg transition-colors ${
                view === "desktop"
                  ? "bg-white shadow-sm text-primary"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Icon name="desktop_windows" size={20} />
            </button>
          </div>
          <button className="text-primary font-bold text-sm px-3 py-1 hover:bg-primary/10 rounded-lg transition-colors">
            Deploy
          </button>
        </div>
      </header>

      {/* ── Canvas ── */}
      <main className="flex-1 overflow-y-auto p-4 pb-48 relative">
        <div className="max-w-md mx-auto">
          {PROGRAMS.map((program) => (
            <ProgramCard key={program.id} program={program} />
          ))}

          {/* Add Program */}
          <div className="flex justify-center mt-6">
            <button className="flex flex-col items-center gap-2 group">
              <div className="w-10 h-10 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 group-hover:border-primary group-hover:text-primary transition-colors">
                <Icon name="add" size={20} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 group-hover:text-primary transition-colors">
                Add Program
              </span>
            </button>
          </div>
        </div>
      </main>

      {/* ── FAB ── */}
      <div className="fixed right-6 bottom-36 z-40">
        <button className="w-14 h-14 bg-primary text-white rounded-full shadow-primary-glow flex items-center justify-center active:scale-95 transition-transform hover:bg-primary/90">
          <Icon name="add" size={28} />
        </button>
      </div>

      {/* ── Component Picker Drawer ── */}
      <div className="fixed bottom-14 left-0 right-0 z-50 glass border-t border-slate-200 rounded-t-xl shadow-2xl pb-4">
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mt-3 mb-5" />
        <div className="px-6 mb-3">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Component Picker
          </h4>
        </div>
        <div className="flex gap-4 px-6 overflow-x-auto no-scrollbar pb-1">
          {PICKER_ITEMS.map((p) => (
            <div key={p.kind} className="flex flex-col items-center gap-2 min-w-[70px]">
              <div
                className={`w-16 h-16 ${p.bg} text-white rounded-2xl shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing hover:scale-105 transition-transform`}
              >
                <Icon name={p.icon} size={28} />
              </div>
              <span className="text-[11px] font-medium text-slate-600">{p.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom Nav ── */}
      <nav className="fixed bottom-0 w-full glass border-t border-slate-200 px-4 py-2 flex justify-around items-center z-[60]">
        {NAV.map((item) => (
          <button
            key={item.label}
            className={`flex flex-col items-center gap-0.5 transition-colors ${
              item.active ? "text-primary" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <Icon name={item.icon} size={24} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
