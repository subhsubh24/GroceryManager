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
      <form action={formAction} className="card-pad">
        <label className="mb-2 block field-label">What are you scanning?</label>
        <div className="mb-4 flex flex-wrap gap-2">
          {LOCATIONS.map((l, i) => (
            <label key={l.value} className="chip">
              <input type="radio" name="location" value={l.value} defaultChecked={i === 0} className="control-accent" />
              {l.label}
            </label>
          ))}
        </div>

        <label className="mb-2 block field-label">Photo(s)</label>
        <input
          type="file"
          name="photos"
          accept="image/*"
          capture="environment"
          multiple
          className="input-file mb-4"
        />

        <button type="submit" disabled={pending} className="btn-dark">
          {pending ? "Looking…" : ready ? "Re-scan" : "Scan"}
        </button>
      </form>

      {state.status === "error" && <p className="notice-warn">{state.message}</p>}

      {ready && (
        <form action={applyScan} className="space-y-5">
          <input type="hidden" name="location" value={ready.location} />
          <input type="hidden" name="summary" value={ready.summary} />
          <input type="hidden" name="model" value={ready.model} />

          <p className="notice-ok">{ready.summary}</p>

          {ready.confirmations.length > 0 && (
            <section className="card-pad">
              <h2 className="section-title mb-1">Already tracked</h2>
              <p className="mb-3 text-xs text-ink-400">Confirm these are really there — refreshes confidence.</p>
              <ul className="space-y-2.5">
                {ready.confirmations.map((c) => (
                  <li key={`c-${c.canonicalItemId}`} className="flex items-center gap-2.5 text-sm text-ink-800">
                    <input type="checkbox" name="confirm" value={JSON.stringify(c)} defaultChecked className="control-accent" />
                    <span className="capitalize">{c.matchedName ?? c.rawLabel}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {ready.possibleMatches.length > 0 && (
            <section className="card-pad">
              <h2 className="section-title mb-1">Already in your pantry?</h2>
              <p className="mb-3 text-xs text-ink-400">
                These look close to something you already track. Tell me if it&apos;s the same one (I&apos;ll
                just confirm it) or a new item — so your pantry doesn&apos;t double up.
              </p>
              <ul className="space-y-3">
                {ready.possibleMatches.map((p, i) => {
                  const same = JSON.stringify({
                    rawLabel: p.rawLabel,
                    action: "confirm_present",
                    canonicalItemId: p.candidateId,
                    matchedName: p.candidateName,
                    presenceConfidence: p.presenceConfidence,
                    qtyEstimate: p.qtyEstimate,
                    newConfidence: null,
                  });
                  const asNew = JSON.stringify({
                    rawLabel: p.rawLabel,
                    action: "new_item",
                    canonicalItemId: null,
                    matchedName: null,
                    presenceConfidence: p.presenceConfidence,
                    qtyEstimate: p.qtyEstimate,
                    newConfidence: null,
                  });
                  return (
                    <li
                      key={`p-${i}-${p.rawLabel}`}
                      className="rounded-xl border border-line bg-surface p-3.5 shadow-xs"
                    >
                      <p className="text-sm text-ink-800">
                        Saw <span className="font-semibold capitalize">{p.rawLabel}</span> — is this your{" "}
                        <span className="font-semibold capitalize">{p.candidateName}</span>?
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        <label className="chip">
                          <input
                            type="radio"
                            name={`pmchoice-${i}`}
                            value={same}
                            defaultChecked
                            className="control-accent"
                          />
                          Same one
                        </label>
                        <label className="chip">
                          <input type="radio" name={`pmchoice-${i}`} value={asNew} className="control-accent" />
                          Add as new
                        </label>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {ready.newItems.length > 0 && (
            <section className="card-pad">
              <h2 className="section-title mb-1">New — add to pantry?</h2>
              <p className="mb-3 text-xs text-ink-400">Spotted in the photo but not yet tracked.</p>
              <ul className="space-y-2.5">
                {ready.newItems.map((n, i) => (
                  <li key={`n-${i}-${n.rawLabel}`} className="flex items-center gap-2.5 text-sm text-ink-800">
                    <input type="checkbox" name="add" value={JSON.stringify(n)} defaultChecked className="control-accent" />
                    <span className="capitalize">{n.rawLabel}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {ready.unconfirmed.length > 0 && (
            <section className="card-pad">
              <h2 className="section-title mb-1">Didn&apos;t see these</h2>
              <p className="mb-3 text-xs text-ink-400">
                Still counted — not removed. A photo can&apos;t see everything (behind things, opaque jars,
                the freezer).
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {ready.unconfirmed.map((u) => (
                  <li key={`u-${u.canonicalItemId}`} className="pill-muted">
                    {u.name}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <button type="submit" className="btn-primary">
            Update my pantry →
          </button>
        </form>
      )}
    </div>
  );
}
