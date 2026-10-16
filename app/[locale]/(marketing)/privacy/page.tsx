import type { Metadata } from "next";
import { H2, LegalPage, UL } from "@/components/legal/legal-page";
import { Link } from "@/i18n/navigation";
import { getCompany } from "@/lib/site-config";

export const metadata: Metadata = { title: "Privacy Policy" };

export default async function PrivacyPage() {
  const company = await getCompany();
  return (
    <LegalPage title="Privacy Policy">
      <H2>1. Who is responsible for your data</H2>
      <p>
        {company.legalName}, company number {company.companyNumber}, {company.address}, is the controller of personal
        data described in this policy. Contact: {company.supportEmail}. We process personal data in line with the UK
        GDPR, the Data Protection Act 2018 and, for EU/EEA users, the EU GDPR.
      </p>

      <H2>2. What we collect</H2>
      <UL
        items={[
          "Account data: email address, name, language and password credentials (handled by our authentication provider).",
          "Billing data: plan, subscription status and Stripe customer reference. Card details are handled by Stripe and never stored by us.",
          "Service data: the monitors, URLs, status pages and notification settings you configure, and the check results we record.",
          "Technical data: IP address, browser, device and security logs.",
          "Marketing data: how you found us (for example UTM parameters), only where you have consented to analytics and marketing cookies.",
        ]}
      />

      <H2>3. Why we use it and our lawful basis</H2>
      <UL
        items={[
          "To provide the Service and manage your account: performance of a contract.",
          "To take payments and keep financial records: contract and legal obligation.",
          "To keep the Service secure and prevent abuse: legitimate interests.",
          "To send service emails such as alerts, receipts and security notices: contract and legitimate interests.",
          "To measure advertising and sign-up sources: consent.",
        ]}
      />

      <H2>4. Who we share it with</H2>
      <p>
        We use service providers (sub-processors) to run the Service, such as hosting, authentication, database, email
        and payments. See our <Link href="/sub-processors" className="underline">sub-processor list</Link>. We do not
        sell personal data.
      </p>

      <H2>5. International transfers</H2>
      <p>
        Some providers process data outside the UK or EEA. Where they do, we rely on adequacy regulations or approved
        safeguards such as the UK International Data Transfer Addendum or EU Standard Contractual Clauses.
      </p>

      <H2>6. How long we keep it</H2>
      <p>
        We keep account and service data while your account is active. When you delete your account we delete your
        monitors and monitoring data, including the copy in our monitoring engine. We keep billing records for the
        period required by tax law (currently six years in the UK), and short-lived security logs for a limited time.
      </p>

      <H2>7. Your rights</H2>
      <p>
        You can ask to access, correct, delete, restrict or port your data, and to object to processing based on
        legitimate interests. Where processing relies on consent you can withdraw it at any time. Contact{" "}
        {company.supportEmail}. You can also complain to the UK Information Commissioner&apos;s Office (ico.org.uk) or
        your local supervisory authority.
      </p>

      <H2>8. Cookies</H2>
      <p>
        See our <Link href="/cookies" className="underline">Cookie Policy</Link>.
      </p>

      <H2>9. Children</H2>
      <p>The Service is not intended for anyone under 18 and we do not knowingly collect their data.</p>

      <H2>10. Changes</H2>
      <p>We will update this page when our practices change and note the date at the top.</p>
    </LegalPage>
  );
}
