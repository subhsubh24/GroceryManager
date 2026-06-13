import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { encryptSecret } from "@gm/core/crypto";
import { getDb, upsertGoogleAuth } from "@gm/db";

/** Read-only Gmail + identity. Offline access + consent prompt to get a refresh token. */
const GMAIL_SCOPE = "openid email profile https://www.googleapis.com/auth/gmail.readonly";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: { params: { scope: GMAIL_SCOPE, access_type: "offline", prompt: "consent" } },
    }),
  ],
  callbacks: {
    // On sign-in, persist the user + encrypted tokens so the worker can poll Gmail offline.
    async signIn({ user, account }) {
      try {
        const key = process.env.TOKEN_ENC_KEY;
        if (account?.provider === "google" && user.email && key) {
          await upsertGoogleAuth(getDb(), {
            email: user.email,
            name: user.name ?? null,
            image: user.image ?? null,
            accessTokenEnc: account.access_token ? encryptSecret(account.access_token, key) : null,
            refreshTokenEnc: account.refresh_token ? encryptSecret(account.refresh_token, key) : null,
            scopes: typeof account.scope === "string" ? account.scope.split(" ") : [],
            expiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
          });
        }
      } catch (e) {
        console.error("persist google auth failed", e);
      }
      return true;
    },
  },
});
