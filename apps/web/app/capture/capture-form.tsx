"use client";

import { useEffect, useRef, useState } from "react";
// Import the leaf module (not the @gm/core/capture barrel) so the client bundle doesn't pull in the
// server-only DB code in capture/add.ts. cleanTranscript is pure.
import { cleanTranscript } from "@gm/core/capture/parse";

/**
 * The quick-add form, now controlled so the optional mic can merge a dictated transcript into the
 * same field the user types into. The submit path is unchanged: it still posts `name="text"` to the
 * `capture` server action passed in from the page. Voice is purely additive — typing always works,
 * and the mic button only renders when the browser exposes the Web Speech API.
 */

// SpeechRecognition isn't reliably in TS 5.6's lib.dom — narrow it locally + feature-detect at
// runtime (same approach cook-mode.tsx uses for Wake Lock). Only the surface we touch is modelled.
type SpeechRecognitionResultLike = { 0: { transcript: string }; isFinal: boolean };
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
};

export function CaptureForm({ action }: { action: (formData: FormData) => void }) {
  const [text, setText] = useState("");
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // The field value at the moment dictation started, so interim results merge instead of clobber.
  const baseTextRef = useRef("");

  // SSR-safe feature detection: only touch `window` after mount.
  useEffect(() => {
    const w = window as SpeechWindow;
    setSupported(Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition));
  }, []);

  // Tear down any live recognition on unmount.
  useEffect(() => {
    return () => {
      const rec = recognitionRef.current;
      if (rec) {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        try {
          rec.abort();
        } catch {
          /* already stopped — ignore */
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  const stopListening = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
  };

  const startListening = () => {
    setHint(null);
    const w = window as SpeechWindow;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;

    let rec: SpeechRecognitionLike;
    try {
      rec = new Ctor();
    } catch {
      setHint("Couldn't start the mic.");
      return;
    }
    rec.lang = navigator.language || "en-US";
    rec.interimResults = true;
    rec.continuous = false;

    // Snapshot the current text so the spoken words append to whatever's already typed.
    baseTextRef.current = text ? `${text.replace(/\s+$/, "")} ` : "";

    rec.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i]?.[0]?.transcript ?? "";
      }
      setText(cleanTranscript(baseTextRef.current + transcript));
    };
    rec.onerror = () => {
      setHint("Couldn't hear that — try again or type it.");
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setHint("Couldn't start the mic.");
      setListening(false);
      recognitionRef.current = null;
    }
  };

  const toggleListening = () => {
    if (listening) stopListening();
    else startListening();
  };

  return (
    <form action={action} className="mt-6 mb-8">
      <div className="relative">
        <textarea
          name="text"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="What you need or used"
          placeholder="we're out of milk and need taco stuff…"
          className="input"
        />
        {supported && (
          <button
            type="button"
            onClick={toggleListening}
            aria-pressed={listening}
            aria-label={listening ? "Stop dictating" : "Dictate"}
            title={listening ? "Stop dictating" : "Dictate"}
            className={`btn-ghost btn-sm absolute right-2 top-2 !rounded-full !p-0 min-h-[44px] min-w-[44px] ${
              listening ? "!border-brand-300 !bg-brand-50 !text-brand-600" : ""
            }`}
          >
            <MicIcon listening={listening} />
          </button>
        )}
      </div>

      {listening && (
        <p className="field-hint flex items-center gap-1.5 text-brand-600">
          <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse" aria-hidden />
          Listening…
        </p>
      )}
      {!listening && hint && <p className="field-hint text-ink-400">{hint}</p>}

      <button type="submit" className="btn-primary mt-3">
        Add to list
      </button>
    </form>
  );
}

function MicIcon({ listening }: { listening: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={listening ? "animate-pulse" : ""}
    >
      <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <line x1="12" y1="18" x2="12" y2="22" />
    </svg>
  );
}
