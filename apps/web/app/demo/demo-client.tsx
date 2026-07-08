"use client";

import { useState } from "react";
import {
  ArrowRight,
  Camera,
  Check,
  ClipboardPaste,
  Loader2,
  ReceiptText,
} from "@/app/components/icons";
import { Turnstile } from "@/app/components/turnstile";
import { humanize, titleCase } from "@/app/lib/format";
import { trackEvent } from "@/app/lib/plausible";

/**
 * The public "try the aha" demo (ROADMAP §34): paste or snap a grocery receipt and watch it become a
 * pantry list — no account. Posts to the hardened `/api/public/parse-receipt` endpoint (rate-limit +
 * captcha + per-IP/global spend ceiling). SIDE-EFFECT INTEGRITY: we only ever show a real parsed
 * result returned by the server; a failure shows an honest error, never a fabricated list.
 */

interface DemoItem {
  name: string;
  quantity: number | null;
  unit: string | null;
}

type Mode = "paste" | "photo";

// A realistic, fully synthetic grocery receipt so a first-time visitor can hit the aha instantly
// without hunting for their own receipt. No real store/person; plausible items + prices.
const SAMPLE_RECEIPT = `WHOLE FOODS MARKET
365 Organic Whole Milk 1 GAL      5.49
Organic Large Brown Eggs 12 CT    4.99
Haas Avocado                      1.29
Haas Avocado                      1.29
Organic Baby Spinach 5 OZ         3.49
Boneless Chicken Breast 1.82 LB   9.08
Sourdough Boule                   4.50
Sharp Cheddar 8 OZ                5.29
Roma Tomato 1.14 LB               2.16
Extra Virgin Olive Oil 500ML      12.99
SUBTOTAL                          50.57
TAX                                0.00
TOTAL                             50.57`;

function pantryLine(item: DemoItem): string {
  const qty =
    item.quantity != null
      ? `${item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(2)}${item.unit ? ` ${item.unit}` : ""}`
      : item.unit ?? "";
  return qty ? `${titleCase(item.name)} · ${qty}` : titleCase(item.name);
}

export function DemoClient() {
  const [mode, setMode] = useState<Mode>("paste");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [items, setItems] = useState<DemoItem[]>([]);
  const [retailer, setRetailer] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [limited, setLimited] = useState(false);

  async function run() {
    setStatus("loading");
    setError("");
    setLimited(false);
    trackEvent("demo_try", { mode });

    try {
      let res: Response;
      if (mode === "photo") {
        if (!file) {
          setStatus("error");
          setError("Choose a photo of a receipt first.");
          return;
        }
        const form = new FormData();
        form.append("photo", file);
        if (token) form.append("cf-turnstile-response", token);
        res = await fetch("/api/public/parse-receipt", { method: "POST", body: form });
      } else {
        if (!text.trim()) {
          setStatus("error");
          setError("Paste some receipt text first, or load the sample.");
          return;
        }
        res = await fetch("/api/public/parse-receipt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, captchaToken: token || undefined }),
        });
      }

      const data = (await res.json().catch(() => ({}))) as {
        items?: DemoItem[];
        retailer?: string;
        error?: string;
        limited?: boolean;
      };

      if (!res.ok || !data.items) {
        setStatus("error");
        setLimited(Boolean(data.limited));
        setError(data.error ?? "Something went wrong — please try again.");
        return;
      }
      setItems(data.items);
      setRetailer(data.retailer ?? null);
      setStatus("done");
      trackEvent("demo_success", { items: data.items.length });
    } catch {
      setStatus("error");
      setError("Couldn't reach the demo — check your connection and try again.");
    }
  }

  return (
    <div className="card card-pad">
      {/* Mode toggle */}
      <div className="flex gap-2" role="tablist" aria-label="Try with">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "paste"}
          onClick={() => setMode("paste")}
          className={mode === "paste" ? "chip-tap chip-tap-on" : "chip-tap"}
        >
          <ClipboardPaste className="h-4 w-4" aria-hidden />
          Paste text
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "photo"}
          onClick={() => setMode("photo")}
          className={mode === "photo" ? "chip-tap chip-tap-on" : "chip-tap"}
        >
          <Camera className="h-4 w-4" aria-hidden />
          Upload photo
        </button>
      </div>

      <div className="mt-4">
        {mode === "paste" ? (
          <div className="grid gap-2">
            <label htmlFor="demo-text" className="sr-only">
              Receipt text
            </label>
            <textarea
              id="demo-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder="Paste the text of a grocery receipt…"
              className="input font-mono text-xs leading-relaxed"
            />
            <button
              type="button"
              onClick={() => setText(SAMPLE_RECEIPT)}
              className="justify-self-start text-sm font-medium text-brand-700 underline-offset-2 hover:underline"
            >
              Load a sample receipt
            </button>
          </div>
        ) : (
          <div className="grid gap-2">
            <label htmlFor="demo-photo" className="sr-only">
              Receipt photo
            </label>
            <input
              id="demo-photo"
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="input-file"
            />
            <p className="text-xs text-ink-400">A clear, well-lit photo works best. Under 2 MB.</p>
          </div>
        )}
      </div>

      {/* G5 bot protection — renders nothing unless a Turnstile site key is configured. */}
      <div className="mt-3">
        <Turnstile action="demo" onToken={setToken} />
      </div>

      <button
        type="button"
        onClick={run}
        disabled={status === "loading"}
        className="btn-primary mt-4 w-full px-5 py-3 text-base disabled:opacity-60"
      >
        {status === "loading" ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Reading your receipt…
          </>
        ) : (
          <>
            <ReceiptText className="h-5 w-5" aria-hidden />
            See my pantry
          </>
        )}
      </button>

      {status === "error" && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger-ink"
        >
          {error}
          {limited && (
            <a href="/#waitlist" className="ml-1 font-semibold underline underline-offset-2">
              Join the waitlist →
            </a>
          )}
        </div>
      )}

      {status === "done" && (
        <div className="mt-5">
          <div className="flex items-center gap-2 text-sm font-medium text-brand-700">
            <Check className="h-5 w-5 shrink-0 text-brand-600" strokeWidth={2.5} aria-hidden />
            {items.length} item{items.length === 1 ? "" : "s"} found on your receipt
            {retailer && retailer !== "other" ? ` · ${humanize(retailer)}` : ""}
          </div>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line">
            {items.map((item, i) => (
              <li key={i} className="flex items-center gap-2 bg-surface px-4 py-2.5 text-sm text-ink-800">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" aria-hidden />
                {pantryLine(item)}
              </li>
            ))}
          </ul>

          <div className="panel-brand mt-5">
            <h3 className="text-lg font-semibold tracking-[-0.01em]">
              That&apos;s the first 10 seconds.
            </h3>
            <p className="mt-1 text-[0.95rem] leading-relaxed text-white/90">
              The real app keeps this pantry current — predicting run-outs, suggesting meals from what
              you have, and building your next grocery list automatically.
            </p>
            <a
              href="/#waitlist"
              onClick={() => trackEvent("demo_to_waitlist")}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 shadow-sm transition hover:bg-white/90"
            >
              Join the waitlist
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
