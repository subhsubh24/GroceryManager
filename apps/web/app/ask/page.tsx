import { PageHeader } from "@/app/components/page-header";
import { MessageCircle } from "@/app/components/icons";
import { ChatPanel } from "./chat-panel";

export const dynamic = "force-dynamic";

/**
 * "Ask your kitchen" — a conversational assistant grounded in the user's own data. The page renders
 * regardless of whether a Gemini key is configured; without one, the chat still answers from
 * pre-computed stats (and we show a small notice that full chat needs a key). All work happens in the
 * read-only, session-scoped `askAction` server action that <ChatPanel> calls.
 */
export default function AskPage() {
  const hasKey = Boolean(process.env.GEMINI_API_KEY);

  return (
    <main className="page">
      <PageHeader
        accent="grape"
        icon={MessageCircle}
        eyebrow="Ask"
        title="Ask your kitchen"
        subtitle="Chat about your habits, spending, and what to cook — grounded in your data."
      />

      {!hasKey && (
        <p className="notice-warn mt-6">
          Full conversational chat needs a Gemini API key. Until one is configured, answers come from
          your pre-computed stats.
        </p>
      )}

      <div className="mt-6">
        <ChatPanel />
      </div>
    </main>
  );
}
