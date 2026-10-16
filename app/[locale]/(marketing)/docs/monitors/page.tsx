import type { Metadata } from "next";
import { Callout, DocTitle, H2, Table, UL } from "@/components/docs/doc";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = { title: "Monitors", description: "Monitor types, check intervals and monitor states." };

export default function MonitorsDoc() {
  return (
    <>
      <DocTitle lead="A monitor is one thing you want to keep an eye on: a website, an API endpoint, a server or a scheduled job.">Monitors</DocTitle>

      <H2>Monitor types</H2>
      <Table
        head={["Type", "What it checks", "Address"]}
        rows={[
          ["HTTP(s)", "The URL answers with a successful status code (2xx).", "Full URL, e.g. https://example.com/health"],
          ["HTTP keyword", "As HTTP, and the response body contains your keyword.", "Full URL + keyword"],
          ["Ping", "The host answers ICMP ping.", "Host name or IP"],
          ["TCP port", "A TCP connection to the port succeeds.", "host:port, e.g. db.example.com:5432"],
          ["DNS", "The name resolves.", "Host name"],
          [
            "Heartbeat",
            <>
              Your job pings us on time. See <Link href="/docs/heartbeat" className="underline">cron job monitoring</Link>.
            </>,
            "None: we give you a ping URL",
          ],
        ]}
      />

      <Callout tone="warning">
        For security, addresses must be reachable from the public internet. Private and internal addresses (localhost, 10.x, 192.168.x, cloud metadata addresses) are rejected.
      </Callout>

      <H2>Check interval</H2>
      <p>How often we check depends on your plan: slower on Free, faster on Pro and Business. The fastest allowed interval for your plan is shown when you add a monitor.</p>

      <H2>States</H2>
      <UL
        items={[
          <>
            <strong>Up</strong>: the last check succeeded.
          </>,
          <>
            <strong>Down</strong>: the last check failed. You are alerted once when a monitor goes down and once when it recovers, not on every failed check.
          </>,
          <>
            <strong>Paused</strong>: you paused it, or it was paused because your plan limit was lowered. Paused monitors are not checked and send no alerts.
          </>,
        ]}
      />

      <H2>Pausing and deleting</H2>
      <p>
        Open a monitor and use <em>Pause</em> to stop checks without losing history, for example during planned maintenance. <em>Delete</em> removes the monitor and its history permanently.
      </p>

      <H2>Plan limits</H2>
      <p>
        Each plan has a maximum number of monitors. If you exceed it after a downgrade, your oldest monitors stay active and the newest are paused, never deleted.
        See <Link href="/pricing" className="underline">pricing</Link> for the current limits.
      </p>
    </>
  );
}
