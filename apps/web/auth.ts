import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { encryptSecret, verifyPassword } from "@gm/core/crypto";
import { normalizeUsername } from "@gm/core/personalization";
import { attachGoogleToUser, getAdminDb, getUserByUsername, upsertGoogleAuth } from "@gm/db";
import { authConfig } from "./auth.config";

// G4: In-memory login lockout (10 failures → 15 min lockout per username)
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 10;
const LOCKOUT_MS = 15 * 60 * 1_000;
// Cap the map so attacker-supplied usernames (recordFail fires for unknown names too) can't grow
// it without bound. When the cap is hit, drop entries whose lockout has already elapsed; if none
// have, evict the oldest-inserted key (Map preserves insertion order).
const MAX_TRACKED = 10_000;

function pruneAttempts(): void {
  if (loginAttempts.size < MAX_TRACKED) return;
  const now = Date.now();
  for (const [k, v] of loginAttempts) {
    if (!v.lockedUntil || now >= v.lockedUntil) loginAttempts.delete(k);
  }
  // Still over the cap (everything actively locked) → evict oldest insertions until under it.
  while (loginAttempts.size >= MAX_TRACKED) {
    const oldest = loginAttempts.keys().next().value;
    if (oldest === undefined) break;
    loginAttempts.delete(oldest);
  }
}

function isLockedOut(u: string): boolean {
  const e = loginAttempts.get(u);
  return !!e?.lockedUntil && Date.now() < e.lockedUntil;
}
function recordFail(u: string): void {
  if (!loginAttempts.has(u)) pruneAttempts();
  const e = loginAttempts.get(u) ?? { count: 0, lockedUntil: 0 };
  e.count++;
  if (e.count >= MAX_ATTEMPTS) { e.lockedUntil = Date.now() + LOCKOUT_MS; e.count = 0; }
  loginAttempts.set(u, e);
}
function clearLock(u: string): void { loginAttempts.delete(u); }

/**
 * Full (Node-runtime) auth: the edge-safe base (`auth.config.ts`) + the DB-backed Credentials
 * provider and `jwt` callback. Used by the API route handler and server components; `middleware.ts`
 * uses the base config ONLY (no DB) so the edge bundle never pulls in postgres.
 *
 * Login is USERNAME + password (Credentials). Google stays a provider purely for the optional
 * "Connect Gmail" receipt feature — it's initiated while already signed in, so it ATTACHES to the
 * current account (attachGoogleToUser) instead of creating a second one; the email is set from the
 * Google profile at that point (it isn't collected at signup). A cold Google sign-in with no session
 * still falls back to upsertGoogleAuth-by-email.
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
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username =
          typeof credentials?.username === "string" ? normalizeUsername(credentials.username) : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!username || !password) return null;
        if (isLockedOut(username)) return null;
        const user = await getUserByUsername(getAdminDb(), username);
        if (!user?.passwordHash) { recordFail(username); return null; } // unknown username or a Google-only account
        if (!verifyPassword(password, user.passwordHash)) { recordFail(username); return null; }
        clearLock(username);
        return { id: user.id, email: user.email ?? undefined, name: user.name ?? undefined };
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
        const signedInUid = typeof token.uid === "string" ? token.uid : null;
        try {
          const key = process.env.TOKEN_ENC_KEY;
          const payload = {
            email: user.email,
            name: user.name ?? null,
            image: user.image ?? null,
            accessTokenEnc: account.access_token && key ? encryptSecret(account.access_token, key) : null,
            refreshTokenEnc:
              account.refresh_token && key ? encryptSecret(account.refresh_token, key) : null,
            scopes: typeof account.scope === "string" ? account.scope.split(" ") : [],
            expiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
          };
          if (signedInUid) {
            // "Connect Gmail" while already signed in (the only Google entry point in-app): attach to
            // THIS account so a username-first user keeps one identity — never spawn a 2nd user.
            await attachGoogleToUser(getAdminDb(), signedInUid, payload);
          } else {
            // Cold Google sign-in with no active session → fall back to upsert-by-email.
            token.uid = await upsertGoogleAuth(getAdminDb(), payload);
          }
        } catch (e) {
          console.error("persist google auth failed", e);
          // On cold sign-in failure: deny the session rather than return a uid-less token.
          // A token without uid bypasses RLS — every withTenant call would run as an anonymous
          // user, potentially leaking or corrupting data across tenant boundaries.
          // On Connect-Gmail failure: keep the existing session (token.uid already set).
          if (!signedInUid) {
            // next-auth v5: returning null from jwt() denies the session → signin error page
            return null;
          }
        }
      }
      return token;
    },
  },
});
