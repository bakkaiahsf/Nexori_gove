"use client";

import { useState } from "react";
import Link from "next/link";

type Project = {
  id: string;
  key: string;
  name: string;
  status: string;
  ownerEmail: string;
  governanceProfile: string;
  program: { name: string } | null;
  boards: { id: string; boardId: string; boardName: string; connector: { type: string; name: string } }[];
  activeCases: number;
};

const TYPE_ICON: Record<string, string> = { github: "GH", gitlab: "GL", jira: "JI" };

const PROFILE_LABEL: Record<string, string> = {
  agile: "AGILE",
  regulated: "REGULATED",
  ai_sensitive: "AI-SENSITIVE",
  critical: "CRITICAL",
  third_party: "THIRD PARTY",
  custom: "CUSTOM",
};

function ProjectCard({
  project,
  onArchived,
}: {
  project: Project;
  onArchived: (id: string) => void;
}) {
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);

  async function handleArchive() {
    setArchiving(true);
    const res = await fetch(`/api/admin/projects/${project.id}`, { method: "DELETE" });
    if (res.ok) {
      onArchived(project.id);
    } else {
      setArchiving(false);
      setConfirmArchive(false);
    }
  }

  return (
    <div className="border border-border-muted bg-surface hover:border-primary/50 transition-colors p-lg space-y-md group">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-sm flex-wrap">
            <span className="font-mono-technical text-[10px] text-primary">{project.key}</span>
            <span
              className={`px-1.5 py-0.5 font-mono-technical text-[8px] border ${
                project.status === "active"
                  ? "border-primary text-primary"
                  : "border-border-muted text-on-surface-variant"
              }`}
            >
              {project.status.toUpperCase()}
            </span>
            <span className="px-1.5 py-0.5 font-mono-technical text-[8px] border border-border-muted text-on-surface-variant">
              {PROFILE_LABEL[project.governanceProfile] ?? project.governanceProfile.toUpperCase()}
            </span>
          </div>
          <Link
            href={`/projects/${project.id}`}
            className="block font-body-bold text-body-bold text-on-surface mt-xs hover:text-primary transition-colors truncate"
          >
            {project.name}
          </Link>
          {project.program && (
            <p className="font-mono-technical text-[9px] text-on-surface-variant mt-xs">
              {project.program.name}
            </p>
          )}
          <p className="font-mono-technical text-[9px] text-on-surface-variant/60 mt-xs">
            {project.ownerEmail}
          </p>
        </div>
      </div>

      {/* Metrics row */}
      <div className="flex items-center gap-md pt-sm border-t border-border-muted">
        <div className="flex items-center gap-xs">
          <span className="font-mono-technical text-[14px] font-bold text-on-surface">
            {project.activeCases}
          </span>
          <span className="font-mono-technical text-[9px] text-on-surface-variant">ACTIVE ITEMS</span>
        </div>
        <div className="flex-1" />
        <div className="flex gap-xs">
          {project.boards.slice(0, 4).map((b) => (
            <span
              key={b.id}
              title={`${b.connector.name} — ${b.boardName || b.boardId}`}
              className="font-mono-technical text-[9px] border border-border-muted px-1.5 py-0.5 text-on-surface-variant"
            >
              {TYPE_ICON[b.connector.type] ?? b.connector.type.slice(0, 2).toUpperCase()}
            </span>
          ))}
          {project.boards.length === 0 && (
            <span className="font-mono-technical text-[9px] text-on-surface-variant border border-tertiary/40 text-tertiary px-1.5 py-0.5">
              NO SOURCES
            </span>
          )}
        </div>
      </div>

      {/* Action footer */}
      <div className="flex gap-xs pt-xs border-t border-border-muted">
        <Link
          href={`/projects/${project.id}`}
          className="flex-1 text-center py-xs font-mono-technical text-[10px] border border-primary text-primary hover:bg-primary/10 transition-colors"
        >
          PROJECT HUB
        </Link>
        <Link
          href={`/projects/${project.id}/settings`}
          className="flex-1 text-center py-xs font-mono-technical text-[10px] border border-border-muted text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
        >
          SETTINGS
        </Link>
        <Link
          href={`/cases?projectId=${project.id}`}
          className="flex-1 text-center py-xs font-mono-technical text-[10px] border border-border-muted text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
        >
          CASES
        </Link>
        {!confirmArchive ? (
          <button
            onClick={() => setConfirmArchive(true)}
            title="Archive project"
            className="px-md py-xs font-mono-technical text-[10px] border border-border-muted text-on-surface-variant hover:border-critical hover:text-critical transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13, lineHeight: 1 }}>archive</span>
          </button>
        ) : (
          <div className="flex items-center gap-xs">
            <button
              onClick={() => void handleArchive()}
              disabled={archiving}
              className="px-sm py-xs font-mono-technical text-[9px] border border-critical text-critical hover:bg-critical/10 disabled:opacity-40 transition-colors"
            >
              {archiving ? "…" : "CONFIRM"}
            </button>
            <button
              onClick={() => setConfirmArchive(false)}
              className="px-sm py-xs font-mono-technical text-[9px] border border-border-muted text-on-surface-variant hover:text-on-surface transition-colors"
            >
              CANCEL
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProjectsGridClient({ projects }: { projects: Project[] }) {
  const [list, setList] = useState(projects);

  function handleArchived(id: string) {
    setList((prev) => prev.filter((p) => p.id !== id));
  }

  if (list.length === 0) {
    return (
      <div className="border border-border-muted p-2xl text-center space-y-lg max-w-[520px] mx-auto mt-2xl">
        <div className="w-16 h-16 bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 32 }}>
            folder_special
          </span>
        </div>
        <p className="font-body-bold text-body-bold text-on-surface text-[15px]">No projects yet</p>
        <p className="font-mono-technical text-[11px] text-on-surface-variant">
          Connect your first project in one guided flow.
        </p>
        <Link
          href="/projects/start"
          className="inline-block px-xl py-md bg-primary text-on-primary font-mono-technical text-[11px] hover:brightness-110 transition-all tracking-widest"
        >
          START OR LINK PROJECT →
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-lg">
      {list.map((p) => (
        <ProjectCard key={p.id} project={p} onArchived={handleArchived} />
      ))}
    </div>
  );
}
