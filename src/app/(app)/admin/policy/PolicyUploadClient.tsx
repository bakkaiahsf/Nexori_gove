"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface PolicyDoc {
  id: string;
  title: string;
  type: string;
  version: string | null;
  uploadedBy: string;
  uploadedAt: string;
  indexedAt: string | null;
  _count: { chunks: number };
}

const DOC_TYPES = [
  { value: "internal-policy",       label: "Internal Policy" },
  { value: "sop",                   label: "Standard Operating Procedure" },
  { value: "risk-appetite",         label: "Risk Appetite Statement" },
  { value: "regulatory-guidance",   label: "Regulatory Guidance" },
];

const TYPE_BADGE: Record<string, string> = {
  "internal-policy":      "text-primary border-primary bg-primary/10",
  "sop":                  "text-tertiary border-tertiary bg-tertiary/10",
  "risk-appetite":        "text-critical border-critical bg-critical/10",
  "regulatory-guidance":  "text-on-surface-variant border-border-muted",
};

function Icon({ name, size = 16, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <span className={`material-symbols-outlined select-none leading-none ${className}`} style={{ fontSize: size }}>
      {name}
    </span>
  );
}

export default function PolicyUploadClient({ documents }: { documents: PolicyDoc[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("internal-policy");
  const [version, setVersion] = useState("");
  const [content, setContent] = useState("");
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    readFile(file);
  }

  function readFile(file: File) {
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
    const reader = new FileReader();
    reader.onload = (e) => setContent((e.target?.result as string) ?? "");
    reader.readAsText(file);
  }

  async function submit() {
    if (!title.trim() || !content.trim() || state === "saving") return;
    setState("saving");
    setErrorMsg("");

    try {
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          type: docType,
          content: content.trim(),
          version: version.trim() || undefined,
          uploadedBy: "admin@nexori.system",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setErrorMsg(typeof err.error === "string" ? err.error : "Upload failed");
        setState("error");
        return;
      }

      setState("done");
      setTitle(""); setContent(""); setVersion(""); setDocType("internal-policy");
      router.refresh();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Network error");
      setState("error");
    } finally {
      if (state !== "done") setState("idle");
      else setTimeout(() => setState("idle"), 2000);
    }
  }

  return (
    <>
      <header className="h-16 px-xl flex items-center justify-between border-b border-border-muted bg-surface z-40 sticky top-0 shrink-0">
        <div className="flex items-center gap-xl">
          <h1 className="font-headline-md text-headline-md text-on-surface">Policy Corpus</h1>
          <span className="font-body-base text-body-base text-on-surface-variant">
            {documents.length} documents · RAG-indexed
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-xl">
        <div className="max-w-[1000px] mx-auto space-y-xl">

          {/* Upload form */}
          <div className="bg-surface border border-border-muted">
            <div className="px-xl py-lg border-b border-border-muted">
              <h2 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
                UPLOAD POLICY DOCUMENT
              </h2>
              <p className="font-mono-technical text-[10px] text-on-surface-variant mt-xs">
                Documents are chunked (512 tokens) and indexed for hybrid RAG retrieval in governance queries.
              </p>
            </div>

            <div className="p-xl space-y-lg">
              <div className="grid grid-cols-2 gap-lg">
                <div>
                  <label className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest block mb-xs">TITLE *</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. AI Governance Policy v2.1"
                    className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-body-base text-body-base text-on-surface outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest block mb-xs">VERSION</label>
                  <input
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder="e.g. 2.1.0"
                    className="w-full bg-surface-container-low border border-border-muted px-md py-sm font-body-base text-body-base text-on-surface outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest block mb-xs">DOCUMENT TYPE *</label>
                <div className="flex gap-xs flex-wrap">
                  {DOC_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setDocType(t.value)}
                      className={`px-md py-xs border font-mono-technical text-[10px] transition-colors ${
                        docType === t.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border-muted text-on-surface-variant hover:border-primary/50"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Drop zone */}
              <div>
                <label className="font-mono-technical text-[10px] text-on-surface-variant tracking-widest block mb-xs">
                  DOCUMENT CONTENT * &nbsp;
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-primary hover:underline font-mono-technical text-[10px]"
                  >
                    UPLOAD FILE (.txt, .md)
                  </button>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.text"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); }}
                />
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className={`relative border-2 border-dashed transition-colors ${
                    dragging ? "border-primary bg-primary/5" : "border-border-muted hover:border-primary/40"
                  }`}
                >
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Paste policy document content here, or drag and drop a .txt / .md file…"
                    rows={10}
                    className="w-full bg-transparent p-md font-mono-technical text-[11px] text-on-surface resize-y outline-none"
                  />
                  {dragging && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <p className="font-mono-technical text-[12px] text-primary">DROP FILE HERE</p>
                    </div>
                  )}
                </div>
                {content && (
                  <p className="font-mono-technical text-[9px] text-on-surface-variant mt-xs">
                    {content.length.toLocaleString()} chars · ~{Math.ceil(content.length / 2000)} chunk{content.length > 2000 ? "s" : ""} estimated
                  </p>
                )}
              </div>

              {errorMsg && <p className="font-mono-technical text-[11px] text-critical">{errorMsg}</p>}

              <button
                onClick={() => void submit()}
                disabled={!title.trim() || !content.trim() || state === "saving"}
                className="flex items-center gap-sm px-xl py-md bg-primary text-background font-mono-technical text-[11px] hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {state === "saving" ? (
                  <><span className="w-3 h-3 border border-background/40 border-t-background rounded-full animate-spin" /> UPLOADING & INDEXING…</>
                ) : state === "done" ? (
                  <><Icon name="check_circle" size={14} className="text-background" /> INDEXED ✓</>
                ) : (
                  <><Icon name="upload_file" size={14} className="text-background" /> UPLOAD & INDEX</>
                )}
              </button>
            </div>
          </div>

          {/* Document library */}
          <div className="bg-surface border border-border-muted">
            <div className="px-xl py-lg border-b border-border-muted">
              <h2 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
                POLICY LIBRARY — {documents.length} DOCUMENTS
              </h2>
            </div>
            {documents.length === 0 ? (
              <div className="p-xl text-center">
                <Icon name="description" size={32} className="text-on-surface-variant mb-md" />
                <p className="font-body-base text-body-base text-on-surface-variant">No policy documents indexed yet.</p>
                <p className="font-mono-technical text-[10px] text-on-surface-variant mt-xs">
                  Upload documents above to power the governance intelligence RAG queries.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border-muted">
                {documents.map((doc) => (
                  <div key={doc.id} className="px-xl py-lg flex items-start gap-lg">
                    <div className="w-8 h-8 bg-primary/10 border border-primary flex items-center justify-center shrink-0">
                      <Icon name="description" size={14} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-sm flex-wrap mb-xs">
                        <span className="font-body-bold text-body-bold text-on-surface text-[13px]">{doc.title}</span>
                        <span className={`px-1.5 py-0.5 font-mono-technical text-[9px] border ${TYPE_BADGE[doc.type] ?? TYPE_BADGE["regulatory-guidance"]}`}>
                          {doc.type.replace(/-/g, " ").toUpperCase()}
                        </span>
                        {doc.version && (
                          <span className="font-mono-technical text-[9px] text-on-surface-variant border border-border-muted px-1.5 py-0.5">
                            v{doc.version}
                          </span>
                        )}
                      </div>
                      <p className="font-mono-technical text-[10px] text-on-surface-variant">
                        Uploaded {new Date(doc.uploadedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} by {doc.uploadedBy}
                      </p>
                    </div>
                    <div className="text-right shrink-0 space-y-xs">
                      {doc.indexedAt ? (
                        <span className="flex items-center gap-xs font-mono-technical text-[10px] text-primary">
                          <Icon name="hub" size={11} className="text-primary" />
                          {doc._count.chunks} CHUNKS INDEXED
                        </span>
                      ) : (
                        <span className="font-mono-technical text-[10px] text-on-surface-variant">NOT YET INDEXED</span>
                      )}
                      <p className="font-mono-technical text-[9px] text-on-surface-variant">{doc.id.slice(-8).toUpperCase()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="h-8 bg-surface-container-low border-t border-border-muted flex items-center px-xl font-mono-technical text-[10px] text-on-surface-variant shrink-0">
        <span>POLICY CORPUS: {documents.length} DOCS · {documents.reduce((s, d) => s + d._count.chunks, 0)} CHUNKS · RAG ENGINE: READY</span>
      </footer>
    </>
  );
}
