import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getUserData } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { MultiVariableSolver } from "@/components/multi-variable-solver";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = { title: "Interactive Solver" };

export default async function SolverPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const data = await getUserData();

  return (
    <AppShell
      user={user}
      title="Interactive Solver"
      subtitle="Solve engineering equations for any unknown quantity"
    >
      <MultiVariableSolver formulas={data?.allFormulas ?? []} />
    </AppShell>
  );
}
