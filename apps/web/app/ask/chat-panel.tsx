"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { MessageCircle } from "@/app/components/icons";
import { askAction } from "./actions";

type ChatMessage = { role: "user" | "assistant"; content: string };

// Starter prompts that prefill + send on tap, to make the empty state immediately useful.
const STARTERS = [
  "How's my spending trending?",
  "What should I cook this week?",
  "What am I wasting money on?",
  "How are my cooking habits?",
];

/**
 * The "Ask your kitchen" chat. A scrollable transcript, a text input with a send button, and starter
 * chips. Sends the full (capped server-side) conversation to the read-only `askAction` and appends
 * the reply. Accessible: a labelled input, an aria-live transcript so new assistant messages are
 * announced, and assistant text rendered with whitespace-pre-wrap (preserves line breaks, no markdown).
 */
export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the latest message in view as the conversation grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;
    setError(null);
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    start(async () => {
      try {
        const { reply } = await askAction(next);
        setMessages((m) => [...m, { role: "assistant", content: reply }]);
      } catch {
        setError("Couldn't reach your kitchen. Please try again.");
      }
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  const empty = messages.length === 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Transcript */}
      <div
        ref={scrollRef}
        aria-live="polite"
        aria-label="Conversation"
        className="card flex max-h-[28rem] min-h-[18rem] flex-col gap-3 overflow-y-auto p-4"
      >
        {empty && (
          <div className="empty-state my-auto">
            <div className="empty-emoji">
              <MessageCircle className="h-6 w-6" strokeWidth={2} />
            </div>
            <p className="text-sm font-medium text-ink-700">Ask me about your kitchen</p>
            <p className="mt-1 max-w-xs text-sm text-ink-400">
              I know your spending, pantry, cooking history, and taste. Try a starter below, or just
              type a question.
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] whitespace-pre-wrap rounded-2xl bg-brand-solid px-3.5 py-2 text-sm text-white shadow-sm"
                  : "max-w-[85%] whitespace-pre-wrap rounded-2xl border border-line bg-cream/60 px-3.5 py-2 text-sm text-ink-800"
              }
            >
              {m.content}
            </div>
          </div>
        ))}

        {pending && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-line bg-cream/60 px-3.5 py-2 text-sm text-ink-400">
              Thinking…
            </div>
          </div>
        )}
      </div>

      {error && <p className="notice-warn">{error}</p>}

      {/* Starter chips */}
      {empty && (
        <div className="flex flex-wrap gap-2">
          {STARTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              disabled={pending}
              className="pill-brand transition hover:scale-[1.02] disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <label htmlFor="ask-input" className="sr-only">
          Ask your kitchen a question
        </label>
        <input
          id="ask-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your spending, pantry, or what to cook…"
          autoComplete="off"
          disabled={pending}
          className="input flex-1"
        />
        <button type="submit" disabled={pending || !input.trim()} className="btn-primary shrink-0">
          {pending ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}
