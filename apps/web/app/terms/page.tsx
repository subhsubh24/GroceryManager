import { PageHeader } from "@/app/components/page-header";
import { FileText } from "@/app/components/icons";

export const metadata = {
  title: "Terms of Use — GroceryManager",
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

export default function TermsPage() {
  return (
    <main className="page-narrow">
      <PageHeader
        accent="brand"
        icon={FileText}
        eyebrow="Legal"
        title="Terms of Use"
        subtitle={`Last updated ${LAST_UPDATED}`}
      />

      <div className="mt-8">
        <H2>Acceptance</H2>
        <P>
          By creating an account or using GroceryManager (the &ldquo;Service&rdquo;), you agree to
          these Terms of Use. If you do not agree, do not use the Service.
        </P>

        <H2>The Service</H2>
        <P>
          GroceryManager is a personal grocery and cooking assistant. It ingests receipts,
          maintains a pantry view, suggests recipes and shopping lists, and tracks cooking history.
          The Service is provided on a best-effort basis; accuracy of pantry estimates and
          recommendations is not guaranteed.
        </P>

        <H2>Your account</H2>
        <UL>
          <li>You must be at least 13 years old to create an account.</li>
          <li>You are responsible for keeping your login credentials secure.</li>
          <li>
            You may not share your account with others or create accounts on behalf of third parties
            without their consent.
          </li>
          <li>
            You may delete your account at any time from your{" "}
            <a href="/profile" className="link">
              profile page
            </a>
            .
          </li>
        </UL>

        <H2>Acceptable use</H2>
        <P>You agree not to:</P>
        <UL>
          <li>Use the Service to transmit spam, malware, or illegal content.</li>
          <li>Attempt to reverse-engineer, scrape, or abuse the Service&apos;s APIs.</li>
          <li>Circumvent security measures or attempt to access other users&apos; data.</li>
          <li>Use the Service in any way that violates applicable law.</li>
        </UL>

        <H2>Gmail access</H2>
        <P>
          If you connect Gmail, you grant GroceryManager permission to read your receipt emails for
          the sole purpose of populating your pantry. You can revoke access at any time via your{" "}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            className="link"
          >
            Google account permissions
          </a>
          .
        </P>

        <H2>Intellectual property</H2>
        <P>
          The GroceryManager application and its design are owned by the developer. Recipe data
          sourced from third-party APIs remains subject to the respective provider&apos;s terms.
          Your personal data (pantry contents, cook history, preferences) belongs to you.
        </P>

        <H2>Disclaimers</H2>
        <P>
          The Service is provided &ldquo;as is&rdquo; without warranty of any kind. Nutritional
          estimates and recipe suggestions are informational only and not medical or dietary advice.
          We are not responsible for any decisions made based on the Service&apos;s output.
        </P>

        <H2>Limitation of liability</H2>
        <P>
          To the fullest extent permitted by law, the developer shall not be liable for any
          indirect, incidental, special, or consequential damages arising from your use of the
          Service. Our total liability for any claim shall not exceed the amount you paid for the
          Service in the 12 months preceding the claim.
        </P>

        <H2>Termination</H2>
        <P>
          We may suspend or terminate access to the Service for violations of these Terms, illegal
          activity, or for any reason with reasonable notice. You may terminate your account at any
          time by deleting it from your profile.
        </P>

        <H2>Changes to these terms</H2>
        <P>
          We may update these terms from time to time. Continued use of the Service after changes
          are posted constitutes acceptance of the new terms.
        </P>

        <H2>Governing law</H2>
        <P>
          These Terms are governed by the laws of the State of California, USA, without regard to
          conflict of law principles.
        </P>

        <H2>Contact</H2>
        <P>
          Questions?{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="link">
            {CONTACT_EMAIL}
          </a>
        </P>

        <p className="mt-8 text-xs text-ink-400">
          <a href="/privacy" className="link">
            Privacy policy
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
