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
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <head>
        {/* Satoshi — Fontshare (display / stat numbers) */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=satoshi@700,600&display=swap"
        />
        {/* Geist Mono — monospaced technical data */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;700&display=swap"
        />
        {/* Material Symbols Outlined — icon font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className="bg-background text-on-surface min-h-screen overflow-hidden flex">
        <SideNav />
        <main className="ml-[240px] flex-1 flex flex-col h-screen bg-background overflow-hidden">
          {children}
        </main>
      </body>
    </html>
  );
}
