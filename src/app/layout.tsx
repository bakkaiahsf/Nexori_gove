import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NexoriOS — Governance Operating Platform",
  description:
    "One control room for approvals, evidence, delivery risk, and AI oversight across change delivery.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
