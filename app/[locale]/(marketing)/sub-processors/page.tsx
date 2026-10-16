import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Sub-processors" };

// Kullandığımız servisler. Konum ve veri alanlarını gerçek hesap ayarlarınıza göre doğrulayın.
const subProcessors = [
  { name: "Supabase", purpose: "Authentication (email, Google sign-in)", data: "Email, name, password credentials", location: "[verify project region]" },
  { name: "Neon", purpose: "Application database (PostgreSQL)", data: "Account, billing references, monitor settings", location: "[verify region]" },
  { name: "Upstash", purpose: "Queues and rate limiting (Redis)", data: "Job metadata, request counters", location: "[verify region]" },
  { name: "Stripe", purpose: "Payments and tax", data: "Billing details, email, payment method (held by Stripe)", location: "UK / EU / US" },
  { name: "Resend or Postmark", purpose: "Transactional email", data: "Email address, message content", location: "[verify provider and region]" },
  { name: "[Hosting provider]", purpose: "Servers running the app and monitoring engine", data: "All service data", location: "[verify]" },
  { name: "Google (Ads, Sign-In)", purpose: "Advertising measurement (with consent), Google sign-in", data: "Pseudonymous identifiers, email for sign-in", location: "Global" },
  { name: "Meta", purpose: "Advertising measurement (with consent)", data: "Pseudonymous identifiers", location: "Global" },
];

export default function SubProcessorsPage() {
  return (
    <LegalPage title="Sub-processors">
      <p>We use the following providers to deliver the Service. We will update this list before adding a new one.</p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary">
            <tr>
              <th className="p-3" scope="col">Provider</th>
              <th className="p-3" scope="col">Purpose</th>
              <th className="p-3" scope="col">Data</th>
              <th className="p-3" scope="col">Location</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {subProcessors.map((s) => (
              <tr key={s.name}>
                <th className="p-3 font-medium" scope="row">{s.name}</th>
                <td className="p-3">{s.purpose}</td>
                <td className="p-3">{s.data}</td>
                <td className="p-3">{s.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </LegalPage>
  );
}
