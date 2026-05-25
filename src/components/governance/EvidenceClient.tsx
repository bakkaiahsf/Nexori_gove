"use client";

import { useState } from "react";
import { EvidenceType, RegulatoryFramework } from "@prisma/client";
import { useRouter } from "next/navigation";

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

interface RegulatoryMapping {
  framework: RegulatoryFramework;
  controlId: string;
  controlName: string | null;
  verifiedAt: string | null;
}

interface EvidenceCase {
  title: string;
  phase: string;
  status: string;
}

export interface EvidenceItemData {
  id: string;
  type: EvidenceType;
  title: string;
  description: string | null;
  submittedBy: string;
  submittedAt: string;
  hash: string | null;
  externalRef: string | null;
  caseId: string | null;
  regulatoryMappings: RegulatoryMapping[];
  case: EvidenceCase | null;
}

type Tab = "all" | "by-case" | "by-framework" | "stale";

const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;

function EvidenceRow({ item }: { item: EvidenceItemData }) {
  const typeMeta = TYPE_META[item.type] ?? { label: item.type, icon: "description" };
  return (
    <div className="p-xl hover:bg-surface-container-high transition-colors">
      <div className="flex items-start gap-lg">
        <div className="w-8 h-8 bg-surface-container-high border border-border-muted flex items-center justify-center shrink-0 mt-0.5">
          <Icon name={typeMeta.icon} size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-md mb-sm flex-wrap">
            <span className="font-body-bold text-body-bold text-on-surface">{item.title}</span>
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
          {item.regulatoryMappings.length > 0 ? (
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
          ) : (
            <span className="px-2 py-0.5 font-mono-technical text-[10px] border border-tertiary/50 text-tertiary bg-tertiary/5">
              UNMAPPED — no regulatory control linked
            </span>
          )}
        </div>
        <div className="text-right shrink-0 space-y-xs">
          <p className="font-mono-technical text-[10px] text-on-surface-variant">
            {new Date(item.submittedAt).toLocaleDateString("en-GB")}
          </p>
          <p className="font-mono-technical text-[10px] text-on-surface-variant">{item.submittedBy}</p>
          {item.hash && (
            <p className="font-mono-technical text-[9px] text-on-surface-variant font-bold">
              SHA256:{item.hash.slice(0, 12)}…
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

interface SubmitFormProps {
  projectId: string;
  cases: { id: string; title: string }[];
  onClose: () => void;
}

function SubmitForm({ projectId, cases, onClose }: SubmitFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    type: "DOCUMENT" as EvidenceType,
    title: "",
    description: "",
    submittedBy: "",
    caseId: "",
    externalRef: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!form.title.trim() || !form.submittedBy.trim()) {
      setError("Title and submitter email are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          type: form.type,
          title: form.title,
          description: form.description || undefined,
          submittedBy: form.submittedBy,
          caseId: form.caseId || undefined,
          externalRef: form.externalRef || undefined,
        }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? `Failed (${res.status})`);
        return;
      }
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  const field = "w-full bg-surface-container-low border border-border-muted px-md py-sm font-mono-technical text-[12px] text-on-surface outline-none focus:border-primary";

  return (
    <div className="bg-surface border border-primary/30 p-xl space-y-lg">
      <div className="flex items-center justify-between">
        <p className="font-label-caps text-label-caps text-primary tracking-widest">
          SUBMIT EVIDENCE
        </p>
        <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
          <Icon name="close" size={16} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-lg">
        <div>
          <label className="font-mono-technical text-[10px] text-on-surface-variant block mb-sm">
            EVIDENCE TYPE *
          </label>
          <select
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as EvidenceType }))}
            className={field}
          >
            {Object.entries(TYPE_META).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="font-mono-technical text-[10px] text-on-surface-variant block mb-sm">
            LINKED CASE (optional)
          </label>
          <select
            value={form.caseId}
            onChange={(e) => setForm((f) => ({ ...f, caseId: e.target.value }))}
            className={field}
          >
            <option value="">— no case —</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="font-mono-technical text-[10px] text-on-surface-variant block mb-sm">
          TITLE *
        </label>
        <input
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className={field}
          placeholder="e.g. DORA Penetration Test Report Q1 2026"
        />
      </div>

      <div>
        <label className="font-mono-technical text-[10px] text-on-surface-variant block mb-sm">
          DESCRIPTION
        </label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={3}
          className={`${field} resize-none`}
          placeholder="Brief description of this evidence item…"
        />
      </div>

      <div className="grid grid-cols-2 gap-lg">
        <div>
          <label className="font-mono-technical text-[10px] text-on-surface-variant block mb-sm">
            SUBMITTED BY (email) *
          </label>
          <input
            value={form.submittedBy}
            onChange={(e) => setForm((f) => ({ ...f, submittedBy: e.target.value }))}
            className={field}
            placeholder="governance@company.com"
          />
        </div>
        <div>
          <label className="font-mono-technical text-[10px] text-on-surface-variant block mb-sm">
            EXTERNAL REF / URL
          </label>
          <input
            value={form.externalRef}
            onChange={(e) => setForm((f) => ({ ...f, externalRef: e.target.value }))}
            className={field}
            placeholder="https://docs.company.com/…"
          />
        </div>
      </div>

      {error && <p className="font-mono-technical text-[11px] text-critical">{error}</p>}

      <div className="flex gap-md">
        <button
          onClick={() => void submit()}
          disabled={saving}
          className="flex items-center gap-sm px-xl py-sm bg-primary text-background font-mono-technical text-[11px] hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <>
              <span className="w-3 h-3 border border-background/40 border-t-background rounded-full animate-spin" />
              SAVING
            </>
          ) : (
            "SUBMIT EVIDENCE"
          )}
        </button>
        <button
          onClick={onClose}
          className="px-xl py-sm border border-border-muted font-mono-technical text-[11px] text-on-surface-variant hover:border-primary transition-colors"
        >
          CANCEL
        </button>
      </div>
    </div>
  );
}

