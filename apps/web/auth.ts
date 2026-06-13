import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { encryptSecret } from "@gm/core/crypto";
import { getAdminDb, upsertGoogleAuth } from "@gm/db";

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
    // Expose the userId so server components can scope queries (withTenant).
    async session({ session, token }) {
      if (session.user && typeof token.uid === "string") {
        (session.user as { id?: string }).id = token.uid;
      }
      return session;
    },
  },
});
