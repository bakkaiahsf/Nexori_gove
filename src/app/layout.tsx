import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SideNav from "@/components/governance/SideNav";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "NexoriOS — Enterprise Governance Operating Platform",
  description: "Mission Control for Governed Enterprise Operations.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="bg-background text-on-surface min-h-screen overflow-hidden flex">
        <SideNav />
        <main className="ml-[240px] flex-1 flex flex-col h-screen bg-background overflow-hidden">
          {children}
        </main>
      </body>
    </html>
  );
}
