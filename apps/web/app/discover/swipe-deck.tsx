"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SaveButton } from "@/app/cookbook/save-button";
import { recordSwipeAction } from "./actions";

export type DeckCard = {
  id: string;
  title: string;
  imageUrl?: string;
  cuisine?: string;
  haveCount?: number;
  totalCore?: number;
};

type Decided = { card: DeckCard; dir: "like" | "skip" };

/**
 * The Discover deck. PRIMARY interaction is the big Skip/Like buttons and the ←/→ keys; pointer-drag
 * is a progressive enhancement layered on top that can never be *required* and must never wedge the
 * UI — every drag path falls back to the same `decide()` the buttons call, and a stuck drag simply
 * springs back. Each decision fires recordSwipeAction (fire-and-forget; the result is ignored for UX
 * speed) and advances to the next card with a brief CSS transition.
 */
export function SwipeDeck({ deck }: { deck: DeckCard[] }) {
  const [index, setIndex] = useState(0);
  const [last, setLast] = useState<Decided | null>(null);
  // Exit animation direction for the leaving top card ("like" → right, "skip" → left).
  const [leaving, setLeaving] = useState<"like" | "skip" | null>(null);
  // Live drag offset (px) + rotation for the top card; null when not dragging. CSS-only visuals.
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);

  const top = deck[index];
  const peek = deck.slice(index + 1, index + 3); // 1–2 cards behind for depth
  const done = index >= deck.length;

  // Guards so a decision can't double-fire (rapid keys / button + drag racing the transition).
  const animatingRef = useRef(false);
  const dragStateRef = useRef<{ startX: number; startY: number; pointerId: number } | null>(null);

  const decide = useCallback(
    (card: DeckCard | undefined, dir: "like" | "skip") => {
      if (!card || animatingRef.current) return;
      animatingRef.current = true;
      setLeaving(dir);
      setDrag(null);
      dragStateRef.current = null;

      // Fire-and-forget: train the model but never block the UI on the network.
      void recordSwipeAction({ recipeId: card.id, cuisine: card.cuisine, dir }).catch(() => {});

      // Advance after a short exit transition; remember the last like for follow-up CTAs.
      window.setTimeout(() => {
        setIndex((i) => i + 1);
        setLeaving(null);
        setLast(dir === "like" ? { card, dir } : null);
        animatingRef.current = false;
      }, 220);
    },
    [],
  );

  // Keyboard: ← = skip, → = like. Ignore when a modifier is held or focus is in a text field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        decide(deck[index], "skip");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        decide(deck[index], "like");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deck, index, decide]);

  // ---- Pointer-drag: progressive enhancement only. Guarded so it can never block the buttons. ----
  const SWIPE_THRESHOLD = 110; // px past which a release commits to like/skip

  function onPointerDown(e: React.PointerEvent) {
    if (animatingRef.current || !top) return;
    dragStateRef.current = { startX: e.clientX, startY: e.clientY, pointerId: e.pointerId };
    setDrag({ x: 0, y: 0 });
    // Best-effort capture; if it throws (unsupported) we still work via buttons/keys.
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore — drag is optional */
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const s = dragStateRef.current;
    if (!s || s.pointerId !== e.pointerId) return;
    setDrag({ x: e.clientX - s.startX, y: e.clientY - s.startY });
  }

  function endDrag(e: React.PointerEvent) {
    const s = dragStateRef.current;
    if (!s || s.pointerId !== e.pointerId) return;
    const dx = e.clientX - s.startX;
    dragStateRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (dx > SWIPE_THRESHOLD) decide(top, "like");
    else if (dx < -SWIPE_THRESHOLD) decide(top, "skip");
    else setDrag(null); // spring back — below threshold or a stray gesture
  }

  // Top-card transform: while dragging follow the pointer; while leaving fling off-screen; else rest.
  function topStyle(): React.CSSProperties {
    if (leaving) {
      const dir = leaving === "like" ? 1 : -1;
      return {
        transform: `translateX(${dir * 140}%) rotate(${dir * 18}deg)`,
        opacity: 0,
        transition: "transform 220ms ease-in, opacity 220ms ease-in",
      };
    }
    if (drag) {
      const rot = Math.max(-16, Math.min(16, drag.x / 12));
      return { transform: `translate(${drag.x}px, ${drag.y}px) rotate(${rot}deg)`, transition: "none" };
    }
    return { transform: "translate(0,0) rotate(0deg)", transition: "transform 200ms ease-out" };
  }

  // Like/skip intent hint while dragging (drives the badge opacity on the card).
  const dragIntent = drag ? (drag.x > 40 ? "like" : drag.x < -40 ? "skip" : null) : null;

  if (done) {
    return (
      <div className="empty-state mt-2">
        <div className="empty-emoji">🎉</div>
        <p className="text-sm font-medium text-ink-700">You&apos;re all caught up</p>
        <p className="mt-1 max-w-xs text-sm text-ink-400">
          Come back later for fresh ideas — or refine your taste so the next batch fits even better.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <a href="/onboarding" className="btn-primary btn-sm">
            Refine my taste
          </a>
          <a href="/recipes" className="btn-ghost btn-sm">
            Cook tonight
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      {/* Card stack. aria-live announces the current card title for screen readers. */}
      <div className="relative h-[26rem]" aria-live="polite">
        {/* Peek cards behind, for depth (CSS only, non-interactive). */}
        {peek
          .map((c, i) => {
            const depth = i + 1;
            return (
              <div
                key={c.id}
                aria-hidden
                className="absolute inset-0 overflow-hidden rounded-3xl border border-line bg-surface shadow-lift"
                style={{
                  transform: `translateY(${depth * 10}px) scale(${1 - depth * 0.04})`,
                  zIndex: 1,
                  opacity: 1 - depth * 0.15,
                }}
              />
            );
          })
          .reverse()}

        {/* Top (interactive) card. */}
        {top && (
          <div
            className="absolute inset-0 cursor-grab touch-none select-none overflow-hidden rounded-3xl border border-line bg-surface shadow-lift-lg active:cursor-grabbing"
            style={{ zIndex: 2, ...topStyle() }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <div className="relative h-56 w-full bg-cream">
              {top.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={top.imageUrl}
                  alt=""
                  draggable={false}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-5xl">🍽️</div>
              )}
              {/* Drag intent badges (LIKE / SKIP) — purely visual feedback during a drag. */}
              <span
                aria-hidden
                className="absolute left-4 top-4 rounded-xl border-2 border-brand-500 px-3 py-1 text-lg font-extrabold uppercase tracking-wide text-brand-600 transition-opacity"
                style={{ opacity: dragIntent === "like" ? 1 : 0, transform: "rotate(-12deg)" }}
              >
                Like
              </span>
              <span
                aria-hidden
                className="absolute right-4 top-4 rounded-xl border-2 border-berry-500 px-3 py-1 text-lg font-extrabold uppercase tracking-wide text-berry-600 transition-opacity"
                style={{ opacity: dragIntent === "skip" ? 1 : 0, transform: "rotate(12deg)" }}
              >
                Skip
              </span>
            </div>
            <div className="p-5">
              <div className="text-lg font-semibold text-ink-900">{top.title}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-400">
                {top.cuisine && <span className="pill-success capitalize">{top.cuisine}</span>}
                {typeof top.haveCount === "number" && typeof top.totalCore === "number" && (
                  <span>
                    have {top.haveCount}/{top.totalCore}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PRIMARY controls — always present and fully functional without any gesture. */}
      <div className="mt-6 flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={() => decide(top, "skip")}
          aria-label="Skip this recipe"
          title="Skip (←)"
          className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-surface text-2xl shadow-sm transition hover:border-ink-300 active:scale-95"
        >
          <span aria-hidden>✕</span>
        </button>
        <button
          type="button"
          onClick={() => decide(top, "like")}
          aria-label="Like this recipe"
          title="Like (→)"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-solid text-2xl text-white shadow-sm transition active:scale-95"
        >
          <span aria-hidden>❤️</span>
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-ink-400">
        Tap a button, use ← / → keys, or swipe the card.
      </p>

      {/* After a like, surface quick follow-ups for the recipe just liked. */}
      {last && last.dir === "like" && (
        <div className="card mt-6 p-4">
          <div className="text-xs font-medium text-ink-400">You liked</div>
          <div className="mt-0.5 truncate font-medium text-ink-900">{last.card.title}</div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <a href={`/cook/${last.card.id}`} className="text-xs font-medium text-brand-700">
              Cook mode →
            </a>
            <a href={`/remix/${last.card.id}`} className="text-xs font-medium text-grape-700">
              Remix ✨
            </a>
            <SaveButton
              recipe={{
                id: last.card.id,
                title: last.card.title,
                imageUrl: last.card.imageUrl,
                cuisine: last.card.cuisine,
              }}
              initialSaved={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}
