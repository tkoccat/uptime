import type { Metadata } from "next";
import { H2, LegalPage, UL } from "@/components/legal/legal-page";
import { getCompany } from "@/lib/site-config";

export const metadata: Metadata = { title: "Terms of Service" };

export default async function TermsPage() {
  const company = await getCompany();
  return (
    <LegalPage title="Terms of Service">
      <H2>1. Who we are</H2>
      <p>
        These terms apply to your use of {company.productName} (the &quot;Service&quot;), provided by {company.legalName},
        company number {company.companyNumber}, registered in {company.jurisdiction} at {company.address}
        (&quot;we&quot;, &quot;us&quot;). Contact: {company.supportEmail}.
      </p>

      <H2>2. Your account</H2>
      <p>
        You must provide accurate information, keep your login details secure and be at least 18 years old. You are
        responsible for activity on your account. Tell us promptly if you suspect unauthorised access.
      </p>

      <H2>3. Plans, payment and renewal</H2>
      <p>
        Paid plans are billed in advance, monthly or yearly, through our payment provider Stripe. Prices are shown in
        GBP and VAT is added where applicable. Subscriptions renew automatically until cancelled. You can cancel at any
        time from your billing page; cancellation takes effect at the end of the current billing period.
      </p>

      <H2>4. Free trial</H2>
      <p>
        Where a free trial is offered, you will not be charged until it ends. Unless you cancel before the trial ends,
        your chosen paid plan starts and your payment method is charged.
      </p>

      <H2>5. Acceptable use</H2>
      <p>You agree not to:</p>
      <UL
        items={[
          "monitor systems you do not own or have permission to test;",
          "use the Service to attack, overload or scan third-party systems;",
          "break the law or infringe the rights of others;",
          "attempt to access other users' data or interfere with the Service;",
          "resell the Service without our written agreement.",
        ]}
      />
      <p>We may suspend accounts that breach this section.</p>

      <H2>6. Service availability</H2>
      <p>
        We aim to keep the Service available but do not guarantee uninterrupted operation. Monitoring results and
        alerts are provided on a best-efforts basis and should not be your only safeguard for critical systems.
      </p>

      <H2>7. Your data</H2>
      <p>
        You keep ownership of the data you submit. We process it to provide the Service as described in our Privacy
        Policy and, where you act as a controller of personal data, our Data Processing Agreement.
      </p>

      <H2>8. Intellectual property</H2>
      <p>
        We and our licensors own the Service. The Service uses open-source software, including Uptime Kuma, under its
        applicable licences. These terms give you a limited, non-exclusive right to use the Service while your account
        is active.
      </p>

      <H2>9. Our liability</H2>
      <p>
        Nothing in these terms limits liability that cannot lawfully be limited, including for death or personal injury
        caused by negligence, fraud, or your statutory consumer rights. Subject to that, we are not liable for indirect
        or consequential loss, or loss of profit or business, and our total liability for any claim is limited to the
        fees you paid us in the 12 months before the claim arose.
      </p>

      <H2>10. Ending the agreement</H2>
      <p>
        You may close your account at any time. We may suspend or end your access if you materially breach these terms,
        or on reasonable notice if we discontinue the Service. On closure we delete your data as described in our
        Privacy Policy. Refunds are covered by our Refund Policy.
      </p>

      <H2>11. Changes</H2>
      <p>
        We may update these terms. We will give reasonable notice of material changes, and continued use after they
        take effect means you accept them.
      </p>

      <H2>12. Governing law</H2>
      <p>
        These terms are governed by the laws of England and Wales and the courts of England and Wales have exclusive
        jurisdiction, except that if you are a consumer living in Scotland or Northern Ireland you may also bring
        proceedings in your local courts, and mandatory consumer protections in your country of residence continue to
        apply.
      </p>
    </LegalPage>
  );
}
