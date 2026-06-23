"use client";

import { useState, useTransition } from "react";
import { confirmReviewItems, dismissReviewItems } from "./actions";
import { humanize, timeAgo, titleCase } from "@/app/lib/format";
import { Check, Loader2 } from "@/app/components/icons";

export type ReviewItem = {
  id: string;
  rawText: string;
  canonicalName: string | null;
  matchConfidence: number | null;
  retailer: string;
  purchasedAt: Date | string | null;
};

/**
 * Multi-select review list — tick the real items and Add/Dismiss them in one go instead of clicking
 * each row. The whole card is a checkbox label (tap anywhere), with a select-all + bulk-action bar.
 * Calls the bulk server actions, which revalidate /pantry + /review so the list refreshes.
 */
export function ReviewList({ items }: { items: ReviewItem[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  const sorted = [...items].sort(
    (a, b) => new Date(b.purchasedAt ?? 0).getTime() - new Date(a.purchasedAt ?? 0).getTime(),
  );
  const allSelected = items.length > 0 && selected.size === items.length;

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)));

  function run(action: (ids: string[]) => Promise<void>) {
    if (selected.size === 0 || pending) return;
    const chosen = [...selected];
    start(async () => {
      await action(chosen);
      setSelected(new Set());
    });
  }

  return (
    <div>
      {/* Bulk action bar */}
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2 shadow-xs">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-ink-700">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} className="control-accent" />
          {selected.size > 0 ? `${selected.size} selected` : "Select all"}
        </label>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            disabled={selected.size === 0 || pending}
            onClick={() => run(confirmReviewItems)}
            className="btn-primary btn-sm"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : <Check className="h-4 w-4" strokeWidth={2} />}
            Add to pantry
          </button>
          <button
            type="button"
            disabled={selected.size === 0 || pending}
            onClick={() => run(dismissReviewItems)}
            className="btn-ghost btn-sm"
          >
            Not mine / expired
          </button>
        </div>
      </div>

      <ul className="space-y-2.5">
        {sorted.map((r) => {
          const on = selected.has(r.id);
          return (
            <li key={r.id}>
              <label
                className={`card flex cursor-pointer gap-3 p-4 transition-shadow ${on ? "ring-2 ring-brand-400" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(r.id)}
                  className="control-accent mt-1 shrink-0"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink-900">
                    {titleCase(r.canonicalName ?? r.rawText)}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-400">
                    {humanize(r.retailer)} · {timeAgo(r.purchasedAt)}
                    {r.matchConfidence != null ? ` · ${Math.round(r.matchConfidence * 100)}% sure` : ""}
                  </span>
                  <span className="mt-1 block truncate text-xs text-ink-300" title={r.rawText}>
                    {r.rawText}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
