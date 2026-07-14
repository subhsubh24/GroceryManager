import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * §44 Layer A — DETERMINISTIC LIVE-PROD SMOKE (self-healing prod validation backbone).
 *
 * CI proves the BUILD compiles; it does NOT prove the DEPLOYED app renders for a real user. A whole
 * class of failure passes green CI and only appears on the live URL: React hydration mismatches
 * (#418/#425), an empty/missing <title>, a broken first paint, a 5xx on the critical path. This suite
 * re-probes those DETERMINISTICALLY (no LLM, no browser-agent) so the same class cannot silently ship.
 *
 * It runs against BASE_URL — localhost by default, the LIVE prod URL when the owner-wired post-deploy /
 * scheduled job sets it — at BOTH mobile AND desktop widths. For every PUBLIC critical route it asserts:
 *   • HTTP 200 (the final navigation response)
 *   • a non-empty, present <title>
 *   • ZERO uncaught page errors
 *   • ZERO React hydration errors (the #418/#425 class), surfaced LOUD
 *   • ZERO other console errors (benign third-party/asset noise filtered explicitly)
 *   • no same-origin 5xx on the critical path
 * …and captures a screenshot artifact per route/width for the vision pass (§44 Layer B) to review.
 *
 * SCOPE — public routes only. Authed prod journeys need a dedicated THROWAWAY prod test account, which
 * the loop never fabricates (§9) — that is an OWNER_ACTION (see PENDING_OPS.md / LOOP_HEALTH). This
 * deterministic backbone covers every no-account surface an outside user hits first.
 *
 * This spec is intentionally NOT in the CI e2e job's filter (that job runs `journeys` + `email-roundtrip`
 * against a throwaway DB). It is the target of the owner-wired live-prod job:
 *   BASE_URL=https://<prod-url> pnpm --filter @gm/web e2e prod-smoke
 */

const SHOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "__screenshots__", "prod-smoke");

/**
 * The no-account critical routes, split by how the PRE-LAUNCH SITE GATE (SITE_GATE_PASSWORD, enforced
 * in middleware.ts + @gm/core/security/site-gate) treats them:
 *
 *  • "public"  — gate-EXEMPT marketing / demo / legal surface (SITE_GATE_EXEMPT). An outside visitor
 *                ALWAYS reaches these, gate on or off → MUST be HTTP 200 and fully healthy. This is the
 *                real acquisition + trust funnel that must never break on live prod.
 *  • "gated"   — the auth surface (`/signin`, `/signup`). PRE-LAUNCH the site gate returns its 401
 *                "Private pre-launch" challenge here (correct + intended); POST-LAUNCH (gate unset) they
 *                render the real form at 200. So we accept status ∈ {200, 401} but STILL require the
 *                rendered page to be healthy — a 401 that ISN'T the recognizable gate challenge fails.
 *
 * Keep in sync with SITE_GATE_EXEMPT in packages/core/src/security/site-gate.ts.
 */
type Tier = "public" | "gated";
const CRITICAL_PUBLIC_ROUTES: { path: string; name: string; tier: Tier }[] = [
  { path: "/", name: "home", tier: "public" },
  { path: "/demo", name: "demo", tier: "public" },
  { path: "/blog", name: "blog", tier: "public" },
  { path: "/help", name: "help", tier: "public" },
  { path: "/privacy", name: "privacy", tier: "public" },
  { path: "/terms", name: "terms", tier: "public" },
  { path: "/signin", name: "signin", tier: "gated" },
  { path: "/signup", name: "signup", tier: "gated" },
];

// The pre-launch site-gate challenge page's stable marker (middleware.ts `challengePage`, <title> +
// copy). A 401 that matches this is the gate working as intended; a 401 that does NOT is a real break.
const SITE_GATE_MARKER = /Private pre-launch/i;

const WIDTHS = [
  { tag: "mobile", width: 390, height: 844 },
  { tag: "desktop", width: 1366, height: 900 },
] as const;

// React hydration / render failures — the exact class that passes CI build but breaks on the live URL.
// Matches dev-mode warnings AND the minified prod React error codes (#418/#423/#425 hydration family).
const HYDRATION_RE =
  /hydrat|did not match|Text content does not match|content did not match|Minified React error #(418|419|421|422|423|425)/i;

// Cosmetic same-origin assets that are NOT on the critical render path — a missing favicon/manifest/icon
// 404 is not a product defect (the minimal pre-launch gate page has no favicon, for instance).
const BENIGN_ASSET_RE = /favicon\.ico|apple-touch-icon|\/manifest\.webmanifest|\/icons\//i;

// Browser-injected console noise that is NOT a JS defect: the generic "Failed to load resource" line
// (network failures are tracked precisely via the response/requestfailed listeners, WITH the URL, where
// same-origin-vs-third-party and benign-asset can actually be judged — the console text carries no URL).
const IGNORED_CONSOLE_RE = /Failed to load resource/i;

type Collected = {
  pageErrors: string[];
  hydrationErrors: string[];
  consoleErrors: string[];
  networkErrors: string[]; // same-origin 5xx OR a same-origin request that failed at the network level
};

