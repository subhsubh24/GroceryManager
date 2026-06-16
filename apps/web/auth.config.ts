import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/** Read-only Gmail + identity. Offline access + consent prompt to get a refresh token. */
const GMAIL_SCOPE = "openid email profile https://www.googleapis.com/auth/gmail.readonly";

/**
 * Edge-safe base auth config — NO database imports — so it can run in `middleware.ts` (the gate that
 * requires sign-in). The full config (`auth.ts`) layers on the DB-backed `jwt` callback for the Node
 * runtime. Splitting is required: middleware runs on the edge where postgres/node modules can't load.
 */
export const authConfig = {
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
    // Expose the userId (stamped on the JWT by the full jwt callback) so server components can scope
    // every query with withTenant. Edge-safe: it only reads the already-issued token.
    session({ session, token }) {
      if (session.user && typeof token.uid === "string") {
        (session.user as { id?: string }).id = token.uid;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
