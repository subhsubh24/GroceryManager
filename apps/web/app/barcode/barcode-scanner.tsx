"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "@/app/components/icons";

/**
 * Scan a barcode with the camera (where supported) or type the UPC by hand (always). The manual
 * input is the full fallback: if BarcodeDetector or the camera is unavailable/denied, typing the
 * number still looks it up and adds it. Both paths call the same `addAction` server action.
 *
 * BarcodeDetector + getUserMedia aren't in TS 5.6's lib.dom, so — like cook-mode.tsx does for Wake
 * Lock — we narrow only the surface we touch with local interfaces (no `any`, no new deps) and
 * feature-detect at runtime.
 */

type DetectedBarcode = { rawValue: string };
interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;
type BarcodeWindow = Window & { BarcodeDetector?: BarcodeDetectorCtor };

type AddResult = { ok: boolean; name?: string; reason?: string };
type AddAction = (upc: string) => Promise<AddResult>;

// The barcode symbologies a grocery UPC/EAN can use.
const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

type Status =
  | { kind: "idle" }
  | { kind: "scanning" }
  | { kind: "looking" }
  | { kind: "added"; name: string }
  | { kind: "notfound" }
  | { kind: "denied" }
  | { kind: "error"; message: string };

export function BarcodeScanner({ addAction }: { addAction: AddAction }) {
  const [supported, setSupported] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [upc, setUpc] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const rafRef = useRef<number | null>(null);
  // Guards against firing the lookup twice for the same on-screen frame.
  const handledRef = useRef(false);

  // SSR-safe feature detection: only touch `window` after mount.
  useEffect(() => {
    setSupported("BarcodeDetector" in window);
  }, []);

  // Stop the camera + detect loop. Stable across renders so the unmount cleanup can call it.
  const stopCamera = useRef(() => {});
  stopCamera.current = () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    detectorRef.current = null;
    setCameraOn(false);
  };

  // Tear the stream/loop down on unmount.
  useEffect(() => () => stopCamera.current(), []);

  const submitCode = async (code: string) => {
    setStatus({ kind: "looking" });
    try {
      const result = await addAction(code);
      if (result.ok && result.name) setStatus({ kind: "added", name: result.name });
      else if (result.reason === "notfound") setStatus({ kind: "notfound" });
      else if (result.reason === "invalid")
        setStatus({ kind: "error", message: "That doesn't look like a barcode number." });
      else if (result.reason === "auth")
        setStatus({ kind: "error", message: "Please sign in to add to your list." });
      else setStatus({ kind: "error", message: "Something went wrong — try again." });
    } catch {
      setStatus({ kind: "error", message: "Something went wrong — try again." });
    }
  };

  const startCamera = async () => {
    setStatus({ kind: "scanning" });
    handledRef.current = false;
    const w = window as BarcodeWindow;
    const Ctor = w.BarcodeDetector;
    if (!Ctor) {
      setStatus({ kind: "error", message: "Camera unavailable — type the number below." });
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus({ kind: "error", message: "Camera unavailable — type the number below." });
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    } catch {
      // Permission denied or no camera — manual entry below still works.
      setStatus({ kind: "denied" });
      return;
    }

    streamRef.current = stream;
    setCameraOn(true);
    const video = videoRef.current;
    if (!video) {
      stopCamera.current();
      return;
    }
    video.srcObject = stream;
    try {
      await video.play();
    } catch {
      /* autoplay can reject silently — the detect loop still reads frames */
    }

    try {
      detectorRef.current = new Ctor({ formats: FORMATS });
    } catch {
      stopCamera.current();
      setStatus({ kind: "error", message: "Camera unavailable — type the number below." });
      return;
    }

    const tick = async () => {
      const detector = detectorRef.current;
      const v = videoRef.current;
      if (!detector || !v || handledRef.current) return;
      try {
        const codes = await detector.detect(v);
        const value = codes[0]?.rawValue?.trim();
        if (value && !handledRef.current) {
          handledRef.current = true;
          stopCamera.current();
          setUpc(value);
          await submitCode(value);
          return;
        }
      } catch {
        /* transient decode error — keep scanning */
      }
      if (!handledRef.current) rafRef.current = requestAnimationFrame(() => void tick());
    };
    rafRef.current = requestAnimationFrame(() => void tick());
  };

  const onManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = upc.trim();
    if (!code) return;
    stopCamera.current();
    void submitCode(code);
  };

  return (
    <div className="mt-6 space-y-6">
      {supported && (
        <section className="card-pad">
          <h2 className="section-title mb-3">Scan with your camera</h2>
          {cameraOn ? (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="aspect-[4/3] w-full rounded-2xl bg-ink-900 object-cover"
              />
              <button type="button" onClick={() => stopCamera.current()} className="btn-secondary mt-3">
                Stop camera
              </button>
              <p className="field-hint text-ink-400">Line the barcode up inside the frame.</p>
            </>
          ) : (
            <button type="button" onClick={() => void startCamera()} className="btn-primary">
              Start camera
            </button>
          )}
        </section>
      )}

      <section className="card-pad">
        <h2 className="section-title mb-3">{supported ? "Or type the number" : "Type the barcode number"}</h2>
        <form onSubmit={onManualSubmit}>
          <input
            inputMode="numeric"
            pattern="\d*"
            autoComplete="off"
            value={upc}
            onChange={(e) => setUpc(e.target.value)}
            placeholder="e.g. 036000291452"
            className="input"
            aria-label="Barcode / UPC number"
          />
          <button type="submit" className="btn-primary mt-3" disabled={status.kind === "looking"}>
            {status.kind === "looking" ? "Looking up…" : "Look up & add"}
          </button>
        </form>
        {!supported && (
          <p className="field-hint text-ink-400">
            Your browser can&apos;t scan with the camera — type the number under the barcode instead.
          </p>
        )}
      </section>

      <StatusBanner status={status} />
    </div>
  );
}

function StatusBanner({ status }: { status: Status }) {
  if (status.kind === "added")
    return (
      <p className="notice-ok flex items-center gap-1.5">
        <Check className="h-4 w-4 shrink-0" strokeWidth={2} /> Added {status.name} to your list
      </p>
    );
  if (status.kind === "looking")
    return <p className="field-hint text-brand-600">Looking it up…</p>;
  if (status.kind === "notfound")
    return <p className="notice-warn">Couldn&apos;t find that barcode. Try typing the number, or add it from Quick add.</p>;
  if (status.kind === "denied")
    return <p className="notice-warn">Camera unavailable — type the number below.</p>;
  if (status.kind === "error") return <p className="notice-warn">{status.message}</p>;
  return null;
}
