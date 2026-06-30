import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  createUserWithPassword,
  getAdminDb,
  getUserByUsername,
  getUserIdByReferralCode,
  recordReferral,
} from "@gm/db";
import { hashPassword } from "@gm/core/crypto";
import { isValidReferralCode, isValidUsername, normalizeUsername } from "@gm/core/personalization";
import { signIn } from "@/auth";
import { Leaf } from "@/app/components/icons";
import { Turnstile } from "@/app/components/turnstile";
import { verifyTurnstile } from "@/app/api/_lib/captcha";
import { rateLimit } from "@/app/api/_lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Create an account: USERNAME + password only (no email — it's set later only if the user connects
 * Gmail). The user's PROFILE (name, age, gender) is collected in the onboarding flow's first step
 * (`/onboarding`) and written there as profile:* preferenceSignals (PLAN §8.7). Signup just provisions
 * the account and signs the user in; the credentials redirect sends new accounts straight to onboarding.
 */
async function registerAction(formData: FormData) {
  "use server";
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const password = String(formData.get("password") ?? "");
  const ref = String(formData.get("ref") ?? "").trim();

  // G1: Rate-limit account creation per IP — 5 attempts / hour.
  // Applied BEFORE CAPTCHA so floods are shed cheaply (account creation is expensive + abuse-prone).
  // x-forwarded-for is the codebase-wide IP convention; on a trusted edge (Vercel/Cloudflare) the
  // leftmost entry is the verified client IP. Fall back to x-real-ip, then a shared "unknown" bucket.
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? hdrs.get("x-real-ip") ?? "unknown";
  if (!rateLimit(`signup:${ip}`, 5, 60 * 60_000).allowed) redirect("/signup?error=rate");

  // G5: Bot protection on signup
  const captchaToken = String(formData.get("cf-turnstile-response") ?? "").trim() || null;
  const captcha = await verifyTurnstile(captchaToken);
  if (!captcha.success) redirect("/signup?error=captcha");

  if (!username || !password) redirect("/signup?error=missing");
  if (!isValidUsername(username)) redirect("/signup?error=invalid");
  if (password.length < 8) redirect("/signup?error=weak");
  // G2: Server-side upper bound prevents hash-DoS from megabyte passwords.
  if (password.length > 200) redirect("/signup?error=weak");

  const existing = await getUserByUsername(getAdminDb(), username);
  if (existing) redirect("/signup?error=exists");

  // Provision the user on the admin connection (a brand-new row can't satisfy its own RLS). Email +
  // name start empty — name is captured in onboarding, email only if the user later connects Gmail.
  const userId = await createUserWithPassword(getAdminDb(), {
    username,
    passwordHash: hashPassword(password),
  });

  // Referral attribution — STRICTLY best-effort. The user already exists and is about to be signed in;
  // crediting the referrer must NEVER block or break signup. So everything below is wrapped in a single
  // try/catch that swallows any error (bad/unknown code, DB hiccup) and falls through to the normal
  // sign-in. The write uses the admin connection (it credits the *referrer*, a different tenant) and is
  // idempotent inside recordReferral. Runs BEFORE signIn's redirect, but can't throw out of the action.
  if (ref && isValidReferralCode(ref)) {
    try {
      const referrerUserId = await getUserIdByReferralCode(getAdminDb(), ref);
      if (referrerUserId) await recordReferral(getAdminDb(), referrerUserId, userId);
    } catch {
      /* attribution is best-effort — never let it interfere with signup */
    }
  }

  try {
    // New accounts land in the guided onboarding flow first (returning users via /signin go to /).
    await signIn("credentials", { username, password, redirectTo: "/onboarding" });
  } catch (e) {
    if (e instanceof AuthError) redirect("/signin?error=credentials");
    throw e; // re-throw NEXT_REDIRECT (success)
  }
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ref?: string }>;
}) {
  const { error, ref } = await searchParams;
  // Carry a valid `?ref=` invite code through the form (hidden field) without changing the visible UX.
  // Validated here so junk never reaches the action; the action re-validates + resolves it best-effort.
  const refCode = typeof ref === "string" && isValidReferralCode(ref) ? ref : null;
  const errorText: Record<string, string> = {
    missing: "Please enter a username and password.",
    invalid: "Username must be 3–20 characters: letters, numbers, dots or underscores.",
    weak: "Password must be at least 8 characters.",
    exists: "That username is taken. Try another, or sign in.",
    captcha: "Security check failed. Please try again.",
    rate: "Too many attempts. Please try again later.",
  };
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-md animate-fade-in-up">
        <a href="/" aria-label="GroceryManager — home" className="mx-auto flex w-fit items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-brand">
            <Leaf className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </span>
        </a>
        <div className="mt-6 text-center">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-900">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-ink-500">
            Just a username and password to start — we&apos;ll set up the rest in a minute.
          </p>
        </div>

        <div className="card-pad mt-7">
          {error && <p className="notice-warn mb-4">{errorText[error] ?? "Something went wrong. Try again."}</p>}

          <form action={registerAction} className="space-y-4">
            {refCode && <input type="hidden" name="ref" value={refCode} />}
            <label className="block">
              <span className="field-label">Username</span>
              <input
                name="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                minLength={3}
                maxLength={20}
                required
                className="input"
              />
              <span className="field-hint">3–20 characters: letters, numbers, dots or underscores.</span>
            </label>
            <label className="block">
              <span className="field-label">Password</span>
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={200}
                required
                className="input"
              />
              <span className="field-hint">At least 8 characters.</span>
            </label>
            {/* G5: renders the Turnstile challenge (and the cf-turnstile-response token the server
                action verifies) only when a site key is configured; renders nothing otherwise. */}
            <Turnstile action="signup" />
            <button type="submit" className="btn-primary btn-block">
              Create account
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-ink-500">
          Already have an account?{" "}
          <a href="/signin" className="font-semibold text-brand-700 hover:text-brand-800">
            Sign in
          </a>
        </p>
      </div>
    </main>
  );
}
