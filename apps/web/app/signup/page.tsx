import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import {
  appendPreferenceSignal,
  createUserWithPassword,
  getAdminDb,
  getDb,
  getUserByEmail,
  withTenant,
} from "@gm/db";
import { hashPassword } from "@gm/core/crypto";
import {
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
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorText: Record<string, string> = {
    missing: "Please enter an email and password.",
    weak: "Password must be at least 8 characters.",
    exists: "An account with that email already exists. Try signing in.",
  };
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-12">
      <p className="text-sm font-medium text-brand-600">GroceryManager</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">Create your account</h1>
      <p className="mt-1 text-sm text-ink/60">
        A little about you so every plan and recipe fits — you can edit it anytime.
      </p>

      {error && (
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          {errorText[error] ?? "Something went wrong. Try again."}
        </p>
      )}

      <form action={registerAction} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-ink">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink">Password</span>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-xs text-ink/40">At least 8 characters.</span>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink">Name</span>
          <input
            name="name"
            type="text"
            autoComplete="name"
            className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-ink">Age</span>
            <input
              name="age"
              type="number"
              min="1"
              max="120"
              className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink">Gender</span>
            <select
              name="gender"
              defaultValue=""
              className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="submit"
          className="w-full rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98]"
        >
          Create account
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink/60">
        Already have an account?{" "}
        <a href="/signin" className="font-medium text-brand-600">
          Sign in
        </a>
      </p>
    </main>
  );
}
