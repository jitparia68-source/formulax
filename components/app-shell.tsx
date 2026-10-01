"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { NAV_SECTIONS } from "@/lib/nav-sections";
import { logoutAction } from "@/lib/auth-actions";

const ICON_PATHS: Record<string, string> = {
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  book: "M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2zM18 3v18",
  sigma: "M17 4H7l6 8-6 8h10",
  chart: "M4 20V4M4 20h16M8 16V9M12 16v-4M16 16V6",
  matrix: "M4 4h16v16H4zM4 10h16M4 15h16M10 4v16M15 4v16",
  function: "M5 19c2 0 2-14 4-14s2 14 4 14 2-6 4-6",
  star: "m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  flask: "M9 3h6M10 3v6L5 19a1 1 0 0 0 1 2h12a1 1 0 0 0 1-2l-5-10V3M7.5 15h9",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2",
  logout: "M15 17l5-5-5-5M20 12H9M12 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6",
};

function NavIcon({ name, filled }: { name: string; filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-4.5 shrink-0"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={ICON_PATHS[name] ?? ICON_PATHS.grid} />
    </svg>
  );
}

type Props = {
  user: { name: string; email: string };
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function AppShell({ user, title, subtitle, actions, children }: Props) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  // Route changes are client-side, so the browser does not reset focus. Moving it to the
  // main landmark keeps keyboard and screen-reader users oriented. The drawer is closed
  // by the nav links themselves rather than in an effect, which would re-render the whole
  // shell on every navigation.
  useEffect(() => {
    mainRef.current?.focus();
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  const initial = user.name.trim().charAt(0).toUpperCase() || "E";

  const nav = (
    <nav aria-label="Sections" className="flex flex-col gap-1">
      {NAV_SECTIONS.map((section) => {
        const isActive =
          pathname === section.href || pathname.startsWith(`${section.href}/`);
        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center gap-3 rounded-input px-3 py-2 text-sm transition ${
              isActive
                ? "bg-accent text-white"
                : "text-ink-muted hover:bg-surface-2 hover:text-ink"
            }`}
          >
            <NavIcon name={section.icon} filled={isActive} />
            <span className="truncate">{section.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const identity = (
    <div className="flex items-center gap-3 rounded-card border border-line bg-surface-2 p-3">
      <div
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white"
      >
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{user.name}</p>
        <p className="truncate text-xs text-ink-faint">{user.email}</p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:rounded-input focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-5 border-r border-line bg-surface-1 p-4 lg:flex">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-1">
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-input bg-accent font-mono text-sm font-bold text-white"
          >
            &int;
          </span>
          <span className="text-base font-semibold tracking-tight">FormulaX</span>
        </Link>
        {identity}
        {nav}
        <form action={logoutAction} className="mt-auto">
          <button type="submit" className="fx-btn fx-btn-ghost w-full justify-start">
            <NavIcon name="logout" filled={false} />
            Sign out
          </button>
        </form>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm"
          />
          <aside
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-5 border-r border-line bg-surface-1 p-4"
          >
            <div className="flex items-center justify-between">
              <Link href="/dashboard" className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="flex size-8 items-center justify-center rounded-input bg-accent font-mono text-sm font-bold text-white"
                >
                  &int;
                </span>
                <span className="text-base font-semibold tracking-tight">FormulaX</span>
              </Link>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation"
                className="fx-btn fx-btn-ghost px-2"
              >
                <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            {identity}
            {nav}
            <form action={logoutAction} className="mt-auto">
              <button
                type="submit"
                className="fx-btn fx-btn-ghost w-full justify-start"
              >
                <NavIcon name="logout" filled={false} />
                Sign out
              </button>
            </form>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-surface-0/85 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-4 sm:px-6">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
              aria-expanded={drawerOpen}
              className="fx-btn fx-btn-ghost px-2 lg:hidden"
            >
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
                {title}
              </h1>
              <p className="truncate text-sm text-ink-muted">{subtitle}</p>
            </div>
            {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
          </div>
        </header>

        <main
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
          className="flex-1 px-4 py-6 outline-none sm:px-6"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