/** Attach console/pageerror/response/requestfailed listeners BEFORE navigation so nothing is missed. */
function collect(page: Page, origin: string): Collected {
  const c: Collected = {
    pageErrors: [],
    hydrationErrors: [],
    consoleErrors: [],
    networkErrors: [],
  };
  page.on("pageerror", (err) => {
    const msg = `${err.name}: ${err.message}`;
    if (HYDRATION_RE.test(msg)) c.hydrationErrors.push(msg);
    else c.pageErrors.push(msg);
  });
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (HYDRATION_RE.test(text)) c.hydrationErrors.push(text);
    // Network failures are judged by the listeners below (they have the URL); a bare "Failed to load
    // resource" from the console is dropped here to avoid double-counting cosmetic/third-party misses.
    else if (!IGNORED_CONSOLE_RE.test(text)) c.consoleErrors.push(text);
  });
  // A same-origin server error (5xx) on anything, OR a same-origin sub-resource 4xx (e.g. a stale JS/CSS
  // CHUNK 404 after a redeploy — the single most common post-deploy break this backbone exists to catch),
  // is a failed critical-path request. The navigation DOCUMENT's own status is excluded here because it is
  // asserted per route tier above (a gated /signin correctly returns a 401 document — not a network error).
  page.on("response", (res) => {
    const url = res.url();
    if (!url.startsWith(origin)) return;
    const status = res.status();
    const isDocument = res.request().resourceType() === "document";
    if (status >= 500) {
      c.networkErrors.push(`${status} ${url}`);
    } else if (status >= 400 && !isDocument && !BENIGN_ASSET_RE.test(url)) {
      c.networkErrors.push(`${status} ${url}`);
    }
  });
  // A same-origin request that failed at the NETWORK level (not just a 4xx) — excluding cosmetic assets
  // and ERR_ABORTED (a canceled/superseded request: Next prefetches, client nav, and the main document
  // being aborted by a redirect all log ERR_ABORTED and are NOT genuine failures).
  page.on("requestfailed", (req) => {
    const url = req.url();
    const err = req.failure()?.errorText ?? "";
    if (/ERR_ABORTED/i.test(err)) return;
    if (url.startsWith(origin) && !BENIGN_ASSET_RE.test(url)) {
      c.networkErrors.push(`NETFAIL ${err} ${url}`);
    }
  });
  return c;
}

function baseOrigin(): string {
  const base = process.env.BASE_URL ?? "http://localhost:3000";
  try {
    return new URL(base).origin;
  } catch {
    return "http://localhost:3000";
  }
}

for (const { tag, width, height } of WIDTHS) {
  test.describe(`§44 prod smoke — ${tag}`, () => {
    test.use({ viewport: { width, height } });

    for (const route of CRITICAL_PUBLIC_ROUTES) {
      test(`${route.path} is healthy on live (${tag})`, async ({ page }, info: TestInfo) => {
        const origin = baseOrigin();
        const collected = collect(page, origin);

        // (1) The final navigation response.
        const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
        expect(response, `${route.path} returned no navigation response`).not.toBeNull();
        const status = response!.status();

        if (route.tier === "public") {
          // Gate-exempt marketing/demo/legal surface — an outside visitor must always reach it at 200.
          expect(status, `${route.path} must return HTTP 200 (got ${status})`).toBe(200);
          // And it must NOT bounce to /signin (a redirected auth wall = the surface is broken).
          expect(page.url(), `${route.path} unexpectedly redirected to sign-in`).not.toMatch(
            /\/signin/,
          );
        } else {
          // Auth surface: 200 (gate off / post-launch) OR the 401 pre-launch challenge (gate on).
          expect(
            [200, 401],
            `${route.path} returned an unexpected status ${status} (expected 200, or 401 pre-launch gate)`,
          ).toContain(status);
          if (status === 401) {
            // A 401 is acceptable ONLY when it is the recognizable pre-launch gate — otherwise it's a break.
            const body = await page.content();
            expect(
              SITE_GATE_MARKER.test(body),
              `${route.path} returned 401 but it is NOT the pre-launch site-gate challenge`,
            ).toBe(true);
          }
        }

        // Let hydration + late console errors + fonts settle before asserting.
        await page.waitForLoadState("networkidle").catch(() => {});
        // A brief settle for post-hydration effects that log after networkidle.
        await page.waitForTimeout(250);

        // (3) A non-empty, present <title>.
        const title = (await page.title()).trim();
        expect(title.length, `${route.path} has an empty <title>`).toBeGreaterThan(0);

        // (4) Body actually painted something.
        await expect(page.locator("body"), `${route.path} body not visible`).toBeVisible();

        // (5) ZERO hydration errors — the #418/#425 class, surfaced LOUD.
        expect(
          collected.hydrationErrors,
          `${route.path} produced React hydration errors:\n${collected.hydrationErrors.join("\n")}`,
        ).toEqual([]);

        // (6) ZERO uncaught page errors.
        expect(
          collected.pageErrors,
          `${route.path} threw uncaught errors:\n${collected.pageErrors.join("\n")}`,
        ).toEqual([]);

        // (7) ZERO console errors (benign third-party/asset noise filtered).
        expect(
          collected.consoleErrors,
          `${route.path} logged console errors:\n${collected.consoleErrors.join("\n")}`,
        ).toEqual([]);

        // (8) No failed network request on the critical path (same-origin 5xx or network-level failure).
        expect(
          collected.networkErrors,
          `${route.path} had failed critical-path network requests:\n${collected.networkErrors.join("\n")}`,
        ).toEqual([]);

        // (9) Capture a screenshot artifact for the §44 Layer B vision pass.
        mkdirSync(SHOT_DIR, { recursive: true });
        const shotPath = join(SHOT_DIR, `${route.name}-${tag}.png`);
        await page.screenshot({ path: shotPath, fullPage: true });
        await info.attach(`prod-smoke-${route.name}-${tag}`, {
          path: shotPath,
          contentType: "image/png",
        });
      });
    }
  });
}
