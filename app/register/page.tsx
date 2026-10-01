import type { Metadata } from "next";

import { AuthShell } from "@/components/form-controls";
import { RegisterForm } from "@/components/register-form";
import { registerAction } from "@/lib/auth-actions";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage(props: PageProps<"/register">) {
  const params = await props.searchParams;
  const callbackUrl =
    typeof params.callbackUrl === "string" ? params.callbackUrl : "/dashboard";

  return (
    <AuthShell
      title="Create your account"
      subtitle="Your formulas, bookmarks and lab notebook sync to your account."
      footer={
        <>
          Already registered?{" "}
          <a href="/login" className="text-accent hover:text-accent-hover">
            Sign in
          </a>
        </>
      }
    >
      <RegisterForm action={registerAction} callbackUrl={callbackUrl} />
    </AuthShell>
  );
}
