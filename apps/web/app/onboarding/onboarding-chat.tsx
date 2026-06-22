"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { finishOnboardingAction, onboardingTurnAction, type OnboardingMessage } from "./actions";

/**
 * AI-adaptive conversational onboarding (mobile-first). A full-height chat where a warm host asks ONE
 * adaptive question at a time; each user answer goes to `onboardingTurnAction`, which runs the model,
 * extracts typed preferences into the SAME ledger the app uses, and returns the next reply. When the
 * host decides it has a solid picture (`done`), we reveal a primary "Go to my kitchen →" that calls
 * `finishOnboardingAction` (re-project → redirect("/")). A quiet "Skip for now" finishes immediately.
 *
 * This is a client component — it holds the transcript in one piece of state and never touches
 * `window`/`document` during render, so it hydrates cleanly. The server-only onboarding LLM is reached
 * exclusively through the server actions above; nothing server-only is imported here.
 *
 * iPhone specifics: single column at full dynamic-viewport height, a transcript that scrolls under a
 * bottom-pinned input bar padded for `env(safe-area-inset-bottom)`, 16px+ input text (so iOS Safari
 * doesn't zoom on focus), a ≥44px send target, `enterKeyHint="send"`, and no autofocus (avoids the
 * keyboard yanking the layout up on load).
 */

// The first thing the user sees — a warm welcome + an open first question. Seeded client-side (no
// server round-trip needed to show it), and included in the transcript we send on the first answer.
const GREETING =
  "Let's get you started! 👋 I'll ask a few quick questions so every recipe, plan, and list fits you. " +
  "To kick off — how would you describe the way you eat? (Anything from \"I eat everything\" to a " +
  "specific diet works.)";

type ChatMessage = OnboardingMessage;

export function OnboardingChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: GREETING }]);
  const [input, setInput] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTurn] = useTransition();
  const [finishing, startFinish] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the newest message visible as the transcript grows / the typing dots appear.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  function send(text: string) {
    const content = text.trim();
    if (!content || pending || done) return;
    setError(null);
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    startTurn(async () => {
      try {
        const { reply, done: isDone } = await onboardingTurnAction(next);
        setMessages((m) => [...m, { role: "assistant", content: reply }]);
        if (isDone) setDone(true);
      } catch {
        // The action itself never throws, but guard the client call anyway.
        setError("Hmm, that didn't go through. Mind trying that again?");
      }
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  // Finish (from the "Go to my kitchen" CTA or "Skip for now"): re-project + redirect("/"). The
  // server action throws NEXT_REDIRECT on success — it MUST propagate so the RedirectBoundary
  // navigates. `unstable_rethrow` lets that through; any genuine error surfaces as a recoverable
  // notice (the CTA re-enables once the transition settles, so the user is never stranded).
  function finish() {
    if (finishing) return;
    setError(null);
    startFinish(async () => {
      try {
        await finishOnboardingAction();
      } catch (e) {
        unstable_rethrow(e);
        setError("Couldn't wrap up just now — please try again.");
      }
    });
  }

  return (
    <main className="flex h-dvh w-full flex-col overflow-hidden bg-cream">
      {/* Header — compact, fixed at the top; padded under the notch via the safe-area inset. */}
      <header className="shrink-0 border-b border-line bg-surface pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 px-5 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-lg shadow-brand">
            🧺
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-[-0.01em] text-ink-900">Let&apos;s get you started</p>
            <p className="truncate text-xs text-ink-400">A quick chat to tune things to your taste</p>
          </div>
          <button
            type="button"
            onClick={finish}
            disabled={finishing}
            className="ml-auto shrink-0 text-xs font-medium text-ink-400 transition-colors hover:text-ink-600 disabled:opacity-50"
          >
            Skip for now
          </button>
        </div>
      </header>

      {/* Transcript — the only scrolling region; flexes to fill between header and input bar. */}
      <div
        ref={scrollRef}
        aria-label="Onboarding conversation"
        className="flex flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden px-4 py-5"
      >
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              // Announce only assistant replies (the host's questions), so a screen reader speaks each
              // new question once instead of re-reading the whole transcript on every turn.
              aria-live={m.role === "assistant" ? "polite" : undefined}
              className={
                m.role === "user"
                  ? "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-brand-solid px-4 py-2.5 text-base leading-relaxed text-white shadow-sm"
                  : "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-md border border-line bg-surface px-4 py-2.5 text-base leading-relaxed text-ink-800 shadow-xs"
              }
            >
              {m.content}
            </div>
          </div>
        ))}

        {pending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-line bg-surface px-4 py-3 shadow-xs">
              <Dot className="[animation-delay:-0.3s]" />
              <Dot className="[animation-delay:-0.15s]" />
              <Dot />
            </div>
          </div>
        )}

        {done && (
          <div className="mt-2 flex justify-center">
            <button
              type="button"
              onClick={finish}
              disabled={finishing}
              className="btn-primary min-h-[44px] px-6 text-base shadow-brand"
            >
              {finishing ? "Setting up…" : "Go to my kitchen →"}
            </button>
          </div>
        )}

        {error && (
          <p className="notice-warn mx-auto mt-1 max-w-[85%] text-center">{error}</p>
        )}
      </div>

      {/* Composer — pinned at the bottom, padded above the iPhone home-indicator safe area. Hidden
          once we're done (the CTA takes over) to keep the finish action unambiguous. */}
      {!done && (
        <form
          onSubmit={onSubmit}
          className="flex shrink-0 items-end gap-2 border-t border-line bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <label htmlFor="onboarding-input" className="sr-only">
            Your answer
          </label>
          <input
            id="onboarding-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            // When the iOS keyboard opens it can cover the bottom of the (h-dvh) transcript; after it
            // animates in, snap the newest message back into view so the conversation isn't hidden.
            onFocus={() => {
              setTimeout(() => {
                scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
              }, 300);
            }}
            placeholder="Type your answer…"
            autoComplete="off"
            enterKeyHint="send"
            disabled={pending}
            // text-base = 16px → iOS Safari won't zoom the viewport on focus.
            className="min-h-[44px] flex-1 rounded-2xl border border-line bg-cream px-4 py-2.5 text-base text-ink-900 shadow-xs transition placeholder:text-ink-300 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={pending || !input.trim()}
            className="btn-primary min-h-[44px] min-w-[44px] shrink-0 px-4"
            aria-label="Send"
          >
            {pending ? "…" : "Send"}
          </button>
        </form>
      )}
    </main>
  );
}

/** A single bouncing dot for the "host is typing" indicator (uses Tailwind's built-in bounce). */
function Dot({ className = "" }: { className?: string }) {
  return <span className={`h-2 w-2 animate-bounce rounded-full bg-ink-300 ${className}`} aria-hidden />;
}
