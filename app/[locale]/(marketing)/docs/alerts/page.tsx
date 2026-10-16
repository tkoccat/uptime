import type { Metadata } from "next";
import { Callout, DocTitle, H2, Table } from "@/components/docs/doc";

export const metadata: Metadata = { title: "Alerts & integrations", description: "Where alerts can go and how to set each channel up." };

export default function AlertsDoc() {
  return (
    <>
      <DocTitle lead="You get one alert when a monitor goes down and one when it comes back, in the places you already work.">Alerts &amp; integrations</DocTitle>

      <p>
        Your account email always receives alerts unless you turn them off in <strong>Settings</strong>. Add more places under <strong>Notifications</strong>.
        Use <em>Send test</em> after adding a channel to check it works; a successful test marks the channel as verified, and only verified channels receive alerts.
      </p>

      <Table
        head={["Channel", "What you need"]}
        rows={[
          ["Email", "Any address. We send a confirmation link; the channel is active once you confirm."],
          ["Slack", "An incoming webhook URL (Slack: Apps → Incoming Webhooks)."],
          ["Discord", "A channel webhook URL (Channel settings → Integrations → Webhooks)."],
          ["Telegram", "A bot token from @BotFather and the chat ID (or @channelname) the bot can post to."],
          ["Microsoft Teams", "A Workflows or incoming webhook URL for the channel."],
          ["Webhook", "Any public HTTPS endpoint. We send a JSON POST (see below)."],
          ["SMS", "A phone number in international format, e.g. +447700900123."],
        ]}
      />

      <H2>Webhook payload</H2>
      <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-3 text-sm leading-6">
        <code>{`{
  "event": "monitor.down",          // or "monitor.up", "test"
  "title": "My site is down",
  "text": "https://example.com — connection timeout",
  "monitor": { "id": "clx...", "name": "My site", "url": "https://example.com" },
  "time": "2026-10-16T10:00:00.000Z"
}`}</code>
      </pre>

      <Callout tone="warning">
        Webhook URLs must be public. Private and internal addresses are rejected, and redirects are not followed.
        Channel secrets such as webhook URLs and bot tokens are stored encrypted.
      </Callout>

      <H2>Email preferences</H2>
      <p>
        In <strong>Settings</strong> you can choose which emails you receive: monitor down, monitor recovered, billing, trial reminders and plan-limit warnings.
        Account and security emails cannot be turned off.
      </p>
    </>
  );
}
