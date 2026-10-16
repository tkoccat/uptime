import type { Metadata } from "next";
import { InfoH2, InfoPage } from "@/components/site/info-page";
import { Link } from "@/i18n/navigation";
import { getCompany } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "About",
  description: "Who runs this service, what we believe in and how it works.",
};

export default async function AboutPage() {
  const company = await getCompany();

  return (
    <InfoPage title={`About ${company.productName}`} lead="Hosted monitoring that tells you when something stops working, without the servers to look after.">
      <InfoH2>What it is</InfoH2>
      <p>
        {company.productName} is a hosted monitoring service for websites, APIs, servers and scheduled jobs. It runs on the open-source{" "}
        <a href="https://github.com/louislam/uptime-kuma" className="underline" rel="noreferrer">
          Uptime Kuma
        </a>{" "}
        engine, wrapped in a multi-tenant service with accounts, billing, alert channels and public status pages.
      </p>

      <InfoH2>Who runs it</InfoH2>
      <p>
        {company.productName} is operated by {company.legalName}, company number {company.companyNumber}, registered in {company.jurisdiction}.
        Registered address: {company.address}.
      </p>

      <InfoH2>Principles</InfoH2>
      <ul className="list-disc space-y-2 pl-6">
        <li>
          <strong>Do one job well.</strong> Tell you quickly and reliably when something is down, and when it is back.
        </li>
        <li>
          <strong>Honest about limits.</strong> Plan limits, prices and what is and is not monitored are stated plainly. Monitoring is best-effort and should not be your only safeguard for critical systems.
        </li>
        <li>
          <strong>Respect your data.</strong> We send service emails only: alerts, receipts and security notices. Analytics and advertising scripts load only after you consent to them. You can delete your account and all its data yourself, at any time.
        </li>
        <li>
          <strong>No lock-in.</strong> The engine is open source and your monitors can be managed through a public <Link href="/docs/api" className="underline">REST API</Link>.
        </li>
      </ul>

      <InfoH2>Reliability</InfoH2>
      <p>
        We are a young service and we do not publish uptime guarantees we cannot prove. Check intervals, alerts and status pages are provided on a best-effort basis; see our{" "}
        <Link href="/terms" className="underline">
          Terms
        </Link>
        . How we protect your data is described on the <Link href="/security" className="underline">security page</Link>.
      </p>

      <InfoH2>Get in touch</InfoH2>
      <p>
        Questions, feedback or a feature you need? <Link href="/contact" className="underline">Contact us</Link>.
      </p>
    </InfoPage>
  );
}
