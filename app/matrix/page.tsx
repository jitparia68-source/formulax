import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { MatrixCalculator } from "@/components/matrix-calculator";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = { title: "Matrix Calculator" };

export default async function MatrixPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <AppShell
      user={user}
      title="Matrix Calculator"
      subtitle="Determinant of a 3x3 matrix, expanded step by step"
    >
      <MatrixCalculator />
    </AppShell>
  );
}
