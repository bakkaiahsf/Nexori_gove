import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "NexoriOS — Governance Operating Platform",
  description:
    "One control room for approvals, evidence, delivery risk, and AI oversight across change delivery.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-background-light text-slate-900 min-h-screen overflow-hidden">
        {children}
      </body>
    </html>
  );
}
