"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { extractTimerMinutes, scaleMeasure } from "@gm/core/recipe";

type Ingredient = { name: string; measure?: string; inPantry?: boolean };

// Wake Lock isn't reliably in TS 5.6's lib.dom — narrow it locally + feature-detect at runtime.
type WakeLockSentinelLike = { release: () => Promise<void> };
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

export function CookMode({
  imageUrl,
  steps,
  ingredients,
}: {
  imageUrl?: string;
  steps: string[];
  ingredients: Ingredient[];
}) {
  const total = steps.length;
  const [stepIndex, setStepIndex] = useState(0);
  const [factor, setFactor] = useState(1);
  const current = steps[stepIndex] ?? "";

  // Keep the screen awake while cooking; re-acquire when the tab becomes visible again.
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  useEffect(() => {
    const nav = navigator as WakeLockNavigator;
    if (!nav.wakeLock) return;
    let released = false;
    const acquire = async () => {
      try {
        sentinelRef.current = await nav.wakeLock!.request("screen");
      } catch {
        /* denied or not visible — ignore */
      }
    };
    void acquire();
    const onVisible = () => {
      if (document.visibilityState === "visible" && !released) void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinelRef.current?.release().catch(() => {});
      sentinelRef.current = null;
    };
  }, []);

  // One built-in timer, seeded from the current step's mentioned duration.
  const suggested = useMemo(() => extractTimerMinutes(current), [current]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setRunning(false);
    setRemaining(suggested != null ? suggested * 60 : null);
  }, [stepIndex, suggested]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r == null) return r;
        if (r <= 1) {
          setRunning(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="h-48 w-full rounded-3xl object-cover shadow-card" />
      ) : null}

      <section className="card-pad">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title">Ingredients</h2>
          <div className="flex gap-1.5">
            {[1, 2, 3].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFactor(f)}
                className={`tab ${factor === f ? "tab-active" : "tab-idle"}`}
              >
                ×{f}
              </button>
            ))}
          </div>
        </div>
        <ul className="space-y-1.5 text-sm">
          {ingredients.map((ing, i) => (
            <li
              key={`${ing.name}-${i}`}
              className="flex justify-between gap-4 border-b border-line/70 pb-1.5 last:border-0 last:pb-0"
            >
              <span className="text-ink-800">
                {ing.inPantry ? <span className="text-brand-600" title="in your pantry">✓ </span> : null}
                {ing.name}
              </span>
              {ing.measure ? (
                <span className="shrink-0 tabular-nums text-ink-500">{scaleMeasure(ing.measure, factor)}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel-brand">
        {total === 0 ? (
          <p className="text-sm text-white/90">No step-by-step instructions for this recipe.</p>
        ) : (
          <>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/80">
              Step {stepIndex + 1} / {total}
            </div>
            <p className="mt-2 text-lg leading-relaxed">{current}</p>

            {remaining != null && (
              <div className="mt-5 flex items-center gap-3">
                <span className="tabular-nums text-3xl font-bold">{mmss(remaining)}</span>
                <button
                  type="button"
                  onClick={() => setRunning((r) => !r)}
                  className="rounded-lg bg-white/15 px-3.5 py-1.5 text-sm font-semibold transition hover:bg-white/25 active:scale-[0.97]"
                >
                  {running ? "Pause" : "Start"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRunning(false);
                    setRemaining(suggested != null ? suggested * 60 : null);
                  }}
                  className="rounded-lg bg-white/15 px-3.5 py-1.5 text-sm font-semibold transition hover:bg-white/25 active:scale-[0.97]"
                >
                  Reset
                </button>
              </div>
            )}

            <div className="mt-6 flex gap-2.5">
              <button
                type="button"
                onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                disabled={stepIndex === 0}
                className="flex-1 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/25 active:scale-[0.97] disabled:opacity-40"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setStepIndex((i) => Math.min(total - 1, i + 1))}
                disabled={stepIndex >= total - 1}
                className="flex-1 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 shadow-sm transition hover:bg-white/95 active:scale-[0.97] disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
