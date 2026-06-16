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
    <main className="page-narrow">
      <a href="/" className="back-link">
        <span aria-hidden>←</span> Home
      </a>
      <div className="mt-4 animate-fade-in-up">
        <p className="eyebrow">Your account</p>
        <h1 className="page-title mt-2">Your profile</h1>
        <p className="page-subtitle">
          Name, age, and gender — stored in your preference model so every plan and recipe can use
          them.
        </p>
      </div>

      {saved && <p className="notice-ok mt-6">Saved.</p>}

      <form action={saveProfile} className="card-pad mt-6 space-y-4">
        <label className="block">
          <span className="field-label">Name</span>
          <input
            name="name"
            type="text"
            defaultValue={model?.name ?? ""}
            autoComplete="name"
            className="input"
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="field-label">Age</span>
            <input
              name="age"
              type="number"
              min="1"
              max="120"
              defaultValue={model?.ageYears ?? ""}
              className="input"
            />
          </label>
          <label className="block">
            <span className="field-label">Gender</span>
            <select name="gender" defaultValue={model?.gender ?? ""} className="select">
              <option value="">—</option>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="submit" className="btn-primary">
          Save profile
        </button>
      </form>

      {!data.ready && (
        <p className="notice-warn mt-4">
          Couldn&apos;t reach the database. {data.error?.slice(0, 120)}
        </p>
      )}
    </main>
  );
}
