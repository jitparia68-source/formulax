"use client";

import { useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FieldError, Spinner } from "@/components/form-controls";

const MIN_PASSWORD_LENGTH = 8;

type Props = {
  callbackUrl: string;
};

function navigateTo(router: ReturnType<typeof useRouter>, callbackUrl: string) {
  if (/^https?:\/\//i.test(callbackUrl)) {
    window.location.href = callbackUrl;
    return;
  }
  router.push(callbackUrl);
  router.refresh();
}

export function RegisterForm({ callbackUrl }: Props) {
  const { signUp, errors, fetchStatus } = useSignUp();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Clerk reports an unverified email as `missing_requirements`; the code entry is shown
  // only then, so a normal sign-up never asks for a code.
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [code, setCode] = useState("");
  const [codeNotice, setCodeNotice] = useState<string | null>(null);

  const submitting = fetchStatus === "fetching";
  const tooShort =
    password.length > 0 && password.length < MIN_PASSWORD_LENGTH;

  if (!signUp) {
    return (
      <p className="flex items-center justify-center gap-2 py-8 text-sm text-ink-muted">
        <Spinner /> Loading sign up...
      </p>
    );
  }

  const fieldError =
    errors?.fields?.emailAddress?.message ?? errors?.fields?.password?.message;

  async function finalize() {
    const { error: finalizeError } = await signUp!.finalize({
      navigate: ({ decorateUrl }) =>
        navigateTo(router, decorateUrl(callbackUrl)),
    });

    if (finalizeError) {
      setError(finalizeError.message);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const emailAddress = String(formData.get("email") ?? "").trim();
    const providedPassword = String(formData.get("password") ?? "");

    if (!emailAddress) {
      setError("Enter your email address.");
      return;
    }
    if (providedPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    const { error: signUpError } = await signUp!.password({
      emailAddress,
      password: providedPassword,
    });

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (signUp!.status === "missing_requirements") {
      const { error: sendError } =
        await signUp!.verifications.sendEmailCode();
      if (sendError) {
        setError(sendError.message);
        return;
      }
      setAwaitingCode(true);
      setCodeNotice(`We sent a verification code to ${emailAddress}.`);
      return;
    }

    if (signUp!.status === "complete") {
      await finalize();
      return;
    }

    setError(
      `Sign up did not complete (status: ${signUp!.status}). Please try again.`,
    );
  }

  async function onVerifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const { error: verifyError } = await signUp!.verifications.verifyEmailCode({
      code: code.trim(),
    });

    if (verifyError) {
      setError(verifyError.message);
      return;
    }

    if (signUp!.status === "complete") {
      await finalize();
      return;
    }

    setError("That code was not accepted. Please try again.");
  }

  if (awaitingCode) {
    return (
      <form onSubmit={onVerifyCode} className="flex flex-col gap-4" noValidate>
        <p className="text-sm text-ink-muted">{codeNotice}</p>

        <div>
          <label htmlFor="code" className="fx-label">
            Verification code
          </label>
          <input
            id="code"
            name="code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            aria-invalid={error ? true : undefined}
            className="fx-input font-mono"
          />
        </div>

        {error ? <FieldError>{error}</FieldError> : null}

        <button type="submit" disabled={submitting} className="fx-btn fx-btn-primary">
          {submitting ? (
            <>
              <Spinner /> Verifying...
            </>
          ) : (
            "Verify email"
          )}
        </button>

        <div id="clerk-captcha" />

        <button
          type="button"
          onClick={() => void signUp!.verifications.sendEmailCode()}
          disabled={submitting}
          className="fx-btn fx-btn-ghost self-start"
        >
          Send a new code
        </button>
      </form>
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
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={tooShort || fieldError || error ? true : undefined}
          aria-describedby="password-hint"
          className={`fx-input ${tooShort ? "fx-input-invalid" : ""}`}
          placeholder="At least 8 characters"
        />
        <p
          id="password-hint"
          className={`mt-1.5 text-xs ${tooShort ? "text-danger" : "text-ink-faint"}`}
        >
          {tooShort
            ? `Use at least ${MIN_PASSWORD_LENGTH} characters.`
            : `Minimum ${MIN_PASSWORD_LENGTH} characters.`}
        </p>
      </div>

      {fieldError ? <FieldError>{fieldError}</FieldError> : null}
      {!fieldError && error ? <FieldError>{error}</FieldError> : null}

      {/* Clerk's bot sign-up protection is on by default and needs this placeholder to
          mount its CAPTCHA widget. Without it Clerk falls back to an invisible widget and
          logs a console error. */}
      <div id="clerk-captcha" />

      <button type="submit" disabled={submitting} className="fx-btn fx-btn-primary">
        {submitting ? (
          <>
            <Spinner /> Creating account...
          </>
        ) : (
          "Create account"
        )}
      </button>
    </form>
  );
}
