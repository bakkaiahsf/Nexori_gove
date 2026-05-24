"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

type SearchResult = {
  cases: Array<{ id: string; title: string; phase: string; status: string }>;
  events: Array<{ id: string; type: string; actorEmail: string; timestamp: string }>;
  risks: Array<{ id: string; title: string; severity: string; status: string }>;
  evidence: Array<{ id: string; title: string; type: string }>;
};

const SEVERITY_CLS: Record<string, string> = {
  CRITICAL: "text-critical",
  HIGH: "text-tertiary",
  MEDIUM: "text-on-surface",
  LOW: "text-on-surface-variant",
};

export default function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleChange(q: string) {
    setQuery(q);
    if (timer.current) clearTimeout(timer.current);
    if (q.length < 2) {
      setResults(null);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
          setOpen(true);
        }
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  const hasResults =
    results &&
    results.cases.length + results.events.length + results.risks.length + results.evidence.length >
      0;

  return (
    <div ref={ref} className="relative">
      <div className="relative flex items-center">
        <span
          className="material-symbols-outlined absolute left-3 text-on-surface-variant select-none"
          style={{ fontSize: 16, fontVariationSettings: "'FILL' 0" }}
        >
          search
        </span>
        <input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results && setOpen(true)}
          className="bg-surface-container-low border border-border-muted text-on-surface text-body-base px-10 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary min-w-[320px] rounded-none placeholder:text-on-surface-variant font-mono-technical text-[13px]"
          placeholder="Search cases, risks, evidence..."
          type="text"
        />
        {loading && (
          <span
            className="material-symbols-outlined absolute right-3 text-on-surface-variant animate-spin select-none"
            style={{ fontSize: 14 }}
          >
            progress_activity
          </span>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[400px] bg-surface border border-border-muted z-50 shadow-lg max-h-[480px] overflow-y-auto">
          {!hasResults ? (
            <p className="p-md font-mono-technical text-[11px] text-on-surface-variant">
              No results for &quot;{query}&quot;
            </p>
          ) : (
            <>
              {results!.cases.length > 0 && (
                <div>
                  <div className="px-md py-xs border-b border-border-muted bg-surface-container-low">
                    <span className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">
                      CASES
                    </span>
                  </div>
                  {results!.cases.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        router.push("/cases");
                        setOpen(false);
                        setQuery("");
                      }}
                      className="w-full text-left px-md py-sm hover:bg-surface-container-highest transition-colors flex items-center justify-between gap-md border-b border-border-muted"
                    >
                      <span className="font-body-base text-body-base text-on-surface truncate">
                        {c.title}
                      </span>
                      <span className="font-mono-technical text-[10px] text-on-surface-variant shrink-0">
                        {c.phase.replace("-", " ").toUpperCase()}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {results!.risks.length > 0 && (
                <div>
                  <div className="px-md py-xs border-b border-border-muted bg-surface-container-low">
                    <span className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">
                      RISKS
                    </span>
                  </div>
                  {results!.risks.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setOpen(false);
                        setQuery("");
                      }}
                      className="w-full text-left px-md py-sm hover:bg-surface-container-highest transition-colors flex items-center justify-between gap-md border-b border-border-muted"
                    >
                      <span className="font-body-base text-body-base text-on-surface truncate">
                        {r.title}
                      </span>
                      <span
                        className={`font-mono-technical text-[10px] shrink-0 ${SEVERITY_CLS[r.severity] ?? ""}`}
                      >
                        {r.severity}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {results!.evidence.length > 0 && (
                <div>
                  <div className="px-md py-xs border-b border-border-muted bg-surface-container-low">
                    <span className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">
                      EVIDENCE
                    </span>
                  </div>
                  {results!.evidence.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => {
                        router.push("/evidence");
                        setOpen(false);
                        setQuery("");
                      }}
                      className="w-full text-left px-md py-sm hover:bg-surface-container-highest transition-colors flex items-center justify-between gap-md border-b border-border-muted"
                    >
                      <span className="font-body-base text-body-base text-on-surface truncate">
                        {e.title}
                      </span>
                      <span className="font-mono-technical text-[10px] text-on-surface-variant shrink-0">
                        {e.type.replace("_", " ")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
