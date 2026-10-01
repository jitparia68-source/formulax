"use server";

import { AuthError } from "next-auth";

import { registerUserAction } from "@/app/actions";
import { signIn, signOut } from "@/auth";

import type { AuthFormState } from "@/lib/auth-state";

function readField(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

/**
 * Only same-origin relative paths are accepted as a post-login destination, so a crafted
 * `callbackUrl` cannot bounce a freshly authenticated user to another site.
 */
function safeCallbackUrl(raw: string): string {
  if (!raw.startsWith("/") || raw.startsWith("//")) {
    return "/dashboard";
  }
  return raw;
}

export async function loginAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = readField(formData, "email").trim();
  const password = readField(formData, "password");
  const callbackUrl = safeCallbackUrl(readField(formData, "callbackUrl"));

  if (!email || !password) {
    return { status: "error", error: "Enter your email and password." };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl,
    });
    return { status: "success" };
  } catch (error) {
    // A successful signIn redirects, so reaching here means it threw. AuthError is the
    // only expected cause; anything else is an unexpected fault and is logged.
    if (error instanceof AuthError) {
      return {
        status: "error",
        error: "That email and password combination is not recognised.",
      };
    }
    console.error("[formulax] login", error);
    return { status: "error", error: "Unable to sign in. Please try again." };
  }
}

export async function registerAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const result = await registerUserAction(formData);
  if (!result.success) {
    return { status: "error", error: result.error };
  }

  // Registering is most useful when it signs the user straight in, so the same
  // credentials are replayed through the credentials provider.
  const email = readField(formData, "email").trim();
  const password = readField(formData, "password");

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: safeCallbackUrl(readField(formData, "callbackUrl")),
    });
    return { status: "success" };
  } catch (error) {
    if (error instanceof AuthError) {
      return { status: "error", error: "Account created. Please sign in." };
    }
    console.error("[formulax] post-register sign in", error);
    return { status: "error", error: "Account created. Please sign in." };
  }
}

/**
 * Used directly as a `<form action>`, so it must resolve to void. A successful signOut
 * throws a redirect, so reaching the end of this function is not a success path.
 */
export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