interface Props {
  projectId: string;
  items: EvidenceItemData[];
  cases: { id: string; title: string }[];
}

export default function EvidenceClient({ projectId, items, cases }: Props) {
  const [tab, setTab] = useState<Tab>("all");
  const [showSubmit, setShowSubmit] = useState(false);

  const now = Date.now();
  const staleItems = items.filter(
    (i) => i.case?.status === "active" && now - new Date(i.submittedAt).getTime() > NINETY_DAYS
  );

  // Group by case
  const byCaseMap = new Map<string, { caseTitle: string; items: EvidenceItemData[] }>();
  for (const item of items) {
    const key = item.caseId ?? "__no_case__";
    if (!byCaseMap.has(key)) {
      byCaseMap.set(key, { caseTitle: item.case?.title ?? "No Case", items: [] });
    }
    byCaseMap.get(key)!.items.push(item);
  }

  // Group by framework
  const byFrameworkMap = new Map<string, EvidenceItemData[]>();
  for (const item of items) {
    if (item.regulatoryMappings.length === 0) {
      const key = "UNMAPPED";
      if (!byFrameworkMap.has(key)) byFrameworkMap.set(key, []);
      byFrameworkMap.get(key)!.push(item);
    } else {
      for (const m of item.regulatoryMappings) {
        if (!byFrameworkMap.has(m.framework)) byFrameworkMap.set(m.framework, []);
        byFrameworkMap.get(m.framework)!.push(item);
      }
    }
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "all", label: "ALL", count: items.length },
    { id: "by-case", label: "BY CASE", count: byCaseMap.size },
    { id: "by-framework", label: "BY FRAMEWORK", count: byFrameworkMap.size },
    { id: "stale", label: "STALE", count: staleItems.length },
  ];

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-xl">
      <div className="max-w-[1200px] mx-auto">
        {/* Tab bar + submit button */}
        <div className="flex items-center justify-between mb-xl">
          <div className="flex gap-sm">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-lg py-sm font-mono-technical text-[11px] border transition-colors ${
                  tab === t.id
                    ? "border-primary text-primary bg-primary/10"
                    : "border-border-muted text-on-surface-variant hover:border-primary"
                }`}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowSubmit(!showSubmit)}
            className="flex items-center gap-sm px-lg py-sm bg-primary text-background font-mono-technical text-[11px] hover:bg-primary/90 transition-colors"
          >
            <Icon name={showSubmit ? "close" : "add"} size={14} />
            {showSubmit ? "CANCEL" : "SUBMIT EVIDENCE"}
          </button>
        </div>

        {/* Submit form */}
        {showSubmit && (
          <div className="mb-xl">
            <SubmitForm
              projectId={projectId}
              cases={cases}
              onClose={() => setShowSubmit(false)}
            />
          </div>
        )}

        {/* ALL tab */}
        {tab === "all" && (
          <div className="bg-surface border border-border-muted overflow-hidden">
            <div className="p-xl border-b border-border-muted">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
                EVIDENCE REGISTER — ALL ITEMS
              </h3>
            </div>
            {items.length === 0 ? (
              <div className="p-xl">
                <p className="font-mono-technical text-[11px] text-on-surface-variant">
                  No evidence items submitted yet.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border-muted">
                {items.map((item) => (
                  <EvidenceRow key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* BY CASE tab */}
        {tab === "by-case" && (
          <div className="space-y-lg">
            {byCaseMap.size === 0 ? (
              <p className="font-mono-technical text-[11px] text-on-surface-variant">No evidence items.</p>
            ) : (
              Array.from(byCaseMap.entries()).map(([key, group]) => (
                <div key={key} className="bg-surface border border-border-muted overflow-hidden">
                  <div className="p-xl border-b border-border-muted flex items-center justify-between">
                    <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
                      {group.caseTitle}
                    </h3>
                    <span className="font-mono-technical text-[10px] text-on-surface-variant">
                      {group.items.length} ITEM{group.items.length !== 1 ? "S" : ""}
                    </span>
                  </div>
                  <div className="divide-y divide-border-muted">
                    {group.items.map((item) => (
                      <EvidenceRow key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* BY FRAMEWORK tab */}
        {tab === "by-framework" && (
          <div className="space-y-lg">
            {byFrameworkMap.size === 0 ? (
              <p className="font-mono-technical text-[11px] text-on-surface-variant">No evidence items.</p>
            ) : (
              Array.from(byFrameworkMap.entries()).map(([fw, fwItems]) => (
                <div key={fw} className="bg-surface border border-border-muted overflow-hidden">
                  <div className="p-xl border-b border-border-muted flex items-center justify-between">
                    <span
                      className={`px-2 py-0.5 font-mono-technical text-[11px] border ${
                        fw === "UNMAPPED"
                          ? "border-tertiary/50 text-tertiary"
                          : (FRAMEWORK_CLS[fw as RegulatoryFramework] ?? "border-border-muted text-on-surface-variant")
                      }`}
                    >
                      {fw.replace("_", " ")}
                    </span>
                    <span className="font-mono-technical text-[10px] text-on-surface-variant">
                      {fwItems.length} ITEM{fwItems.length !== 1 ? "S" : ""}
                    </span>
                  </div>
                  <div className="divide-y divide-border-muted">
                    {fwItems.map((item) => (
                      <EvidenceRow key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* STALE tab */}
        {tab === "stale" && (
          <div className="bg-surface border border-border-muted overflow-hidden">
            <div className="p-xl border-b border-border-muted flex items-center gap-lg">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
                STALE EVIDENCE
              </h3>
              <span className="font-mono-technical text-[10px] text-tertiary">
                Submitted &gt;90 days ago · linked case still active
              </span>
            </div>
            {staleItems.length === 0 ? (
              <div className="p-xl">
                <p className="font-mono-technical text-[11px] text-on-surface-variant">
                  No stale evidence — all items are recent or unlinked to active cases.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border-muted">
                {staleItems.map((item) => (
                  <EvidenceRow key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
