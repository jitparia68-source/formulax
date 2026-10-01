export type AuthFormState =
  | { status: "idle" }
  | { status: "error"; error: string }
  | { status: "success" };

/**
 * Lives outside the "use server" module because a use-server file may only export async
 * functions, and this is a plain value shared with the client components that seed
 * useActionState.
 */
export const INITIAL_AUTH_STATE: AuthFormState = { status: "idle" };
