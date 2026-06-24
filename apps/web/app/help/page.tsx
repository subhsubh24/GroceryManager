import { PageHeader } from "@/app/components/page-header";
import { BookOpen, Mail } from "@/app/components/icons";

export const metadata = {
  title: "Help & FAQ — GroceryManager",
};

const SUPPORT_EMAIL = "support@grocerymanager.app";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="section-title border-b border-line pb-2">{title}</h2>
      <div className="mt-4 space-y-6">{children}</div>
    </section>
  );
}

function QA({ question, children }: { question: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-ink-800 dark:text-ink-200">{question}</h3>
      <div className="mt-1.5 text-sm leading-relaxed text-ink-600 dark:text-ink-400">{children}</div>
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-sm leading-relaxed text-ink-600 dark:text-ink-400">{children}</p>;
}

function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-600 dark:text-ink-400">
      {children}
    </ul>
  );
}

export default function HelpPage() {
  return (
    <main className="page-narrow">
      <PageHeader
        accent="brand"
        icon={BookOpen}
        eyebrow="Support"
        title="Help & FAQ"
        subtitle="Answers to common questions about GroceryManager."
      />

      {/* ── Getting started ────────────────────────────────────────────── */}
      <Section title="Getting started">
        <QA question="How do I add items to my pantry?">
          <P>
            There are several ways to add items. You can type directly into the Quick Add field on the
            Pantry screen. You can also scan a receipt photo, import receipts from Gmail, or use the
            camera to scan your fridge. All methods feed into the same append-only ledger, so
            quantities accumulate automatically when the same product appears more than once.
          </P>
        </QA>

        <QA question="How do I scan a receipt?">
          <P>
            Tap the camera icon on the Import screen and photograph your paper receipt. The app sends
            the image to our AI vision pipeline, which extracts product names, quantities, and prices.
            Results appear in a review screen before being committed to your pantry — you can edit or
            remove any line item before confirming.
          </P>
          <P>
            A Gemini API key with billing enabled is required for receipt OCR. Without it the
            feature degrades gracefully and no items are added.
          </P>
        </QA>

        <QA question="How does Gmail receipt import work?">
          <P>
            Connect your Gmail account from the Import screen. GroceryManager requests read-only
            access via Google OAuth and scans only messages that look like grocery or food delivery
            receipts — it does not read personal emails, social messages, or any other mail.
          </P>
          <UL>
            <li>Authorization uses the official Google OAuth consent flow; your password is never shared.</li>
            <li>Access is read-only — the app cannot send, delete, or modify any email.</li>
            <li>You can revoke access at any time from your Google account permissions page or from the Import screen in the app.</li>
            <li>Gmail import requires a Gemini API key with billing enabled to parse receipt content.</li>
          </UL>
        </QA>

        <QA question="How do I scan my fridge with the camera?">
          <P>
            Open the Import screen and select "Scan fridge." Point your camera at the shelves and
            capture one or more photos. The vision pipeline identifies visible items and pre-fills a
            review list. Confirm, adjust quantities, and the items are added to your pantry. Best
            results come from good lighting and scanning one shelf at a time.
          </P>
        </QA>
      </Section>

      {/* ── Pantry & tracking ──────────────────────────────────────────── */}
      <Section title="Pantry & tracking">
        <QA question="How does the pantry know when I'm running low?">
          <P>
            GroceryManager estimates a consumption rate for each item using an exponentially weighted
            moving average (EWMA) of your cooking and shopping history. It projects forward from your
            last known quantity and flags items as "running low" when the estimated remaining amount
            falls below a configurable threshold. The model updates every time you cook a meal, scan a
            receipt, or manually adjust a quantity.
          </P>
        </QA>

        <QA question='What is "likely expired" status?'>
          <P>
            Each product category has an estimated shelf life (for example, fresh milk is 7 days,
            canned beans are 730 days). When the time since your last purchase exceeds the shelf-life
            estimate for an item, GroceryManager marks it as "likely expired." This is an estimate
            only — actual expiry depends on storage conditions. You can dismiss the warning or remove
            the item manually.
          </P>
        </QA>

        <QA question="Can I manually adjust quantities?">
          <P>
            Yes. Tap any item on the Pantry screen to open its detail view, then use the quantity
            controls to increase or decrease the amount. Manual adjustments are recorded in the ledger
            just like receipt imports and cooking sessions, so the consumption model stays accurate.
          </P>
        </QA>

        <QA question="How do I remove an item?">
          <P>
            Swipe left on an item in the Pantry list and tap "Remove," or open the item detail and
            select "Remove from pantry." This records a removal event in the ledger and drops the
            projected quantity to zero immediately.
          </P>
        </QA>
      </Section>

      {/* ── Cooking & recipes ──────────────────────────────────────────── */}
      <Section title="Cooking & recipes">
        <QA question='How does "Cook tonight" work?'>
          <P>
            The Cook Tonight feature looks at what you have on hand and suggests meals that use items
            nearing their shelf-life limit first — reducing waste — while also factoring in your taste
            preferences and recent cook history. Select a suggestion, review the ingredients, and tap
            "Cook" to log the session. The pantry is automatically depleted by the recipe quantities.
          </P>
        </QA>

        <QA question="What is Recipe Remix?">
          <P>
            Recipe Remix takes an existing recipe from your Cookbook or the Discover feed and
            generates a variation based on what you currently have in your pantry. For example, if a
            recipe calls for chicken but you have tofu, Remix substitutes intelligently and adjusts
            quantities and cooking times. The remixed version can be saved as a new recipe or cooked
            immediately.
          </P>
        </QA>

        <QA question="How do I save recipes to My Cookbook?">
          <P>
            Tap the heart icon on any recipe card in the Discover feed, on a Cook Tonight
            suggestion, or on a Remix result. Saved recipes appear in the Cookbook tab. You can
            organize them into custom collections and mark favorites for quick access.
          </P>
        </QA>

        <QA question="How does the Discover feed work?">
          <P>
            The Discover feed surfaces recipes from our catalog, personalized by your pantry contents,
            dietary preferences, and past cooks. Recipes that require fewer missing ingredients appear
            higher. The feed refreshes daily and also updates when your pantry changes significantly
            — for example, after a large grocery import.
          </P>
        </QA>
      </Section>

      {/* ── Shopping list ──────────────────────────────────────────────── */}
      <Section title="Shopping list">
        <QA question="How does the smart shopping list work?">
          <P>
            GroceryManager builds your shopping list automatically from three signals: items
            projected to run out before your next likely shopping trip, ingredients needed for
            upcoming planned meals, and staples you have configured. You can also add items manually.
            The list is grouped by category (groceries, household, etc.) for efficient shopping.
          </P>
          <P>
            As you shop, check off items in the app. Checked items are added to your pantry with a
            purchase date when you tap "Done shopping," and the depletion model resets for those
            products.
          </P>
        </QA>

        <QA question="How does household sharing work?">
          <P>
            Invite household members from the Shared Household section of your profile. Each member
            signs in with their own account and is added to your household. The pantry, shopping list,
            and cook history are shared across all household members in real time. Each member's
            receipt imports and cook sessions update the shared pantry.
          </P>
          <P>
            Household sharing is available on the Premium plan. The household owner manages
            membership; members can be removed at any time.
          </P>
        </QA>
      </Section>

      {/* ── Account & subscription ─────────────────────────────────────── */}
      <Section title="Account & subscription">
        <QA question="What's included in the free plan?">
          <UL>
            <li>Full pantry tracking with manual entry and receipt scanning.</li>
            <li>Basic depletion model and low-stock alerts.</li>
            <li>Smart shopping list with planned meals.</li>
            <li>Discover feed with standard recipe suggestions.</li>
            <li>Cook logging with automatic pantry depletion.</li>
            <li>Cookbook saves.</li>
          </UL>
        </QA>

        <QA question="What does Premium include?">
          <P>
            Premium unlocks power features with a 7-day free trial — no charge until the trial ends.
            Current pricing is shown on the{" "}
            <a href="/" className="link">
              home page
            </a>
            .
          </P>
          <UL>
            <li>Unlimited cookbook saves and custom collections.</li>
            <li>Gmail receipt import (automatic, continuous sync).</li>
            <li>Recipe Remix powered by AI.</li>
            <li>Household sharing.</li>
            <li>Nutrition tracking with macro targets.</li>
            <li>Advanced depletion model with per-item shelf-life tuning.</li>
            <li>Priority support.</li>
          </UL>
        </QA>

        <QA question="How do I manage or cancel my subscription?">
          <P>
            Go to your{" "}
            <a href="/profile" className="link">
              profile page
            </a>{" "}
            and select "Subscription." From there you can upgrade, downgrade, or cancel. Cancellation
            takes effect at the end of the current billing period — you keep access to Premium
            features until then. Subscription management for in-app purchases (iOS / Android) is
            handled through the App Store or Google Play respectively.
          </P>
        </QA>

        <QA question="How do I delete my account?">
          <P>
            Open your{" "}
            <a href="/profile" className="link">
              profile page
            </a>{" "}
            and scroll to the bottom. Tap "Delete account." This permanently removes all your data —
            pantry, cook history, recipes, and account credentials — and cannot be undone. If you have
            an active subscription, cancel it before deleting your account to avoid further charges.
          </P>
        </QA>
      </Section>

      {/* ── Privacy ────────────────────────────────────────────────────── */}
      <Section title="Privacy">
        <QA question="What data does GroceryManager collect?">
          <P>
            GroceryManager collects only what is needed to provide the service: your account
            credentials (username, optional email), pantry contents and ledger events, cook history,
            recipe saves, shopping list state, and — if you connect Gmail — the text of grocery
            receipt emails. Receipt images uploaded for scanning are processed transiently and not
            stored after extraction is complete.
          </P>
          <P>
            We do not sell your data to third parties. See our{" "}
            <a href="/privacy" className="link">
              Privacy Policy
            </a>{" "}
            for full details.
          </P>
        </QA>

        <QA question="Does the app read my personal emails?">
          <P>
            No. When you connect Gmail, GroceryManager applies a strict server-side filter to
            retrieve only messages from known grocery retailers and food delivery services. The filter
            runs in your Google account via the Gmail API and returns only matching threads. Personal
            emails, work emails, social notifications, and all other message types are never fetched
            or processed.
          </P>
        </QA>

        <QA question="How do I disconnect Gmail?">
          <P>
            There are two ways to disconnect Gmail:
          </P>
          <UL>
            <li>
              In GroceryManager: go to Import, tap "Gmail connected," and select "Disconnect."
            </li>
            <li>
              Via Google:{" "}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                myaccount.google.com/permissions
              </a>{" "}
              — find GroceryManager and remove access.
            </li>
          </UL>
          <P>
            Disconnecting immediately stops all further Gmail syncing. Previously imported receipt
            data remains in your pantry; you can clear it from the Import screen if needed.
          </P>
        </QA>
      </Section>

      {/* ── Troubleshooting ────────────────────────────────────────────── */}
      <Section title="Troubleshooting">
        <QA question="The app isn't showing my pantry items">
          <P>
            Pull down to refresh on the Pantry screen. If items are still missing, try signing out
            and back in — this re-fetches your session. If the problem persists, check your internet
            connection; the pantry requires a live connection to sync the latest ledger state.
          </P>
          <P>
            If you recently joined a household or transferred devices, allow up to a minute for the
            pantry to fully replicate. Contact support if items remain missing after that.
          </P>
        </QA>

        <QA question="Receipt scan didn't import correctly">
          <P>
            OCR accuracy depends on image quality. For best results:
          </P>
          <UL>
            <li>Photograph the receipt on a flat, dark surface with even lighting.</li>
            <li>Keep the camera steady and ensure the full receipt is in frame.</li>
            <li>Avoid creased or wet receipts — flatten them first if possible.</li>
          </UL>
          <P>
            After scanning, the review screen lets you edit any incorrectly recognized item before
            committing. You can also add items manually if a particular receipt consistently fails.
          </P>
          <P>
            If Gmail import produces incorrect items, use the review queue (Import screen) to reject
            individual line items before they reach your pantry.
          </P>
        </QA>

        <QA question="The app is slow or not loading">
          <P>
            GroceryManager is a Progressive Web App (PWA) and caches content for offline use. If
            you see stale data or the app feels slow:
          </P>
          <UL>
            <li>Force-refresh the page (pull to refresh on mobile, or Ctrl+Shift+R on desktop).</li>
            <li>Check your network connection — a weak signal can slow syncing.</li>
            <li>
              Clear the app cache: in your browser or device settings, find GroceryManager and clear
              site data. You will need to sign in again afterward.
            </li>
            <li>
              If the problem occurs on a specific screen, note what you were doing and email support
              with the details.
            </li>
          </UL>
        </QA>
      </Section>

      {/* ── Contact ────────────────────────────────────────────────────── */}
      <div className="mt-12 card-pad">
        <p className="section-title">Still need help?</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-600 dark:text-ink-400">
          Our support team is happy to assist. Email us at{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="link">
            {SUPPORT_EMAIL}
          </a>{" "}
          and we'll get back to you within one business day.
        </p>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="btn-primary mt-4 inline-flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Contact support
        </a>
      </div>

      <p className="mt-8 text-xs text-ink-400">
        <a href="/terms" className="link">
          Terms of Use
        </a>{" "}
        ·{" "}
        <a href="/privacy" className="link">
          Privacy Policy
        </a>
      </p>
    </main>
  );
}
