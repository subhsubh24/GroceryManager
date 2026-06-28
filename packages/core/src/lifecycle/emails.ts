/**
 * Lifecycle email builders (pure) — H14 month-3 annual-nudge + H15 win-back.
 *
 * These produce the subject/html/text for the lifecycle campaigns. They are PURE (no I/O), so the
 * cron route stays a thin orchestrator and the copy is unit-tested. Every claim here corresponds to
 * a real, shipped, default-on capability or the real billing config (anti-overclaim): the annual
 * plan ($39.99/yr) and the free core loop both exist; NO discount/coupon is promised because none is
 * wired into checkout — variants change FRAMING only, never the offer.
 *
 * Prices are the single source of truth for the copy and must match the billing config + /upgrade.
 */

export type LifecycleCampaign = "h14_annual_nudge" | "h15_winback";

export interface LifecycleEmailInput {
  /** Display name for the greeting; falls back to a friendly generic when null/blank. */
  name: string | null;
  /** App base URL (no trailing slash), e.g. https://grocerymanager.app. */
  appUrl: string;
  /** Token-signed unsubscribe URL (CAN-SPAM); rendered in the footer + List-Unsubscribe header. */
  unsubscribeUrl: string;
  /** Experiment variant id from the registry. Unknown/absent → the control framing. */
  variant?: string;
}

export interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}

// Real pricing — keep in sync with @gm/core/billing SUBSCRIPTION_PLANS + /upgrade.
const MONTHLY_USD = 4.99;
const ANNUAL_USD = 39.99;
const ANNUAL_PER_MONTH = ANNUAL_USD / 12; // $3.33
const ANNUAL_SAVINGS = Math.round(MONTHLY_USD * 12 - ANNUAL_USD); // ~$20

const BRAND = "#0c8a3e";
const INK = "#1d2530";
const MUTED = "#525d6a";

function greeting(name: string | null): string {
  const n = (name ?? "").trim();
  return n.length > 0 ? `Hi ${n},` : "Hi there,";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Minimal, on-brand HTML shell with inline styles (email clients ignore <style>).
 * CONTRACT: `bodyHtml` is raw HTML — the CALLER must `escapeHtml()` every dynamic value it
 * interpolates (the builders below escape `name` + `lead`; prices are numeric). `heading`,
 * `ctaLabel`, `ctaUrl`, and `unsubscribeUrl` are escaped here.
 */
function shell(opts: { heading: string; bodyHtml: string; ctaLabel: string; ctaUrl: string; unsubscribeUrl: string }): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f6f7f8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f8;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e6e8ea;">
        <tr><td style="padding:28px 28px 8px;">
          <p style="margin:0 0 16px;font:600 15px/1.2 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${BRAND};letter-spacing:.2px;">GroceryManager</p>
          <h1 style="margin:0 0 14px;font:700 22px/1.25 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK};">${escapeHtml(opts.heading)}</h1>
          <div style="font:400 15px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK};">${opts.bodyHtml}</div>
        </td></tr>
        <tr><td style="padding:8px 28px 28px;">
          <a href="${escapeHtml(opts.ctaUrl)}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font:600 15px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:13px 22px;border-radius:10px;">${escapeHtml(opts.ctaLabel)}</a>
        </td></tr>
        <tr><td style="padding:0 28px 26px;">
          <p style="margin:0;font:400 12px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${MUTED};">You're receiving this because you have a GroceryManager account. <a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:${MUTED};">Unsubscribe</a>.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/**
 * H14 — month-3 annual-conversion nudge for active MONTHLY subscribers.
 * Variant "savings" leads with the dollar saving; control leads with the routine framing.
 * Both link to the subscription-management page where the plan switch happens.
 */
export function buildAnnualNudgeEmail(input: LifecycleEmailInput): BuiltEmail {
  const ctaUrl = `${input.appUrl}/manage-subscription`;
  const savingsFirst = input.variant === "savings";

  const lead = savingsFirst
    ? `You could save about $${ANNUAL_SAVINGS} a year. The annual plan is $${ANNUAL_USD.toFixed(2)}/year — that's $${ANNUAL_PER_MONTH.toFixed(2)}/month versus $${MONTHLY_USD.toFixed(2)} monthly.`
    : `If GroceryManager has become part of your weekly routine, the annual plan is the better deal: $${ANNUAL_USD.toFixed(2)}/year works out to $${ANNUAL_PER_MONTH.toFixed(2)}/month — about $${ANNUAL_SAVINGS} less than paying monthly over a year.`;

  const subject = savingsFirst ? `Save ~$${ANNUAL_SAVINGS}/year on GroceryManager` : `You've been cooking with GroceryManager for a while`;

  const bodyHtml =
    `<p style="margin:0 0 14px;">${escapeHtml(greeting(input.name))}</p>` +
    `<p style="margin:0 0 14px;">Thanks for sticking with Premium. ${escapeHtml(lead)}</p>` +
    `<p style="margin:0 0 4px;">Switching takes a few seconds and keeps everything you've set up — your pantry, plans, and history stay exactly as they are.</p>`;

  const text =
    `${greeting(input.name)}\n\n` +
    `Thanks for sticking with Premium. ${lead}\n\n` +
    `Switching takes a few seconds and keeps everything you've set up.\n\n` +
    `Switch to annual: ${ctaUrl}\n\n` +
    `Unsubscribe: ${input.unsubscribeUrl}`;

  return { subject, html: shell({ heading: "A cheaper way to keep cooking", bodyHtml, ctaLabel: "Switch to annual", ctaUrl, unsubscribeUrl: input.unsubscribeUrl }), text };
}

/**
 * H15 — win-back for churned-but-still-active users. NO discount is promised (none is wired into
 * checkout); variant "value" leads with what they're missing, control leads with the warm welcome.
 */
export function buildWinbackEmail(input: LifecycleEmailInput): BuiltEmail {
  const ctaUrl = `${input.appUrl}/upgrade`;
  const valueFirst = input.variant === "value";

  const lead = valueFirst
    ? `Premium unlocks unlimited AI meal plans, recipe remix, unlimited Discover, and Grocery Wrapped+ — the power tools on top of the free pantry, list, and cook tracking you're still using.`
    : `It's good to see you still cooking with GroceryManager. The pantry, shopping list, and cook log are yours for free, always — and Premium is here whenever you want the AI planner, recipe remix, and unlimited Discover back.`;

  const subject = valueFirst ? `What Premium adds to your GroceryManager` : `Still cooking? Here's what's waiting`;

  const bodyHtml =
    `<p style="margin:0 0 14px;">${escapeHtml(greeting(input.name))}</p>` +
    `<p style="margin:0 0 14px;">${escapeHtml(lead)}</p>` +
    `<p style="margin:0 0 4px;">No pressure — your free features keep working either way. The annual plan is $${ANNUAL_USD.toFixed(2)}/year ($${ANNUAL_PER_MONTH.toFixed(2)}/month) if you'd like to lock it in.</p>`;

  const text =
    `${greeting(input.name)}\n\n` +
    `${lead}\n\n` +
    `No pressure — your free features keep working either way. Annual is $${ANNUAL_USD.toFixed(2)}/year ($${ANNUAL_PER_MONTH.toFixed(2)}/month).\n\n` +
    `See Premium: ${ctaUrl}\n\n` +
    `Unsubscribe: ${input.unsubscribeUrl}`;

  return { subject, html: shell({ heading: "Welcome back anytime", bodyHtml, ctaLabel: "See Premium", ctaUrl, unsubscribeUrl: input.unsubscribeUrl }), text };
}
