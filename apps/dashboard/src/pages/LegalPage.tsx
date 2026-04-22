import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { BeaconMark } from "../components/BeaconMark";
import { APP_NAME } from "../lib/brand";

/**
 * Shared layout for /terms and /privacy. Long-form legal text is passed
 * as children. Intentionally plain-prose — these pages are about being
 * read, not styled.
 */
export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg-base text-fg-primary">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-bg-base/80 border-b border-border-subtle">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/preview-landing" className="flex items-center gap-2 font-semibold tracking-tight">
            <BeaconMark size={22} />
            <span>{APP_NAME}</span>
          </Link>
          <Link
            to="/preview-landing"
            className="inline-flex items-center gap-1.5 text-sm text-fg-secondary hover:text-fg-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to site
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fg-muted mb-3">
          Legal
        </div>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.08] mb-3">
          {title}
        </h1>
        <p className="text-sm text-fg-muted mb-12">Last updated {updated}</p>

        <div className="legal-prose space-y-6 text-[15px] leading-relaxed text-fg-secondary">
          {children}
        </div>

        <hr className="border-border-subtle my-16" />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-fg-muted">
          <div className="flex gap-5">
            <Link to="/terms" className="hover:text-fg-primary transition-colors">Terms</Link>
            <Link to="/privacy" className="hover:text-fg-primary transition-colors">Privacy</Link>
            <Link to="/preview-landing" className="hover:text-fg-primary transition-colors">Home</Link>
          </div>
          <span>© {new Date().getFullYear()} {APP_NAME}</span>
        </div>
      </main>
    </div>
  );
}

/* Small typed helpers — just so the JSX below reads more naturally. */
function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-fg-primary mt-10 mb-3">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>;
}
function UL({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc pl-6 space-y-1.5 marker:text-fg-muted">{children}</ul>;
}

/* ---------------------------------------------------------------- Terms */

export function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updated="April 22, 2026">
      <P>
        Welcome to Beacon. These Terms govern your use of our website, apps, and services (the
        "Service"). By creating an account or using the Service you agree to them. If you don't
        agree, don't use the Service.
      </P>
      <P>
        Beacon is operated as a personal-finance tracking tool. We are not a registered broker-dealer,
        investment advisor, or financial institution. Nothing in the Service constitutes financial,
        legal, tax, or investment advice.
      </P>

      <H2>1. Your account</H2>
      <P>
        You need an account to use most of the Service. You're responsible for the activity on your
        account and for keeping your password reasonably safe. Notify us if you suspect unauthorized
        access.
      </P>

      <H2>2. What Beacon does</H2>
      <UL>
        <li>Aggregates read-only holdings, transactions, and dividends from your brokerages.</li>
        <li>Presents them in a consolidated dashboard with charts and tables.</li>
        <li>Optionally lets you import CSV exports from brokers we don't auto-sync.</li>
      </UL>
      <P>
        We do not execute trades, transfer funds, or take custody of any assets. All brokerage
        connections are made via third-party OAuth providers (SnapTrade and, for some tiers, Plaid)
        and are explicitly read-only.
      </P>

      <H2>3. Acceptable use</H2>
      <P>You agree not to:</P>
      <UL>
        <li>Use the Service to violate any law or third-party right.</li>
        <li>Attempt to bypass security, rate limits, or access controls.</li>
        <li>Scrape, resell, or redistribute data obtained through the Service.</li>
        <li>Upload malware, or use the Service to harass, defraud, or impersonate anyone.</li>
      </UL>

      <H2>4. Plans and billing</H2>
      <P>
        Free is free. Paid plans (Pro and Elite) are billed on a recurring basis at the interval shown
        at checkout. You can cancel at any time from Settings — you'll keep access until the end of
        the paid period. We offer a 14-day full refund on any paid plan, no questions asked.
      </P>

      <H2>5. Third-party services</H2>
      <P>
        Brokerage connections are provided by third parties (currently SnapTrade and Plaid). Their
        terms and privacy policies apply in addition to ours. We're not responsible for their
        availability or errors, though we'll help you troubleshoot within reason.
      </P>

      <H2>6. Data accuracy</H2>
      <P>
        We work hard to show accurate data, but we source it from the brokerages you connect. We
        make no warranty that every number is correct, complete, or current. Always verify with your
        broker before acting on anything you see in Beacon.
      </P>

      <H2>7. Your content</H2>
      <P>
        You retain ownership of any data you upload (e.g., CSV files, notes). You grant us a limited
        license to store and process it solely to operate the Service for you. We don't claim any
        right to sell or repurpose it.
      </P>

      <H2>8. Termination</H2>
      <P>
        You can delete your account at any time from Settings. We may suspend or terminate accounts
        that violate these Terms or put the Service at risk. On deletion, we remove your data in
        accordance with our Privacy Notice.
      </P>

      <H2>9. Warranty disclaimer</H2>
      <P>
        The Service is provided "as is," without warranties of any kind. To the fullest extent
        permitted by law, we disclaim all implied warranties including merchantability, fitness for
        a particular purpose, and non-infringement.
      </P>

      <H2>10. Limitation of liability</H2>
      <P>
        To the fullest extent permitted by law, Beacon's total liability for any claim arising out
        of these Terms or your use of the Service is limited to the amount you paid us in the 12
        months preceding the claim (or $100, whichever is greater). We aren't liable for indirect,
        incidental, or consequential damages, including lost profits or investment losses.
      </P>

      <H2>11. Changes</H2>
      <P>
        We may update these Terms from time to time. If the changes are material, we'll give you
        reasonable notice (typically email). Continued use after the effective date means you accept
        the updated Terms.
      </P>

      <H2>12. Contact</H2>
      <P>
        Questions about these Terms? Email <a className="text-fg-primary underline underline-offset-2 hover:no-underline" href="mailto:hello@beacon.finance">hello@beacon.finance</a>.
      </P>
    </LegalLayout>
  );
}

