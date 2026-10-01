import type { Metadata } from "next";

import { AuthShell } from "@/components/form-controls";
import { RegisterForm } from "@/components/register-form";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage(props: PageProps<"/register">) {
  const params = await props.searchParams;
  const raw = typeof params.redirectUrl === "string" ? params.redirectUrl : "";
  const callbackUrl = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";

  return (
    <AuthShell
      title="Create your account"
      subtitle="Your formulas, bookmarks and lab notebook sync to your account."
      footer={
        <>
          Already registered?{" "}
          <a href="/login" className="font-medium text-accent-bright underline decoration-accent/40 underline-offset-4 transition hover:decoration-accent">
            Sign in
          </a>
        </>
      }
    >
      <RegisterForm callbackUrl={callbackUrl} />
    </AuthShell>
  );
}
