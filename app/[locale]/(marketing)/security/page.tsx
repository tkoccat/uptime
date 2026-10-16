import type { Metadata } from "next";
import { InfoH2, InfoPage } from "@/components/site/info-page";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = {
  title: "Security",
  description: "How we protect your data and keep customers isolated from each other.",
};

export default function SecurityPage() {
  return (
    <InfoPage title="Security" lead="What we do to protect your accounts and monitoring data, described plainly.">
      <InfoH2>Customer isolation</InfoH2>
      <p>
        Every monitor, channel, status page and API key belongs to one account, and every request checks ownership on the server before anything is read or changed.
        Another customer&apos;s data is never visible: a monitor that is not yours simply does not exist from your point of view.
      </p>

      <InfoH2>Outbound requests are restricted</InfoH2>
      <p>
        Monitors and webhooks can only target addresses on the public internet. Private networks, localhost and cloud metadata addresses are rejected when you save a target and again when we send a notification, and redirects are not followed for webhooks.
        This prevents the service from being used to probe internal systems.
      </p>

      <InfoH2>Secrets</InfoH2>
      <ul className="list-disc space-y-2 pl-6">
        <li>Notification channel secrets (webhook URLs, bot tokens, phone numbers) are encrypted at rest with AES-256-GCM.</li>
        <li>API keys are shown once and stored only as a SHA-256 hash.</li>
        <li>Passwords are handled by our authentication provider; we never see or store them.</li>
        <li>Card details are handled by Stripe and never touch our servers.</li>
      </ul>

      <InfoH2>Abuse protection</InfoH2>
      <p>
        Sign-in, sign-up and password reset are rate limited per address. The API and heartbeat ping endpoints have per-key limits. Webhooks from our payment provider are signature-verified before they are processed.
      </p>

      <InfoH2>Your control over your data</InfoH2>
      <p>
        You can delete your account from <em>Dashboard → Settings</em>. This removes your monitors and monitoring data, cancels your subscription and deletes your sign-in account. Billing records are kept by our payment provider for the period required by tax law.
        See the <Link href="/privacy" className="underline">Privacy Policy</Link>, the <Link href="/dpa" className="underline">Data Processing Agreement</Link> and our{" "}
        <Link href="/sub-processors" className="underline">sub-processors</Link>.
      </p>

      <InfoH2>Responsible disclosure</InfoH2>
      <p>
        If you believe you have found a security issue, please report it privately via the <Link href="/contact" className="underline">contact page</Link>. We will acknowledge your report and keep you informed.
      </p>

      <InfoH2>What we do not claim</InfoH2>
      <p>
        We do not currently hold third-party security certifications such as SOC 2 or ISO 27001. If your organisation needs a security questionnaire answered, contact us.
      </p>
    </InfoPage>
  );
}
