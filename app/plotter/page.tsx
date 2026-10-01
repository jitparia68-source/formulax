import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { FunctionPlotter } from "@/components/function-plotter";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = { title: "Function Plotter" };

export default async function PlotterPage(props: PageProps<"/plotter">) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const params = await props.searchParams;
  const expression =
    typeof params.expression === "string" && params.expression.trim().length > 0
      ? params.expression
      : null;

  return (
    <AppShell
      user={user}
      title="Function Plotter"
      subtitle="Graph a single-variable expression interactively"
    >
      <FunctionPlotter initialExpression={expression} />
    </AppShell>
  );
}
