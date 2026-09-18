import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "CDN_SS — Server-Sided Executor by CDNWARE",
  description:
    "CDN_SS is a professional Roblox server-sided executor with live server lists, saved scripts, and a hardened control panel.",
  icons: { icon: "https://i.imgur.com/4KNDb3R.png" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-cdn-bg text-zinc-200 antialiased selection:bg-[#ff2d2d]/30">
        {children}
      </body>
    </html>
  );
}
