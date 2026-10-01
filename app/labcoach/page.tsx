import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getUserData } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { LabCoach } from "@/components/lab-coach";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = { title: "Lab Coach" };

export default async function LabCoachPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const data = await getUserData();

  return (
    <AppShell
      user={user}
      title="Lab Coach"
      subtitle="Least-squares regression for your engineering experiments"
    >
      <LabCoach initialRuns={data?.labRuns ?? []} />
    </AppShell>
  );
}
