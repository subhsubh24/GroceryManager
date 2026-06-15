"use client";

import { useEffect, useState } from "react";
import {
  removePushSubscriptionAction,
  savePushSubscriptionAction,
  sendTestPushAction,
} from "@/app/lib/push-actions";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** The one client bit on /digest: register the SW + subscribe to web push, storing the subscription. */
export function PushToggle({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
    setSupported(ok);
    if (!ok) return;
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setSubscribed(Boolean(sub)))
      .catch(() => {});
  }, []);

  async function enable() {
    if (!vapidPublicKey) {
      setMsg("Notifications aren't configured yet (no VAPID key).");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setMsg("Permission denied — enable notifications in your browser settings.");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });
      const keys = sub.toJSON().keys;
      if (!keys?.p256dh || !keys?.auth) {
        setMsg("Couldn't read the subscription keys.");
        return;
      }
      await savePushSubscriptionAction({ endpoint: sub.endpoint, p256dh: keys.p256dh, auth: keys.auth });
      setSubscribed(true);
      setMsg("Notifications are on.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't enable notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscriptionAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setMsg("Notifications are off.");
    } catch {
      setMsg("Couldn't turn notifications off.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMsg(null);
    const res = await sendTestPushAction();
    setMsg(res.message);
    setBusy(false);
  }

  return (
    <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-ink">Get this as a notification</h2>
      <p className="mt-0.5 mb-3 text-xs text-ink/50">
        A weekly nudge when something&apos;s expiring or due to reorder — never on a quiet week.
      </p>
      {!supported ? (
        <p className="text-xs text-ink/40">
          This browser doesn&apos;t support web push. On iPhone, add the app to your Home Screen first.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {!subscribed ? (
            <button
              type="button"
              onClick={enable}
              disabled={busy}
              className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50"
            >
              {busy ? "…" : "Enable notifications"}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={test}
                disabled={busy}
                className="rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "…" : "Send a test"}
              </button>
              <button
                type="button"
                onClick={disable}
                disabled={busy}
                className="text-sm font-medium text-ink/50 underline-offset-2 hover:underline"
              >
                Turn off
              </button>
            </>
          )}
        </div>
      )}
      {msg && <p className="mt-3 text-sm text-ink/70">{msg}</p>}
    </section>
  );
}
