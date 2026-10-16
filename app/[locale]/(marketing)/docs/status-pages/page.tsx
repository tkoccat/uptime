import type { Metadata } from "next";
import { baseUrl, Callout, Code, DocTitle, H2, UL } from "@/components/docs/doc";

export const metadata: Metadata = { title: "Status pages & badges", description: "Publish a status page and embed status badges." };

export default function StatusPagesDoc() {
  return (
    <>
      <DocTitle lead="Show customers how your services are doing, with a 90-day uptime history and incident log.">Status pages &amp; badges</DocTitle>

      <H2>Create a status page</H2>
      <p>
        Open <strong>Status pages → New status page</strong>, choose a title, an address and the monitors to show. The page is public and available at{" "}
        <code>your-address.&lt;our domain&gt;</code>. Each plan includes a limited number of pages.
      </p>
      <UL
        items={[
          "Each monitor shows its current state, 90-day uptime percentage and a bar per day.",
          "Down periods appear in the incident history with start and end times.",
          "Paused monitors are shown as paused and do not affect the overall status.",
        ]}
      />

      <H2>Custom domain</H2>
      <p>On Pro and Business you can serve the page from your own domain, for example <code>status.yourcompany.com</code>:</p>
      <ol className="list-decimal space-y-1 pl-6">
        <li>Enter the domain when you create the status page.</li>
        <li>
          At your DNS provider, add a <code>CNAME</code> record for that name pointing to <code>cname.&lt;our domain&gt;</code> (shown in the form).
        </li>
        <li>An SSL certificate is issued automatically the first time the domain is visited. This can take a minute.</li>
      </ol>
      <Callout tone="warning">
        The certificate is only issued once your DNS points at us. Apex domains (without a subdomain) cannot use a CNAME at most providers; use a subdomain such as <code>status.</code>.
      </Callout>

      <H2>Status badges</H2>
      <p>Embed a live badge for any public status page in a README, dashboard or website. Replace <code>your-address</code> with your status page address.</p>
      <Code title="Overall status">{`${baseUrl()}/api/badge/status/your-address.svg`}</Code>
      <Code title="90-day uptime">{`${baseUrl()}/api/badge/uptime/your-address.svg`}</Code>
      <Code title="Markdown">{`![status](${baseUrl()}/api/badge/status/your-address.svg)`}</Code>
      <p>Badges refresh about once a minute and only show information that is already public on your status page.</p>
    </>
  );
}
