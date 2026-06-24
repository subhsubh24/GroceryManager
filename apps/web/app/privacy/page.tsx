import { PageHeader } from "@/app/components/page-header";
import { ShieldCheck } from "@/app/components/icons";

export const metadata = {
  title: "Privacy Policy — GroceryManager",
};

const LAST_UPDATED = "June 24, 2026";
const CONTACT_EMAIL = "subh.mukherjee1996@gmail.com";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 text-base font-semibold text-ink-900 dark:text-ink-100">{children}</h2>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed text-ink-600 dark:text-ink-400">{children}</p>;
}

function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-600 dark:text-ink-400">
      {children}
    </ul>
  );
}

export default function PrivacyPage() {
  return (
    <main className="page-narrow">
      <PageHeader
        accent="brand"
        icon={ShieldCheck}
        eyebrow="Legal"
        title="Privacy Policy"
        subtitle={`Last updated ${LAST_UPDATED}`}
      />

      <div className="mt-8">
        <H2>What we collect</H2>
        <P>GroceryManager collects only what is needed to run the service:</P>
        <UL>
          <li>
            <strong>Account info</strong> — username, display name, and optionally a phone number
            for SMS digests.
          </li>
          <li>
            <strong>Gmail receipts</strong> — if you connect Gmail, we read purchase-confirmation
            emails to extract item names, quantities, and prices. We store the extracted data, not
            the raw email body.
          </li>
          <li>
            <strong>Pantry data</strong> — items you add manually, scan, or import from receipts;
            quantity estimates; depletion events.
          </li>
          <li>
            <strong>Cooking history</strong> — recipes you cook, including date and any macros
            logged.
          </li>
          <li>
            <strong>Preferences</strong> — dietary preferences and taste signals from onboarding,
            saved recipes, and swipes.
          </li>
          <li>
            <strong>Push subscriptions</strong> — if you enable web push, we store your
            browser&apos;s push endpoint to deliver digest notifications.
          </li>
          <li>
            <strong>Device / session info</strong> — standard server logs (IP address, browser
            string, timestamps) retained for up to 30 days.
          </li>
        </UL>

        <H2>How we use it</H2>
        <P>
          All data is used exclusively to provide and improve GroceryManager — to maintain your
          pantry view, suggest recipes, build your shopping list, send digests and reorder alerts,
          and personalise recommendations over time. We do not sell, rent, or share your data with
          third parties for advertising.
        </P>

        <H2>Third-party services</H2>
        <UL>
          <li>
            <strong>Google / Gmail OAuth</strong> — used only to read your receipt emails. We
            request the minimum scope needed and store only the extracted purchase data.
          </li>
          <li>
            <strong>Gemini API (Google)</strong> — receipt text and fridge photos are sent to
            Google&apos;s Gemini API for extraction. No personal identifiers are included beyond
            the content you provide.
          </li>
          <li>
            <strong>Open Food Facts</strong> — barcode lookups send only the UPC number, no account
            info.
          </li>
          <li>
            <strong>Instacart</strong> — shopping-list links open Instacart&apos;s website in your
            browser; we do not share your account credentials with Instacart.
          </li>
        </UL>

        <H2>Data retention &amp; deletion</H2>
        <P>
          Your data is stored for as long as your account is active. You can delete your account at
          any time from your{" "}
          <a href="/profile" className="link">
            profile page
          </a>{" "}
          — this permanently erases all data associated with your account, including pantry,
          receipts, recipes, and preferences. Deletion is immediate and irreversible.
        </P>

        <H2>Security</H2>
        <P>
          All data is transmitted over HTTPS. Passwords are stored as scrypt hashes; we never store
          plaintext credentials. Per-user row-level security on the database ensures one
          user&apos;s data cannot be accessed by another.
        </P>

        <H2>Children</H2>
        <P>
          GroceryManager is not directed at children under 13. We do not knowingly collect data
          from children under 13. If you believe a child has created an account, contact us and we
          will delete it promptly.
        </P>

        <H2>Changes to this policy</H2>
        <P>
          We may update this policy as the product evolves. Material changes will be noted with an
          updated &ldquo;Last updated&rdquo; date above. Continued use after a change constitutes
          acceptance.
        </P>

        <H2>Contact</H2>
        <P>
          Questions or requests (including data access or deletion)?{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="link">
            {CONTACT_EMAIL}
          </a>
        </P>

        <p className="mt-8 text-xs text-ink-400">
          <a href="/terms" className="link">
            Terms of use
          </a>{" "}
          ·{" "}
          <a href="/profile" className="link">
            Delete your account
          </a>
        </p>
      </div>
    </main>
  );
}
