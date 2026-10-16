import type { Metadata } from "next";
import { Callout, DocTitle, H2, UL } from "@/components/docs/doc";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = {
  title: "Documentation",
  description: "Get started with uptime monitoring, cron job monitoring, alerts, status pages and the REST API.",
};

export default function DocsHome() {
  return (
    <>
      <DocTitle lead="Know when your websites, APIs and scheduled jobs stop working, without running any monitoring servers yourself.">
        Getting started
      </DocTitle>

      <H2>What you can monitor</H2>
      <UL
        items={[
          <>
            <strong>Websites and APIs</strong>: we request your URL on a schedule and alert you when it fails or the content is wrong.
            See <Link href="/docs/monitors" className="underline">Monitors</Link>.
          </>,
          <>
            <strong>Servers and services</strong>: ping a host, check a TCP port or resolve a DNS name.
          </>,
          <>
            <strong>Cron jobs and scheduled tasks</strong>: your job pings us when it runs; we alert you when it does not.
            See <Link href="/docs/heartbeat" className="underline">Cron job monitoring</Link>.
          </>,
        ]}
      />

      <H2>Set up your first monitor in a minute</H2>
      <ol className="list-decimal space-y-2 pl-6">
        <li>
          <Link href="/register" className="underline">Create a free account</Link> and confirm your email.
        </li>
        <li>
          Open <strong>Monitors → New monitor</strong>, choose a type and enter the address.
        </li>
        <li>
          Open <strong>Notifications</strong> and add where alerts should go (email, Slack, Discord, Telegram, Microsoft Teams, webhook or SMS).
          Your account email always receives alerts unless you turn them off.
        </li>
        <li>
          Optional: create a <Link href="/docs/status-pages" className="underline">status page</Link> so your customers can see the state of your services.
        </li>
      </ol>

      <Callout>
        Checks run from our infrastructure, separate from yours. If your own server goes down, we still notice.
      </Callout>

      <H2>Automate it</H2>
      <p>
        Everything in the dashboard is also available through the <Link href="/docs/api" className="underline">REST API</Link> (Pro and Business plans),
        so monitors can be created from your deployment scripts.
      </p>

      <H2>Need help?</H2>
      <p>
        Read the <Link href="/faq" className="underline">FAQ</Link> or <Link href="/contact" className="underline">contact us</Link>.
      </p>
    </>
  );
}
