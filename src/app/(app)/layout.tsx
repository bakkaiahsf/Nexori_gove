import SideNav from "@/components/governance/SideNav";
import ProjectContextBar from "@/components/governance/ProjectContextBar";
import { Suspense } from "react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SideNav />
      <main className="ml-[240px] flex-1 flex flex-col h-screen bg-background overflow-hidden">
        <div className="h-9 px-xl flex items-center justify-between border-b border-border-muted bg-surface-container-low shrink-0">
          <Suspense fallback={null}>
            <ProjectContextBar />
          </Suspense>
          <span className="font-mono-technical text-[9px] text-on-surface-variant/40 tracking-widest">
            NEXORI · DELIVERY CONFIDENCE PLATFORM
          </span>
        </div>
        {children}
      </main>
    </>
  );
}
