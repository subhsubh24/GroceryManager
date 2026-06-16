"use client";
import { useActionState } from "react";
import { analyzeScan, applyScan, type AnalyzeState } from "./actions";

const initial: AnalyzeState = { status: "idle" };
const LOCATIONS: { value: string; label: string }[] = [
  { value: "fridge", label: "Fridge" },
  { value: "pantry", label: "Pantry" },
  { value: "freezer", label: "Freezer" },
];

export function ScanClient() {
  const [state, formAction, pending] = useActionState(analyzeScan, initial);
  const ready = state.status === "ready" ? state : null;

  return (
    <div className="space-y-6">
      <form action={formAction} className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
        <label className="mb-2 block text-sm font-medium text-ink">What are you scanning?</label>
        <div className="mb-4 flex gap-2">
          {LOCATIONS.map((l, i) => (
            <label key={l.value} className="flex items-center gap-1.5 text-sm text-ink/70">
              <input type="radio" name="location" value={l.value} defaultChecked={i === 0} />
              {l.label}
            </label>
          ))}
        </div>

        <label className="mb-2 block text-sm font-medium text-ink">Photo(s)</label>
        <input
          type="file"
          name="photos"
          accept="image/*"
          capture="environment"
          multiple
          className="mb-4 block w-full text-sm text-ink/70 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700"
        />

        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
        >
          {pending ? "Looking…" : ready ? "Re-scan" : "Scan"}
        </button>
      </form>

      {state.status === "error" && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{state.message}</p>
      )}

      {ready && (
        <form action={applyScan} className="space-y-5">
          <input type="hidden" name="location" value={ready.location} />
          <input type="hidden" name="summary" value={ready.summary} />
          <input type="hidden" name="model" value={ready.model} />

          <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-800">{ready.summary}</p>

          {ready.confirmations.length > 0 && (
            <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
              <h2 className="mb-1 font-semibold text-ink">Already tracked</h2>
              <p className="mb-3 text-xs text-ink/50">Confirm these are really there — refreshes confidence.</p>
              <ul className="space-y-2">
                {ready.confirmations.map((c) => (
                  <li key={`c-${c.canonicalItemId}`} className="flex items-center gap-2 text-sm text-ink">
                    <input type="checkbox" name="confirm" value={JSON.stringify(c)} defaultChecked />
                    <span className="capitalize">{c.matchedName ?? c.rawLabel}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {ready.newItems.length > 0 && (
            <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
              <h2 className="mb-1 font-semibold text-ink">New — add to pantry?</h2>
              <p className="mb-3 text-xs text-ink/50">Spotted in the photo but not yet tracked.</p>
              <ul className="space-y-2">
                {ready.newItems.map((n, i) => (
                  <li key={`n-${i}-${n.rawLabel}`} className="flex items-center gap-2 text-sm text-ink">
                    <input type="checkbox" name="add" value={JSON.stringify(n)} defaultChecked />
                    <span className="capitalize">{n.rawLabel}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {ready.unconfirmed.length > 0 && (
            <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
              <h2 className="mb-1 font-semibold text-ink">Didn&apos;t see these</h2>
              <p className="mb-3 text-xs text-ink/50">
                Still counted — not removed. A photo can&apos;t see everything (behind things, opaque jars,
                the freezer).
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {ready.unconfirmed.map((u) => (
                  <li key={`u-${u.canonicalItemId}`} className="rounded-full bg-ink/5 px-2.5 py-1 text-xs text-ink/60">
                    {u.name}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <button
            type="submit"
            className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98]"
          >
            Update my pantry →
          </button>
        </form>
      )}
    </div>
  );
}
