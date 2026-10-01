import type { Metadata } from "next";

import { getUserData } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { getSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const data = await getUserData();
  const bookmarks = new Set(data?.bookmarks ?? []);

  const stats = [
    { label: "Formulas in vault", value: data?.totalFormulas ?? 0, href: "/formulas" },
    { label: "Saved bookmarks", value: bookmarks.size, href: "/cheatsheet" },
    { label: "Custom formulas", value: data?.customFormulas.length ?? 0, href: "/formulas" },
    { label: "Lab runs saved", value: data?.labRuns.length ?? 0, href: "/labcoach" },
  ] as const;

  const recentRuns = (data?.labRuns ?? []).slice(0, 4);

  return (
    <AppShell
      user={user}
      title={`Welcome, ${user.name.split(" ")[0]}`}
      subtitle="Your engineering mathematics workspace"
    >
      <div className="flex flex-col gap-6">
        <section aria-labelledby="stats-heading">
          <h2 id="stats-heading" className="sr-only">
            Workspace summary
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map((stat) => (
              <a key={stat.label} href={stat.href} className="fx-stat">
                <p className="fx-eyebrow">{stat.label}</p>
                <p className="fx-value mt-2 text-3xl text-ink">{stat.value}</p>
              </a>
            ))}
          </div>
        </section>

        <section className="fx-card p-5" aria-labelledby="topics-heading">
          <h2 id="topics-heading" className="text-sm font-semibold">
            Jump to a topic
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Open the vault pre-filtered to a subject area.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { label: "Calculus", hint: "Derivatives and roots" },
              { label: "Linear Algebra", hint: "Determinants" },
              { label: "Electrical", hint: "Ohm, power, resonance" },
              { label: "Physics", hint: "Forces and energy" },
              { label: "Thermodynamics", hint: "Gas and heat" },
            ].map((topic) => (
              <a
                key={topic.label}
                href={`/formulas?category=${encodeURIComponent(topic.label)}`}
                title={topic.hint}
                className="fx-chip"
              >
                {topic.label}
              </a>
            ))}
          </div>
        </section>

        <section className="fx-card p-5" aria-labelledby="recent-heading">
          <div className="flex items-center justify-between gap-3">
            <h2 id="recent-heading" className="text-sm font-semibold">
              Recent lab runs
            </h2>
            <a
              href="/labcoach"
              className="text-xs font-medium text-accent-bright underline decoration-accent/40 underline-offset-4 transition hover:decoration-accent"
            >
              Open lab coach
            </a>
          </div>

          {recentRuns.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">
              No runs yet. Fit a least-squares line to your experiment data and save it to
              build a history here.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-line">
              {recentRuns.map((run) => (
                <li key={run.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
                  <span className="text-sm text-ink">{run.title}</span>
                  <span className="font-mono text-xs text-ink-muted">
                    slope {run.slope.toFixed(3)} &middot; R&sup2; {run.r_squared.toFixed(4)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
