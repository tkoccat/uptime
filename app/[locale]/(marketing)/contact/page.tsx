import type { Metadata } from "next";
import { InfoH2, InfoPage } from "@/components/site/info-page";
import { Link } from "@/i18n/navigation";
import { getCompany } from "@/lib/site-config";

export const metadata: Metadata = { title: "Contact", description: "How to reach support, billing and security." };

export default async function ContactPage() {
  const company = await getCompany();
  const mail = (subject: string) => `mailto:${company.supportEmail}?subject=${encodeURIComponent(subject)}`;

  return (
    <InfoPage title="Contact" lead="We read every message. A real person replies, usually within two working days.">
      <InfoH2>Support and questions</InfoH2>
      <p>
        Email{" "}
        <a href={mail("Support request")} className="underline">
          {company.supportEmail}
        </a>
        . Please write from the address you use for your account and include the monitor name or status page address if your question is about one.
        Many answers are in the <Link href="/docs" className="underline">documentation</Link> and the <Link href="/faq" className="underline">FAQ</Link>.
      </p>

      <InfoH2>Billing and refunds</InfoH2>
      <p>
        Invoices, plan changes and refunds:{" "}
        <a href={mail("Billing question")} className="underline">
          {company.supportEmail}
        </a>
        . You can manage your subscription yourself from <em>Dashboard → Billing</em>. See the <Link href="/refunds" className="underline">refund policy</Link>.
      </p>

      <InfoH2>Report a security issue</InfoH2>
      <p>
        Found a vulnerability? Please tell us privately at{" "}
        <a href={mail("Security report")} className="underline">
          {company.supportEmail}
        </a>{" "}
        with the subject &quot;Security report&quot; and enough detail to reproduce it. Please do not test against other customers&apos; data. See the <Link href="/security" className="underline">security page</Link>.
      </p>

      <InfoH2>Data protection requests</InfoH2>
      <p>
        To access, correct or delete your data, you can use your account settings, or email us. Details are in the{" "}
        <Link href="/privacy" className="underline">
          Privacy Policy
        </Link>
        .
      </p>

      <InfoH2>Company</InfoH2>
      <p>
        {company.legalName}, company number {company.companyNumber}, registered in {company.jurisdiction}. {company.address}
      </p>
    </InfoPage>
  );
}
