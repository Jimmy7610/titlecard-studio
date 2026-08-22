import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Display faces are deliberately not declared here.
 *
 * `next/font` resolves families at build time, and this app lets the user pick
 * one — and upload their own — at runtime. `lib/fonts.ts` loads the chosen
 * family on demand instead, which is also why the editor waits on
 * `document.fonts` before building a timeline: every mask height in this app is
 * derived from the real font's metrics.
 */
export const metadata: Metadata = {
  title: "Motion Typography Studio",
  description:
    "A motion typography studio — bounded, mask-based text animation with GSAP, canvas formats, presets, and HTML, React, GSAP, video and PNG export.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        {children}
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
