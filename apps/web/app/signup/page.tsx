import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import {
  appendPreferenceSignal,
  createUserWithPassword,
  getAdminDb,
  getDb,
  getUserByEmail,
  getUserIdByReferralCode,
  recordReferral,
  withTenant,
} from "@gm/db";
import { hashPassword } from "@gm/core/crypto";
import {
  isValidReferralCode,
  signalFromProfileAge,
  signalFromProfileGender,
  signalFromProfileName,
} from "@gm/core/personalization";
import { signIn } from "@/auth";

export const dynamic = "force-dynamic";

const GENDERS = ["female", "male", "non-binary", "prefer not to say"];

/**
 * Create an account: email + password (username = email) plus a profile (name, age, gender). The
 * profile is stored in the SEMANTIC LAYER as profile:* preferenceSignals (PLAN §8.7), so plan /
 * recipe / etc. read it like everything else. Then sign the user straight in.
 */
async function registerAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const ageRaw = String(formData.get("age") ?? "").trim();
  const gender = String(formData.get("gender") ?? "").trim();
  const ref = String(formData.get("ref") ?? "").trim();
  const age = Number(ageRaw);

  if (!email || !password) redirect("/signup?error=missing");
  if (password.length < 8) redirect("/signup?error=weak");

  const existing = await getUserByEmail(getAdminDb(), email);
  if (existing) redirect("/signup?error=exists");

  // Provision the user on the admin connection (a brand-new row can't satisfy its own RLS).
  const userId = await createUserWithPassword(getAdminDb(), {
    email,
    name: name || null,
    passwordHash: hashPassword(password),
  });

  // Profile facts → the preference ledger (semantic layer). Tenant-scoped so RLS is satisfied.
  await withTenant(getDb(), userId, async (tx) => {
    const signals = [
      ...(name ? [signalFromProfileName(name)] : []),
      ...(Number.isFinite(age) && age > 0 ? [signalFromProfileAge(age)] : []),
      ...(gender ? [signalFromProfileGender(gender)] : []),
    ];
    for (const s of signals) {
      await appendPreferenceSignal(tx, {
        userId,
        topic: s.topic,
        value: s.value ?? null,
        polarity: s.polarity,
        source: "onboarding_q",
        confidence: s.confidence,
      });
    }
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
    await signIn("credentials", { email, password, redirectTo: "/" });
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
    missing: "Please enter an email and password.",
    weak: "Password must be at least 8 characters.",
    exists: "An account with that email already exists. Try signing in.",
  };
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-md animate-fade-in-up">
        <a href="/" className="mx-auto flex w-fit items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-lg shadow-brand">
            🧺
          </span>
        </a>
        <div className="mt-6 text-center">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-900">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-ink-500">
            A little about you so every plan and recipe fits — you can edit it anytime.
          </p>
        </div>

        <div className="card-pad mt-7">
          {error && <p className="notice-warn mb-4">{errorText[error] ?? "Something went wrong. Try again."}</p>}

          <form action={registerAction} className="space-y-4">
            {refCode && <input type="hidden" name="ref" value={refCode} />}
            <label className="block">
              <span className="field-label">Email</span>
              <input name="email" type="email" autoComplete="email" required className="input" />
            </label>
            <label className="block">
              <span className="field-label">Password</span>
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                className="input"
              />
              <span className="field-hint">At least 8 characters.</span>
            </label>
            <label className="block">
              <span className="field-label">Name</span>
              <input name="name" type="text" autoComplete="name" className="input" />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="field-label">Age</span>
                <input name="age" type="number" min="1" max="120" className="input" />
              </label>
              <label className="block">
                <span className="field-label">Gender</span>
                <select name="gender" defaultValue="" className="select">
                  <option value="">—</option>
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
            </div>
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
