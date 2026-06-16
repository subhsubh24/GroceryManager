import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { encryptSecret, verifyPassword } from "@gm/core/crypto";
import { getAdminDb, getUserByEmail, upsertGoogleAuth } from "@gm/db";
import { authConfig } from "./auth.config";

/**
 * Full (Node-runtime) auth: the edge-safe base (`auth.config.ts`) + the DB-backed Credentials
 * provider and `jwt` callback. Used by the API route handler and server components; `middleware.ts`
 * uses the base config ONLY (no DB) so the edge bundle never pulls in postgres.
 *
 * Login is email + password (Credentials). Google stays a provider purely for the optional
 * "Connect Gmail" receipt feature — a credentials user and a connected Google account auto-link by
 * email (upsertGoogleAuth upserts users by email).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  pages: { signIn: "/signin" },
  providers: [
    ...authConfig.providers,
    // Credentials lives here (Node runtime), NOT in auth.config.ts — its authorize imports @gm/db,
    // which must never reach the edge middleware bundle.
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;
        const user = await getUserByEmail(getAdminDb(), email);
        if (!user?.passwordHash) return null; // unknown email or a Google-only account
        if (!verifyPassword(password, user.passwordHash)) return null;
        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // On sign-in, stamp the userId onto the JWT. Credentials: take it straight from `authorize`'s
    // returned user. Google: provision the user + encrypted tokens on the admin connection (a
    // brand-new user row can't satisfy its own RLS WITH CHECK) and stamp the resulting userId.
    async jwt({ token, account, user }) {
      if (account?.provider === "credentials" && user?.id) {
        token.uid = user.id;
        return token;
      }
      if (account?.provider === "google" && user?.email) {
        try {
          const key = process.env.TOKEN_ENC_KEY;
          token.uid = await upsertGoogleAuth(getAdminDb(), {
            email: user.email,
            name: user.name ?? null,
            image: user.image ?? null,
            accessTokenEnc: account.access_token && key ? encryptSecret(account.access_token, key) : null,
            refreshTokenEnc:
              account.refresh_token && key ? encryptSecret(account.refresh_token, key) : null,
            scopes: typeof account.scope === "string" ? account.scope.split(" ") : [],
            expiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
          });
        } catch (e) {
          console.error("persist google auth failed", e);
        }
      }
      return token;
    },
  },
});
