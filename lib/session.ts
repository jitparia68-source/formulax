import "server-only";

import { auth } from "@/auth";

export type SessionUser = {
  name: string;
  email: string;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.email) {
    return null;
  }
  return { name: user.name ?? "Engineer", email: user.email };
}
