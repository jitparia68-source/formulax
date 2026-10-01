import type { Metadata } from "next";

import { AuthShell } from "@/components/form-controls";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const params = await props.searchParams;
  // Only same-origin relative paths are accepted, so a crafted redirectUrl cannot bounce
  // a user to another site after authenticating.
  const raw = typeof params.redirectUrl === "string" ? params.redirectUrl : "";
  const callbackUrl = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to reach your synced formulas, bookmarks and lab runs."
      footer={
        <>
          No account yet?{" "}
          <a href="/register" className="font-medium text-accent-bright underline decoration-accent/40 underline-offset-4 transition hover:decoration-accent">
            Create one
          </a>
        </>
      }
    >
      <LoginForm callbackUrl={callbackUrl} />
    </AuthShell>
  );
}
