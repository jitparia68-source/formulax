import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";

import { ToastProvider } from "@/components/toast-provider";

import "./globals.css";

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
  // The page canvas is the light --bg; only the rail and the auth stage are dark.
  themeColor: "#f3f6fb",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
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
