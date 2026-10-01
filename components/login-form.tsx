"use client";

import { useActionState } from "react";

import { FieldError, SubmitButton } from "@/components/form-controls";
import { INITIAL_AUTH_STATE, type AuthFormState } from "@/lib/auth-state";

type Action = (
  state: AuthFormState,
  formData: FormData,
) => Promise<AuthFormState>;

export function LoginForm({
  action,
  callbackUrl,
}: {
  action: Action;
  callbackUrl: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL_AUTH_STATE);
  const error = state.status === "error" ? state.error : null;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

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
          aria-invalid={error ? true : undefined}
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
          placeholder="Enter your password"
          aria-invalid={error ? true : undefined}
          className="fx-input"
        />
      </div>

      {error ? <FieldError>{error}</FieldError> : null}

      <SubmitButton pendingLabel="Signing in...">Sign in</SubmitButton>
    </form>
  );
}
