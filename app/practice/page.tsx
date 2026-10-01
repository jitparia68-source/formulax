import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getUserData } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { PracticeQuiz } from "@/components/practice-quiz";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = { title: "Formula Practice" };

export default async function PracticePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const data = await getUserData();

  return (
    <AppShell
      user={user}
      title="Formula Practice"
      subtitle="Test recall and find the topics that need work"
    >
      <PracticeQuiz formulas={data?.allFormulas ?? []} />
    </AppShell>
  );
}
