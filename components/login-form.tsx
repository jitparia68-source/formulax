"use client";

import { useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FieldError, Spinner } from "@/components/form-controls";

type Props = {
  callbackUrl: string;
};

/**
 * Decorate and navigate in one place: Clerk hands back a decorated URL that may be
 * absolute (a full page load is required for it, for Safari ITP cookie refresh), so a
 * decorated absolute URL is sent to `window.location` rather than the router.
 */
function navigateTo(router: ReturnType<typeof useRouter>, callbackUrl: string) {
  const target = callbackUrl;
  if (/^https?:\/\//i.test(target)) {
    window.location.href = target;
    return;
  }
  router.push(target);
  router.refresh();
}

export function LoginForm({ callbackUrl }: Props) {
  const { signIn, errors, fetchStatus } = useSignIn();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [needsSecondFactor, setNeedsSecondFactor] = useState(false);

  const submitting = fetchStatus === "fetching";

  if (!signIn) {
    return (
      <p className="flex items-center justify-center gap-2 py-8 text-sm text-ink-muted">
        <Spinner /> Loading sign in...
      </p>
    );
  }

  const fieldError =
    errors?.fields?.identifier?.message ?? errors?.fields?.password?.message;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const emailAddress = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!emailAddress || !password) {
      setError("Enter your email and password.");
      return;
    }

    const { error: signInError } = await signIn.password({ emailAddress, password });

    if (signInError) {
      setError(signInError.message);
      return;
    }

    if (signIn.status === "needs_second_factor") {
      setNeedsSecondFactor(true);
      return;
    }

    if (signIn.status !== "complete") {
      setError("Sign in did not complete. Please try again.");
      return;
    }

    const { error: finalizeError } = await signIn.finalize({
      navigate: ({ decorateUrl }) => navigateTo(router, decorateUrl(callbackUrl)),
    });

    if (finalizeError) {
      setError(finalizeError.message);
    }
  }

  if (needsSecondFactor) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">
          This account requires a second authentication factor, which this form does not
          support. Sign in with a factor-enabled client, or ask an administrator to
          remove the requirement.
        </p>
        <button
          type="button"
          onClick={() => setNeedsSecondFactor(false)}
          className="fx-btn fx-btn-secondary self-start"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div>
        <label htmlFor="email" className="fx-label">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@university.edu"
          aria-invalid={fieldError || error ? true : undefined}
          className="fx-input"
        />
      </div>

      <div>
        <label htmlFor="password" className="fx-label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="Your password"
          aria-invalid={fieldError || error ? true : undefined}
          className="fx-input"
        />
      </div>

      {fieldError ? <FieldError>{fieldError}</FieldError> : null}
      {!fieldError && error ? <FieldError>{error}</FieldError> : null}

      <button type="submit" disabled={submitting} className="fx-btn fx-btn-primary">
        {submitting ? (
          <>
            <Spinner /> Signing in...
          </>
        ) : (
          "Sign in"
        )}
      </button>
    </form>
  );
}
