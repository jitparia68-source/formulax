import "server-only";

import { currentUser } from "@clerk/nextjs/server";

export type SessionUser = {
  name: string;
  email: string;
};

/**
 * Clerk owns identity, so there is no local user row to read. The name and email are
 * projected from the Clerk user object, with a fallback chain because a user may have
 * been created with only an email and no profile name.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const user = await currentUser();
  if (!user) {
    return null;
  }

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const email =
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    "";

  return {
    name: fullName || user.username || email.split("@")[0] || "Engineer",
    email,
  };
}
