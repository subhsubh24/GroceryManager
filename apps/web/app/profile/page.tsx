import { redirect } from "next/navigation";
import {
  appendPreferenceSignal,
  getAdminDb,
  getDb,
  loadPreferenceSignals,
  updateUserName,
  withTenant,
} from "@gm/db";
import {
  projectUserModel,
  signalFromProfileAge,
  signalFromProfileGender,
  signalFromProfileName,
} from "@gm/core/personalization";
import { currentUserId } from "@/app/lib/tenant";

export const dynamic = "force-dynamic";

const GENDERS = ["female", "male", "non-binary", "prefer not to say"];

// Edits are appended at higher confidence than the signup signals (0.9) so the latest value wins
// in the projection — the profile stays an editable view over the same semantic-layer ledger.
const EDIT_CONFIDENCE = 0.99;

async function saveProfile(formData: FormData) {
  "use server";
  const userId = await currentUserId();
  if (!userId) redirect("/signin");

  const name = String(formData.get("name") ?? "").trim();
  const ageRaw = String(formData.get("age") ?? "").trim();
  const gender = String(formData.get("gender") ?? "").trim();
  const age = Number(ageRaw);

  const signals = [
    ...(name ? [signalFromProfileName(name, EDIT_CONFIDENCE)] : []),
    ...(Number.isFinite(age) && age > 0 ? [signalFromProfileAge(age, EDIT_CONFIDENCE)] : []),
    ...(gender ? [signalFromProfileGender(gender, EDIT_CONFIDENCE)] : []),
  ];

  await withTenant(getDb(), userId, async (tx) => {
    for (const s of signals) {
      await appendPreferenceSignal(tx, {
        userId,
        topic: s.topic,
        value: s.value ?? null,
        polarity: s.polarity,
        source: "correction",
        confidence: s.confidence,
      });
    }
  });
  // Keep the users row's display name in sync (admin scope — name also lives on the user row).
  await updateUserName(getAdminDb(), userId, name || null);

  redirect("/profile?saved=1");
}

async function load() {
  try {
    const userId = await currentUserId();
    if (!userId) return { ready: false as const, error: null as string | null };
    const signals = await withTenant(getDb(), userId, (tx) => loadPreferenceSignals(tx, userId));
    return { ready: true as const, error: null as string | null, model: projectUserModel(signals) };
  } catch (e) {
    return { ready: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;
  const data = await load();
  const model = data.ready ? data.model : null;

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-5 pb-16 pt-8">
      <a href="/" className="text-sm text-brand-600">
        ← Home
      </a>
      <h1 className="mt-2 mb-1 text-2xl font-bold text-ink">Your profile</h1>
      <p className="mb-6 text-sm text-ink/60">
        Name, age, and gender — stored in your preference model so every plan and recipe can use them.
      </p>

      {saved && (
        <p className="mb-4 rounded-xl bg-brand-50 p-3 text-sm text-brand-900">Saved.</p>
      )}

      <form action={saveProfile} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-ink">Name</span>
          <input
            name="name"
            type="text"
            defaultValue={model?.name ?? ""}
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
              defaultValue={model?.ageYears ?? ""}
              className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink">Gender</span>
            <select
              name="gender"
              defaultValue={model?.gender ?? ""}
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
          className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98]"
        >
          Save profile
        </button>
      </form>

      {!data.ready && (
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Couldn&apos;t reach the database. {data.error?.slice(0, 120)}
        </p>
      )}
    </main>
  );
}
