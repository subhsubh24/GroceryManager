import NextAuth from "next-auth";
import { encryptSecret } from "@gm/core/crypto";
import { getAdminDb, upsertGoogleAuth } from "@gm/db";
import { authConfig } from "./auth.config";

/** Full (Node-runtime) auth: the edge-safe base + the DB-backed jwt callback. Used by the API route
 * handler and server components; middleware uses the base config only (no DB). */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    // On first sign-in, provision the user + encrypted tokens on the admin connection (a brand-new
    // user row can't satisfy its own RLS WITH CHECK), and stamp the userId onto the JWT.
    async jwt({ token, account, user }) {
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
