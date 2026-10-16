import type { Metadata } from "next";
import { H2, LegalPage, UL } from "@/components/legal/legal-page";
import { company } from "@/lib/company";

export const metadata: Metadata = { title: "Refund Policy" };

export default function RefundsPage() {
  return (
    <LegalPage title="Refund Policy">
      <H2>14-day refund</H2>
      <p>
        If you are not satisfied, you can ask for a full refund of your first payment for a paid plan within 14 days of
        that payment. This applies to monthly and yearly plans.
      </p>

      <H2>Free trials</H2>
      <p>You are not charged during a free trial. Cancel before it ends and you pay nothing.</p>

      <H2>After 14 days</H2>
      <p>
        Renewals are not refundable once the 14-day window has passed, but you can cancel at any time and keep access
        until the end of the period you have paid for. Nothing here affects your statutory rights.
      </p>

      <H2>How to ask</H2>
      <UL
        items={[
          `Email ${company.supportEmail} from your account email address.`,
          "We aim to reply within 2 working days.",
          "Approved refunds go back to the original payment method and usually appear within 5 to 10 working days.",
        ]}
      />
    </LegalPage>
  );
}
