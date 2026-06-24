import { revalidatePath } from "next/cache";
import { loadEnv } from "@gm/config/env";
import { getActiveListView, getDb, withTenant } from "@gm/db";
import { captureToList, parseQuickCapture } from "@gm/core/capture";
import { parseCaptureWithLLM } from "@gm/core/capture/parse-llm";
import { GeminiClient } from "@gm/core/llm";
import { currentUserId } from "@/app/lib/tenant";
import { titleCase, humanize } from "@/app/lib/format";
import { PageHeader } from "@/app/components/page-header";
import { OnboardingFinish } from "@/app/components/onboarding-finish";
import { PencilLine, ShoppingCart } from "@/app/components/icons";
import { CaptureForm } from "./capture-form";

export const dynamic = "force-dynamic";

async function capture(formData: FormData) {
  "use server";
  const text = String(formData.get("text") ?? "");
  // LLM-validate the free text (fix typos, drop brands/filler, structure quantities) when a Gemini key
  // is set; fall back to the deterministic parser on any failure or with no key, so it always works.
  const env = loadEnv();
  const llm = env.GEMINI_API_KEY || env.GOOGLE_VERTEX_PROJECT ? new GeminiClient(env) : null;
  const items = llm
    ? await parseCaptureWithLLM(llm, text).catch(() => parseQuickCapture(text))
    : parseQuickCapture(text);
  if (items.length === 0) return;
  const userId = await currentUserId();
  if (!userId) return;
  await withTenant(getDb(), userId, (tx) => captureToList(tx, userId, items));
  revalidatePath("/capture");
}

async function load() {
  try {
    const userId = await currentUserId();
    if (!userId) return { ready: false as const, error: null as string | null, items: [] };
    const items = await withTenant(getDb(), userId, (tx) => getActiveListView(tx, userId));
    return { ready: true as const, error: null as string | null, items };
  } catch (e) {
    return { ready: false as const, error: e instanceof Error ? e.message : String(e), items: [] };
  }
}

const REASON_LABEL: Record<string, string> = {
  manual: "added",
  predicted_runout: "running low",
  recipe_need: "recipe",
  low_stock: "low",
};

export default async function CapturePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const data = await load();
  const sp = await searchParams;

  return (
    <main className="page">
      <PageHeader
        accent="citrus"
        icon={PencilLine}
        eyebrow="Quick add"
        title="Quick add"
        subtitle={
          <>
            Just type it like you&apos;d say it — &ldquo;we&apos;re out of olive oil and need 2 lbs
            chicken, some spinach.&rdquo; We&apos;ll sort it onto your list.
          </>
        }
        back={{ href: "/list", label: "Reorder" }}
      />

      {sp.from === "onboarding" && <OnboardingFinish />}

      <CaptureForm action={capture} />

      {!data.ready && (
        <p className="notice-warn">
          Couldn&apos;t reach the database.
        </p>
      )}

      {data.ready && (
        <section>
          <h2 className="section-title mb-3">On your list</h2>
          {data.items.length === 0 ? (
            <div className="empty-state mt-6">
              <div className="empty-emoji">
                <ShoppingCart className="h-6 w-6" strokeWidth={2} />
              </div>
              <p className="text-sm font-medium text-ink-700">Nothing yet</p>
              <p className="mt-1 max-w-xs text-sm text-ink-400">Add a few things above.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {data.items.map((i) => (
                <li key={i.id} className="row">
                  <span className={`text-ink-900 ${i.checked ? "line-through opacity-50" : ""}`}>{titleCase(i.name)}</span>
                  <span className="pill-brand">
                    {REASON_LABEL[i.reason] ?? humanize(i.reason)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
