import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
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
    default: "FormulaX - Engineering Mathematics Reference and Solver",
    template: "%s - FormulaX",
  },
  description:
    "A cloud-synced reference and interactive solver for engineering mathematics: searchable formula vault, multi-variable solver, function plotter, matrix calculator, lab regression coach and an exportable cheat sheet.",
  applicationName: "FormulaX",
};

export const viewport: Viewport = {
  themeColor: "#0b0f19",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-surface-0 text-ink">
        {/* Sign-in and sign-up live on our own routes so the app keeps its own UI rather
            than Clerk's prebuilt, watermarked components. */}
        <ClerkProvider
          signInUrl="/login"
          signUpUrl="/register"
          afterSignOutUrl="/login"
          appearance={{ elements: { rootBox: "hidden" } }}
        >
          <ToastProvider>{children}</ToastProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
