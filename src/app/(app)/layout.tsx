import SideNav from "@/components/governance/SideNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SideNav />
      <main className="ml-[240px] flex-1 flex flex-col h-screen bg-background overflow-hidden">
        {children}
      </main>
    </>
  );
}
