import type { Metadata } from "next";

import { AuthShell } from "@/components/form-controls";
import { LoginForm } from "@/components/login-form";
import { loginAction } from "@/lib/auth-actions";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const params = await props.searchParams;
  const authError = typeof params.error === "string" ? params.error : undefined;
  const callbackUrl =
    typeof params.callbackUrl === "string" ? params.callbackUrl : "/dashboard";

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to reach your synced formulas, bookmarks and lab runs."
      footer={
        <>
          No account yet?{" "}
          <a href="/register" className="text-accent hover:text-accent-hover">
            Create one
          </a>
        </>
      }
    >
      {authError ? (
        <p role="alert" className="fx-error mb-4">
          Sign in failed. Please check your credentials and try again.
        </p>
      ) : null}
      <LoginForm action={loginAction} callbackUrl={callbackUrl} />
    </AuthShell>
  );
}
