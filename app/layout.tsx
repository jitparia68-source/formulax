import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ToastProvider } from "@/components/toast-provider";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "FormulaX - Engineering Math Reference and Solver",
    template: "%s - FormulaX",
  },
  description:
    "A cloud-synced reference and interactive solver for engineering mathematics: formula vault, multi-variable solver, function plotter, matrix calculator, lab regression coach and an exportable cheat sheet.",
  applicationName: "FormulaX",
};

export const viewport: Viewport = {
  themeColor: "#070b14",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-surface-0 text-ink">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
