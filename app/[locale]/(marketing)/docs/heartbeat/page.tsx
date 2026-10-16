import type { Metadata } from "next";
import { baseUrl, Callout, Code, DocTitle, H2, Table, UL } from "@/components/docs/doc";

export const metadata: Metadata = {
  title: "Cron job monitoring",
  description: "Monitor cron jobs, backups and scheduled tasks with heartbeat pings.",
};

export default function HeartbeatDoc() {
  const url = `${baseUrl()}/api/ping/YOUR_PING_KEY`;

  return (
    <>
      <DocTitle lead="Backups, reports and sync jobs fail silently. A heartbeat monitor alerts you when a job does not run on time.">Cron job monitoring</DocTitle>

      <H2>How it works</H2>
      <ol className="list-decimal space-y-2 pl-6">
        <li>
          Create a monitor of type <strong>Heartbeat (cron job)</strong>. Choose how often the job should run (the <em>period</em>) and how late it may be (the <em>grace time</em>).
        </li>
        <li>We give you a unique <strong>ping URL</strong>. Keep it secret: anyone who has it can send pings.</li>
        <li>Make your job request that URL every time it succeeds. If no ping arrives within period + grace time, we alert you.</li>
      </ol>

      <H2>Ping URLs</H2>
      <Table
        head={["URL", "Meaning"]}
        rows={[
          [<code key="a">{url}</code>, "The job ran successfully."],
          [<code key="b">{url}/fail</code>, "The job failed. You are alerted immediately, without waiting for the deadline."],
        ]}
      />
      <p>
        GET, POST and HEAD are accepted. You can attach a short message with <code>?msg=backup%20done</code> or in a POST body (first 200 characters). Pings are limited to 120 per minute per monitor.
      </p>

      <H2>Examples</H2>
      <Code title="crontab: ping only when the job succeeds">{`0 2 * * *  /usr/local/bin/backup.sh && curl -fsS -m 10 --retry 5 -o /dev/null ${url}`}</Code>
      <Code title="shell: report success or failure explicitly">{`#!/bin/sh
if /usr/local/bin/backup.sh; then
  curl -fsS -m 10 --retry 5 -o /dev/null ${url}
else
  curl -fsS -m 10 --retry 5 -o /dev/null ${url}/fail
fi`}</Code>
      <Code title="systemd service">{`[Service]
ExecStart=/usr/local/bin/backup.sh
ExecStopPost=/bin/sh -c 'if [ "$EXIT_STATUS" = 0 ]; then curl -fsS -m 10 ${url}; else curl -fsS -m 10 ${url}/fail; fi'`}</Code>
      <Code title="GitHub Actions">{`- name: Notify monitoring
  if: success()
  run: curl -fsS -m 10 --retry 5 "\${{ secrets.HEARTBEAT_URL }}"`}</Code>
      <Code title="Python">{`import requests

requests.get("${url}", timeout=10)`}</Code>
      <Code title="Node.js">{`await fetch("${url}", { signal: AbortSignal.timeout(10_000) });`}</Code>

      <H2>Choosing period and grace time</H2>
      <UL
        items={[
          "Period: how often the job is supposed to run (hourly, daily, weekly).",
          "Grace time: a little more than the longest the job normally takes. If your backup runs for ten minutes, a grace time of 15 to 30 minutes avoids false alarms.",
          "A failed job that never ran at all also triggers the alert once the deadline passes.",
        ]}
      />

      <Callout>
        Use <code>curl --retry</code> so a short network problem does not cause a missed ping, and set a timeout so a hanging request never blocks your job.
      </Callout>

      <H2>What heartbeat monitoring is not</H2>
      <p>
        Heartbeats prove that a job reported in. They do not check that a website is reachable. For that, add an HTTP monitor as well.
      </p>
    </>
  );
}
