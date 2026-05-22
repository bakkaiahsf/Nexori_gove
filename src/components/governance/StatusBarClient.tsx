"use client";

import { useState, useEffect } from "react";

export default function StatusBarClient({ version = "v0.1.0-MVP" }: { version?: string }) {
  const [time, setTime] = useState("");

  useEffect(() => {
    setTime(new Date().toISOString());
    const t = setInterval(() => setTime(new Date().toISOString()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <footer className="h-8 bg-surface-container-low border-t border-border-muted flex items-center justify-between px-xl font-mono-technical text-[10px] text-on-surface-variant shrink-0">
      <div className="flex items-center gap-xl">
        <div className="flex items-center gap-xs">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <span>SYSTEM_ACTIVE</span>
        </div>
        <div className="flex items-center gap-xs">
          <span className="material-symbols-outlined" style={{ fontSize: 10 }}>database</span>
          <span>DB_CLUSTER_READY: 0.002ms</span>
        </div>
        <div className="flex items-center gap-xs">
          <span className="material-symbols-outlined" style={{ fontSize: 10 }}>shield</span>
          <span>ENCRYPTION: AES-256-GCM</span>
        </div>
      </div>
      <div className="flex items-center gap-lg">
        <span suppressHydrationWarning>{time}</span>
        <span className="font-bold text-on-surface">{version}</span>
      </div>
    </footer>
  );
}