/* -------------------------------------------------------------- Privacy */

export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Notice" updated="April 22, 2026">
      <P>
        This notice explains what data Beacon collects, why, how long we keep it, and the choices
        you have. It applies to our website, apps, and services. Plain English is the goal — if
        anything below is unclear, email us.
      </P>

      <H2>What we collect</H2>
      <UL>
        <li>
          <strong className="text-fg-primary">Account info:</strong> email, hashed password, and
          basic profile settings (theme, default currency).
        </li>
        <li>
          <strong className="text-fg-primary">Brokerage data:</strong> holdings, transactions, and
          dividend records pulled read-only via SnapTrade/Plaid, or CSVs you upload. We do{" "}
          <em>not</em> receive or store your brokerage passwords.
        </li>
        <li>
          <strong className="text-fg-primary">Usage data:</strong> anonymized logs of requests,
          errors, and page views so we can keep the app running and fix bugs.
        </li>
        <li>
          <strong className="text-fg-primary">Billing data:</strong> if you subscribe, our payment
          processor (Stripe) handles your card details. We only store subscription status, plan,
          and last-four digits.
        </li>
      </UL>

      <H2>What we don't collect</H2>
      <UL>
        <li>Your brokerage username or password. Ever.</li>
        <li>Government ID, SSN, or tax information.</li>
        <li>Third-party tracking pixels. No Google Analytics, no Meta Pixel, no session replay.</li>
      </UL>

      <H2>Why we use it</H2>
      <UL>
        <li>To provide the dashboard — consolidate holdings, compute dividends, render allocation.</li>
        <li>To keep your account secure (authentication, abuse detection, rate limiting).</li>
        <li>To improve the Service (aggregate, de-identified metrics only).</li>
        <li>To communicate with you about product updates, billing, and support.</li>
      </UL>

      <H2>How we store it</H2>
      <P>
        Data is encrypted in transit (TLS 1.3) and at rest (AES-256). Passwords are hashed with
        bcrypt; no one at Beacon can read them. Production databases sit in SOC 2–compliant
        infrastructure with least-privilege access controls.
      </P>

      <H2>How long we keep it</H2>
      <UL>
        <li>Account data: while your account is active.</li>
        <li>After account deletion: removed within 30 days from primary systems and backups.</li>
        <li>Anonymized logs: up to 90 days for debugging and abuse response.</li>
        <li>Billing records: retained as required by tax and accounting law (typically 7 years).</li>
      </UL>

      <H2>Who we share it with</H2>
      <P>
        We share the minimum data required to run the Service, with vendors bound by written data
        processing agreements:
      </P>
      <UL>
        <li><strong className="text-fg-primary">SnapTrade / Plaid</strong> — brokerage connections.</li>
        <li><strong className="text-fg-primary">Stripe</strong> — subscription billing.</li>
        <li><strong className="text-fg-primary">Cloud infrastructure</strong> (compute, storage, email delivery).</li>
      </UL>
      <P>
        We do not sell your data. We do not rent it. We do not hand it to advertisers. We will only
        disclose data if legally compelled, and in that case we'll fight over-broad requests when we
        can and notify you unless prohibited.
      </P>

      <H2>Your rights</H2>
      <UL>
        <li><strong className="text-fg-primary">Access:</strong> download your data as CSV at any time.</li>
        <li><strong className="text-fg-primary">Correction:</strong> edit brokerage labels, notes, and profile fields in Settings.</li>
        <li><strong className="text-fg-primary">Deletion:</strong> one click in Settings removes your account and data per the schedule above.</li>
        <li><strong className="text-fg-primary">Portability:</strong> CSV export works for holdings, transactions, and dividends.</li>
      </UL>
      <P>
        If you live in the EU/UK, California, or another jurisdiction with expanded privacy rights
        (GDPR, CCPA, etc.), you have additional rights such as objecting to processing or lodging a
        complaint with your data protection authority. Contact us and we'll help.
      </P>

      <H2>Cookies</H2>
      <P>
        We use a small number of strictly-necessary cookies (session, CSRF) and a locally-stored
        theme preference. No advertising or cross-site tracking cookies.
      </P>

      <H2>Children</H2>
      <P>
        Beacon is not directed to children under 13 (or 16 in the EU). We don't knowingly collect
        data from them. If you believe a child has signed up, email us and we'll delete the account.
      </P>

      <H2>Changes</H2>
      <P>
        If we change this notice materially, we'll give you reasonable notice (typically email)
        before the change takes effect.
      </P>

      <H2>Contact</H2>
      <P>
        Privacy questions or requests: <a className="text-fg-primary underline underline-offset-2 hover:no-underline" href="mailto:privacy@beacon.finance">privacy@beacon.finance</a>.
      </P>
    </LegalLayout>
  );
}
