import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getUserData } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { AddFormulaForm, DeleteFormulaButton } from "@/components/add-formula-form";
import { FormulaVault } from "@/components/formula-vault";
import { FormulaScanner } from "@/components/formula-scanner";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = { title: "Formula Vault" };

export default async function FormulasPage(props: PageProps<"/formulas">) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const params = await props.searchParams;
  const categoryParam =
    typeof params.category === "string" ? params.category : null;
  const queryParam = typeof params.query === "string" ? params.query : null;

  const data = await getUserData();
  const formulas = data?.allFormulas ?? [];
  const customSlugs = new Set((data?.customFormulas ?? []).map((f) => f.slug));

  return (
    <AppShell
      user={user}
      title="Formula Vault"
      subtitle="Browse, search and star engineering formulas"
      actions={<VaultExportLink />}
    >
      <div className="flex flex-col gap-6">
        <FormulaVault
          formulas={formulas}
          initialBookmarks={data?.bookmarks ?? []}
          initialCategory={categoryParam}
          initialQuery={queryParam}
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <AddFormulaForm />
          <FormulaScanner />
        </div>

        {customSlugs.size > 0 ? (
          <section className="fx-card p-5" aria-labelledby="custom-heading">
            <h2 id="custom-heading" className="text-sm font-semibold">
              Your custom formulas
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              These exist only in your account. Deleting one also removes its bookmark.
            </p>
            <ul className="mt-3 flex flex-col divide-y divide-line">
              {(data?.customFormulas ?? []).map((formula) => (
                <li key={formula.slug} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{formula.title}</p>
                    <p className="truncate font-mono text-xs text-ink-faint">
                      {formula.category} &middot; {formula.latex}
                    </p>
                  </div>
                  <DeleteFormulaButton slug={formula.slug} title={formula.title} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}

function VaultExportLink() {
  return (
    <a href="/cheatsheet" className="fx-btn fx-btn-secondary">
      Export cheat sheet
    </a>
  );
}
