import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getUserData } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { CheatSheet } from "@/components/cheat-sheet";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = { title: "My Cheat Sheet" };

export default async function CheatSheetPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const data = await getUserData();
  const bookmarked = new Set(data?.bookmarks ?? []);

  return (
    <AppShell
      user={user}
      title="My Cheat Sheet"
      subtitle="Your starred formulas, ready to print or export"
    >
      <CheatSheet
        formulas={(data?.allFormulas ?? []).filter((formula) =>
          bookmarked.has(formula.slug),
        )}
        initialBookmarks={data?.bookmarks ?? []}
      />
    </AppShell>
  );
}
