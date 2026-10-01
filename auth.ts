import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";

import { supabaseAdmin } from "@/lib/supabase";
import type { UserRow } from "@/types/database";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Required for AUTH_SECRET-based deployments: the host is not derived from a
  // trusted NEXTAUTH_URL in production or in local dev.
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Auth.js types credential values as `unknown`; a non-string reaching the
        // hash comparison would be a type error and, at runtime, a crash.
        const rawEmail = credentials?.email;
        const rawPassword = credentials?.password;

        if (typeof rawEmail !== "string" || typeof rawPassword !== "string") {
          return null;
        }

        const email = rawEmail.trim().toLowerCase();
        const password = rawPassword;

        if (!email || !password) {
          return null;
        }

        const { data, error } = await supabaseAdmin
          .from("users")
          .select("id, name, email, password_hash")
          .eq("email", email)
          .maybeSingle<UserRow>();

        if (error || !data) {
          return null;
        }

        const valid = await compare(password, data.password_hash);
        if (!valid) {
          return null;
        }

        return { id: data.id, name: data.name, email: data.email };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      // `token` is an untrusted JWE payload, so `id` is narrowed rather than asserted.
      if (typeof token.id === "string" && token.id.length > 0) {
        session.user.id = token.id;
      }
      return session;
    },
  },
});
