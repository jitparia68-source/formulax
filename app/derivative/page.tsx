import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { DerivativeCalculator } from "@/components/derivative-calculator";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = { title: "Derivative Solver" };

export default async function DerivativePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <AppShell
      user={user}
      title="Derivative Solver"
      subtitle="Symbolic differentiation of a polynomial"
    >
      <DerivativeCalculator />
    </AppShell>
  );
}
