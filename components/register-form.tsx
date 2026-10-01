"use client";

import { useActionState, useState } from "react";

import { FieldError, SubmitButton } from "@/components/form-controls";
import { INITIAL_AUTH_STATE, type AuthFormState } from "@/lib/auth-state";

type Action = (
  state: AuthFormState,
  formData: FormData,
) => Promise<AuthFormState>;

const MIN_PASSWORD_LENGTH = 8;

export function RegisterForm({
  action,
  callbackUrl,
}: {
  action: Action;
  callbackUrl: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL_AUTH_STATE);
  const [password, setPassword] = useState("");
  const error = state.status === "error" ? state.error : null;

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <div>
        <label htmlFor="name" className="fx-label">
          Full name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          maxLength={120}
          placeholder="Ada Lovelace"
          className="fx-input"
        />
      </div>

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
          aria-invalid={tooShort ? true : undefined}
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

      {error ? <FieldError>{error}</FieldError> : null}

      <SubmitButton pendingLabel="Creating account...">Create account</SubmitButton>
    </form>
  );
}
