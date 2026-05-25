"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface NexoriProject {
  id: string;
  name: string;
  key: string;
  programName?: string | null;
}

interface SourceProject {
  id: string;
  name: string;
  ref: string;
  connectorId: string;
  connectorName: string;
  connectorType: string;
}

interface AvailableProjects {
  nexoriProjects: NexoriProject[];
  sourceProjects: SourceProject[];
}

const CONNECTOR_BADGE: Record<string, string> = {
  jira: "JI",
  github: "GH",
  gitlab: "GL",
};

export default function ProjectContextBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [data, setData] = useState<AvailableProjects | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentProjectId = searchParams.get("projectId");

  useEffect(() => {
    fetch("/api/context/available-projects")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const currentProject = data?.nexoriProjects.find((p) => p.id === currentProjectId);
  const label = currentProject
    ? `${currentProject.key} — ${currentProject.name}`
    : currentProjectId
      ? "Loading…"
      : "All Projects";

  function selectNexoriProject(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("projectId", id);
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  function selectSourceProject(p: SourceProject) {
    const nexori = data?.nexoriProjects.find(
      (n) => n.key === p.ref || n.key === p.ref.split("/").pop()
    );
    if (nexori) {
      selectNexoriProject(nexori.id);
    } else {
      router.push(`/admin/projects/new?sourceRef=${encodeURIComponent(p.ref)}&connectorId=${p.connectorId}`);
      setOpen(false);
    }
  }

  function clearProject() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("projectId");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-sm px-md py-xs border border-border-muted text-on-surface-variant hover:border-primary hover:text-primary transition-colors font-mono-technical text-[10px] min-w-[180px]"
      >
        <span className="material-symbols-outlined select-none leading-none" style={{ fontSize: 13 }}>
          folder_special
        </span>
        <span className="flex-1 text-left truncate max-w-[180px]">{label}</span>
        <span className="material-symbols-outlined select-none leading-none" style={{ fontSize: 13 }}>
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 w-[320px] bg-surface border border-border-muted shadow-lg max-h-[420px] overflow-y-auto custom-scrollbar">
          {/* Clear selection */}
          {currentProjectId && (
            <button
              onClick={clearProject}
              className="w-full flex items-center gap-sm px-md py-sm text-on-surface-variant hover:bg-surface-container-highest transition-colors text-left border-b border-border-muted"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>close</span>
              <span className="font-mono-technical text-[10px]">CLEAR · ALL PROJECTS</span>
            </button>
          )}

          {!data && (
            <p className="font-mono-technical text-[10px] text-on-surface-variant px-md py-sm">
              Loading…
            </p>
          )}

          {data && data.nexoriProjects.length > 0 && (
            <div>
              <p className="px-md pt-sm pb-xs font-mono-technical text-[9px] text-on-surface-variant/50 tracking-widest">
                NEXORI PROJECTS
              </p>
              {data.nexoriProjects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectNexoriProject(p.id)}
                  className={`w-full flex items-center gap-sm px-md py-sm text-left transition-colors ${
                    p.id === currentProjectId
                      ? "bg-secondary-container text-on-secondary-container"
                      : "text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
                  }`}
                >
                  <span className="font-mono-technical text-[9px] border border-primary text-primary px-1">
                    NX
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono-technical text-[10px] text-primary">{p.key}</p>
                    <p className="font-body-bold text-[11px] truncate">{p.name}</p>
                    {p.programName && (
                      <p className="font-mono-technical text-[9px] text-on-surface-variant/60 truncate">
                        {p.programName}
                      </p>
                    )}
                  </div>
                  {p.id === currentProjectId && (
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>
                      check
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {data && data.sourceProjects.length > 0 && (
            <div>
              <p className="px-md pt-sm pb-xs font-mono-technical text-[9px] text-on-surface-variant/50 tracking-widest border-t border-border-muted mt-xs">
                SOURCE TOOL PROJECTS
              </p>
              {data.sourceProjects.map((p) => (
                <button
                  key={`${p.connectorId}:${p.ref}`}
                  onClick={() => selectSourceProject(p)}
                  className="w-full flex items-center gap-sm px-md py-sm text-left text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-colors"
                >
                  <span className="font-mono-technical text-[9px] border border-border-muted px-1">
                    {CONNECTOR_BADGE[p.connectorType] ?? p.connectorType.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono-technical text-[10px]">{p.ref}</p>
                    <p className="font-body-bold text-[11px] truncate">{p.name}</p>
                    <p className="font-mono-technical text-[9px] text-on-surface-variant/60">
                      {p.connectorName}
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: 12 }}>
                    open_in_new
                  </span>
                </button>
              ))}
            </div>
          )}

          {data && data.nexoriProjects.length === 0 && data.sourceProjects.length === 0 && (
            <p className="font-mono-technical text-[10px] text-on-surface-variant px-md py-sm">
              No projects found. Configure connectors in Admin.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
