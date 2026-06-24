import { redirect } from "next/navigation";
import { loadEnv } from "@gm/config/env";
import {
  appendPreferenceSignal,
  deleteUserAndAllData,
  getAdminDb,
  getDb,
  getUserPhone,
  loadPreferenceSignals,
  updateUserName,
  updateUserPhone,
  withTenant,
} from "@gm/db";
import {
  projectUserModel,
  signalFromProfileAge,
  signalFromProfileGender,
  signalFromProfileName,
} from "@gm/core/personalization";
import { signOut } from "@/auth";
import { currentUserId } from "@/app/lib/tenant";
import { PageHeader } from "@/app/components/page-header";
import { PushToggle } from "@/app/digest/push-toggle";
import { User, ChevronRight } from "@/app/components/icons";

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
  const phone = String(formData.get("phone") ?? "").trim();
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
  // Phone for SMS digests — presence opts in, blank opts out.
  await updateUserPhone(getAdminDb(), userId, phone || null);

  redirect("/profile?saved=1");
}

async function deleteAccount(formData: FormData) {
  "use server";
  const userId = await currentUserId();
  if (!userId) redirect("/signin");
  // Double-check the confirmation word before doing anything irreversible.
  const confirm = String(formData.get("confirm") ?? "").trim().toLowerCase();
  if (confirm !== "delete") redirect("/profile?deleteError=1");
  // Erase all user data; ON DELETE CASCADE propagates to every child table.
  await deleteUserAndAllData(getAdminDb(), userId);
  // Invalidate the session so the browser doesn't retain stale cookies.
  await signOut({ redirect: false });
  redirect("/");
}

async function load() {
  try {
    const userId = await currentUserId();
    if (!userId) return { ready: false as const, error: null as string | null, phone: null as string | null };
    const [signals, phone] = await Promise.all([
      withTenant(getDb(), userId, (tx) => loadPreferenceSignals(tx, userId)),
      getUserPhone(getAdminDb(), userId),
    ]);
    return { ready: true as const, error: null as string | null, model: projectUserModel(signals), phone };
  } catch (e) {
    return { ready: false as const, error: e instanceof Error ? e.message : String(e), phone: null as string | null };
  }
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; deleteError?: string }>;
}) {
  const { saved, deleteError } = await searchParams;
  const data = await load();
  const model = data.ready ? data.model : null;
  const phone = data.ready ? data.phone : null;
  const vapidPublicKey = loadEnv().VAPID_PUBLIC_KEY ?? null;

  return (
    <main className="page-narrow">
      <PageHeader
        accent="brand"
        icon={User}
        eyebrow="Your account"
        title="Your profile"
        subtitle={
          <>
            Name, age, and gender — stored in your preference model so every plan and recipe can use
            them.
          </>
        }
      />

      {saved && <p className="notice-ok mt-6">Saved.</p>}
      {deleteError && <p className="notice-danger mt-6">Type the word "delete" to confirm.</p>}

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
        <label className="block">
          <span className="field-label">Phone — for order texts (optional)</span>
          <input
            name="phone"
            type="tel"
            defaultValue={phone ?? ""}
            placeholder="+1 555 000 1234"
            autoComplete="tel"
            className="input"
          />
          <span className="field-hint">
            Get a text when it&apos;s time to order — with your list. Leave blank to opt out. (Needs SMS
            configured on the server.)
          </span>
        </label>
        <button type="submit" className="btn-primary">
          Save profile
        </button>
      </form>

      {/* Web push — the default proactive channel (the same weekly digest, as a notification). */}
      <div className="mt-6">
        <PushToggle vapidPublicKey={vapidPublicKey} />
      </div>

      {/* Subscription — manage plan and upgrade */}
      <div className="mt-6">
        <a
          href="/manage-subscription"
          className="card-pad flex items-center justify-between transition-colors hover:bg-ink-50"
        >
          <div>
            <p className="text-sm font-medium">Subscription</p>
            <p className="mt-0.5 text-xs text-ink-500">View your plan and upgrade options</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-ink-400" strokeWidth={2} />
        </a>
      </div>

      {!data.ready && (
        <p className="notice-warn mt-4">Couldn&apos;t load your profile. Please try again.</p>
      )}

      {/* Danger zone — account deletion (Apple 5.1.1(v) / GDPR) */}
      <section className="mt-10 rounded-2xl border border-danger bg-danger-soft p-5">
        <h2 className="text-sm font-semibold text-danger-ink">Danger zone</h2>
        <p className="mt-1 text-xs text-danger-ink/80">
          Permanently deletes your account and all data — pantry, receipts, recipes, cook history.
          This cannot be undone.
        </p>
        <form action={deleteAccount} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="field-label text-danger-ink">
              Type <em>delete</em> to confirm
            </span>
            <input
              name="confirm"
              type="text"
              autoComplete="off"
              placeholder="delete"
              className="input mt-1 border-danger focus:ring-danger"
            />
          </label>
          <button type="submit" className="btn-danger">
            Delete account
          </button>
        </form>
      </section>

      <p className="mt-6 text-xs text-ink-400">
        <a href="/privacy" className="underline hover:text-ink-700">Privacy policy</a>
        {" · "}
        <a href="/terms" className="underline hover:text-ink-700">Terms of use</a>
      </p>
    </main>
  );
}
