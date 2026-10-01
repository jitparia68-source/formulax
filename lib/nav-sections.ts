export type NavSection = {
  href: string;
  label: string;
  icon: string;
};

/**
 * Navigation metadata only. Kept free of any server-only import so the sidebar can be
 * rendered from a client component without pulling the auth and Supabase modules into
 * the browser bundle.
 */
export const NAV_SECTIONS: readonly NavSection[] = [
  { href: "/dashboard", label: "Dashboard", icon: "grid" },
  { href: "/formulas", label: "Formula Vault", icon: "book" },
  { href: "/solver", label: "Interactive Solver", icon: "sigma" },
  { href: "/plotter", label: "Function Plotter", icon: "chart" },
  { href: "/matrix", label: "Matrix Calculator", icon: "matrix" },
  { href: "/derivative", label: "Derivative Solver", icon: "function" },
  { href: "/cheatsheet", label: "My Cheat Sheet", icon: "star" },
  { href: "/labcoach", label: "Lab Coach", icon: "flask" },
  { href: "/practice", label: "Formula Practice", icon: "target" },
] as const;
