"use client";

import { useState } from "react";

interface Project {
  id: string;
  key: string;
  name: string;
  status: string;
  programId?: string | null;
  domain?: string | null;
}

interface Program {
  id: string;
  name: string;
  description: string | null;
  ownerEmail: string | null;
  status: string;
  projects: Project[];
}

interface Props {
  programs: Program[];
  allProjects: Project[];
}

export default function ProgramsClient({ programs: initial, allProjects }: Props) {
  const [programs, setPrograms] = useState(initial);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", ownerEmail: "" });
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  async function createProgram() {
    if (!form.name.trim()) return;
    setCreating(true);
    const res = await fetch("/api/admin/programs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const p = await res.json();
      setPrograms((prev) => [...prev, { ...p, projects: [] }]);
      setForm({ name: "", description: "", ownerEmail: "" });
      setShowCreate(false);
    }
    setCreating(false);
  }

  async function saveAssignment(programId: string) {
    await fetch(`/api/admin/programs/${programId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectIds: selectedProjects }),
    });
    // Reload page data inline
    const res = await fetch("/api/admin/programs");
    if (res.ok) {
      const data = await res.json();
      setPrograms(data);
    }
    setAssigningId(null);
  }

  async function deleteProgram(id: string) {
    if (!confirm("Remove this program? Projects will be unassigned but not deleted.")) return;
    await fetch(`/api/admin/programs/${id}`, { method: "DELETE" });
    setPrograms((prev) => prev.filter((p) => p.id !== id));
  }

  const unassigned = allProjects.filter((p) => !p.programId);

  return (
    <>
      <header className="h-16 px-xl flex items-center justify-between border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <div className="flex items-center gap-xl">
          <h1 className="font-headline-md text-headline-md text-on-surface">Programs</h1>
          <span className="font-body-base text-body-base text-on-surface-variant text-[12px]">
            {programs.length} programs · {allProjects.length} projects
          </span>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-lg py-sm border border-primary text-primary font-mono-technical text-[11px] hover:bg-primary/10 transition-colors"
        >
          + NEW PROGRAM
        </button>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-xl">
        <div className="max-w-[900px] mx-auto space-y-lg">
          {showCreate && (
            <div className="bg-surface border border-primary p-lg space-y-md">
              <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest text-[10px]">
                NEW PROGRAM
              </p>
              <input
                className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-body-base text-body-base text-on-surface text-[13px] focus:outline-none focus:border-primary"
                placeholder="Program name *"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <input
                className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-body-base text-body-base text-on-surface text-[13px] focus:outline-none focus:border-primary"
                placeholder="Description (optional)"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
              <input
                className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-body-base text-body-base text-on-surface text-[13px] focus:outline-none focus:border-primary"
                placeholder="Owner email (optional)"
                type="email"
                value={form.ownerEmail}
                onChange={(e) => setForm((f) => ({ ...f, ownerEmail: e.target.value }))}
              />
              <div className="flex gap-md">
                <button
                  onClick={createProgram}
                  disabled={creating || !form.name.trim()}
                  className="px-lg py-sm bg-primary text-on-primary font-mono-technical text-[11px] disabled:opacity-50"
                >
                  {creating ? "CREATING..." : "CREATE"}
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-lg py-sm border border-border-muted text-on-surface-variant font-mono-technical text-[11px]"
                >
                  CANCEL
                </button>
              </div>
            </div>
          )}

          {programs.length === 0 && !showCreate && (
            <div className="bg-surface border border-border-muted p-xl text-center space-y-md">
              <p className="font-body-bold text-body-bold text-on-surface">No programs yet</p>
              <p className="font-mono-technical text-[11px] text-on-surface-variant">
                Create a program to group related projects together under a single governance
                portfolio view.
              </p>
            </div>
          )}

          {programs.map((program) => (
            <div key={program.id} className="bg-surface border border-border-muted">
              <div className="px-xl py-lg flex items-start justify-between border-b border-border-muted">
                <div className="space-y-xs">
                  <div className="flex items-center gap-md">
                    <span className="font-body-bold text-body-bold text-on-surface">
                      {program.name}
                    </span>
                    <span
                      className={`px-2 py-0.5 font-mono-technical text-[9px] border ${
                        program.status === "ACTIVE"
                          ? "text-primary border-primary bg-primary/10"
                          : "text-on-surface-variant border-border-muted"
                      }`}
                    >
                      {program.status}
                    </span>
                  </div>
                  {program.description && (
                    <p className="font-body-base text-body-base text-on-surface-variant text-[12px]">
                      {program.description}
                    </p>
                  )}
                  {program.ownerEmail && (
                    <p className="font-mono-technical text-[10px] text-on-surface-variant">
                      Owner: {program.ownerEmail}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-md shrink-0">
                  <button
                    onClick={() => {
                      setAssigningId(program.id);
                      setSelectedProjects(program.projects.map((p) => p.id));
                    }}
                    className="font-mono-technical text-[10px] text-primary hover:underline"
                  >
                    ASSIGN PROJECTS
                  </button>
                  <button
                    onClick={() => deleteProgram(program.id)}
                    className="font-mono-technical text-[10px] text-on-surface-variant hover:text-critical"
                  >
                    DELETE
                  </button>
                </div>
              </div>

              {assigningId === program.id ? (
                <div className="px-xl py-lg space-y-md">
                  <p className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest">
                    SELECT PROJECTS FOR THIS PROGRAM
                  </p>
                  <div className="grid grid-cols-2 gap-sm max-h-48 overflow-y-auto">
                    {allProjects.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-sm cursor-pointer py-xs hover:bg-surface-container-low px-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selectedProjects.includes(p.id)}
                          onChange={(e) =>
                            setSelectedProjects((prev) =>
                              e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id)
                            )
                          }
                          className="accent-primary"
                        />
                        <span className="font-body-base text-body-base text-on-surface text-[12px]">
                          {p.name}
                        </span>
                        <span className="font-mono-technical text-[10px] text-on-surface-variant">
                          ({p.key})
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-md">
                    <button
                      onClick={() => saveAssignment(program.id)}
                      className="px-lg py-sm bg-primary text-on-primary font-mono-technical text-[11px]"
                    >
                      SAVE
                    </button>
                    <button
                      onClick={() => setAssigningId(null)}
                      className="px-lg py-sm border border-border-muted text-on-surface-variant font-mono-technical text-[11px]"
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-xl py-lg">
                  {program.projects.length === 0 ? (
                    <p className="font-mono-technical text-[11px] text-on-surface-variant">
                      No projects assigned
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-sm">
                      {program.projects.map((p) => (
                        <span
                          key={p.id}
                          className="px-2 py-0.5 bg-surface-container-high border border-border-muted font-mono-technical text-[10px] text-on-surface"
                        >
                          {p.key} · {p.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {unassigned.length > 0 && (
            <div className="bg-surface border border-border-muted">
              <div className="px-xl py-lg border-b border-border-muted">
                <h3 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest text-[10px]">
                  UNASSIGNED PROJECTS ({unassigned.length})
                </h3>
              </div>
              <div className="px-xl py-lg flex flex-wrap gap-sm">
                {unassigned.map((p) => (
                  <span
                    key={p.id}
                    className="px-2 py-0.5 border border-border-muted font-mono-technical text-[10px] text-on-surface-variant"
                  >
                    {p.key}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="h-8 bg-surface-container-low border-t border-border-muted flex items-center px-xl font-mono-technical text-[10px] text-on-surface-variant shrink-0">
        <span>
          PROGRAMS: {programs.length} · PROJECTS_ASSIGNED:{" "}
          {allProjects.filter((p) => p.programId).length} · UNASSIGNED: {unassigned.length}
        </span>
      </footer>
    </>
  );
}
