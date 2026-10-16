import type { Metadata } from "next";
import { baseUrl, Callout, Code, DocTitle, H2, Table } from "@/components/docs/doc";

export const metadata: Metadata = { title: "REST API", description: "Manage monitors from your own scripts with the REST API." };

export default function ApiDoc() {
  const base = baseUrl();

  return (
    <>
      <DocTitle lead="Create, list and delete monitors from deployment scripts and CI. Available on Pro and Business plans.">REST API</DocTitle>

      <H2>Authentication</H2>
      <p>
        Create a key under <strong>Dashboard → API</strong>. The key is shown once; we store only a hash. Send it as a bearer token:
      </p>
      <Code>{`Authorization: Bearer upk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}</Code>
      <Callout tone="warning">Treat keys like passwords. Revoke a key from the same page if it leaks. Keys stop working if the account is downgraded to a plan without API access.</Callout>

      <H2>Base URL and format</H2>
      <p>
        <code>{base}/api/v1</code>. Requests and responses are JSON. Successful responses wrap the result in <code>data</code>; errors use <code>error</code>.
      </p>

      <H2>Endpoints</H2>
      <Table
        head={["Method", "Path", "Description"]}
        rows={[
          ["GET", "/monitors", "List your monitors."],
          ["POST", "/monitors", "Create a monitor."],
          ["GET", "/monitors/{id}", "Latest status of a monitor."],
          ["DELETE", "/monitors/{id}", "Delete a monitor and its history."],
        ]}
      />

      <H2>Create a monitor</H2>
      <Code title="Request">{`curl -X POST ${base}/api/v1/monitors \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Production site",
    "type": "HTTP",
    "url": "https://example.com",
    "interval": 60
  }'`}</Code>
      <Table
        head={["Field", "Type", "Notes"]}
        rows={[
          ["name", "string", "1 to 100 characters. Required."],
          ["type", "string", "HTTP, KEYWORD, PING, PORT, DNS or HEARTBEAT. Required."],
          ["url", "string", "Address to check. Not used for HEARTBEAT. PORT uses host:port."],
          ["interval", "integer", "Seconds between checks (HEARTBEAT: how often the job should run). Limited by your plan."],
          ["keyword", "string", "KEYWORD only: text that must appear in the response."],
          ["grace", "integer", "HEARTBEAT only: seconds a ping may be late. Default 0."],
        ]}
      />
      <Code title="Response (201)">{`{
  "data": {
    "id": "clx9k2m0a0001",
    "name": "Production site",
    "url": "https://example.com",
    "type": "HTTP",
    "interval": 60,
    "active": true,
    "createdAt": "2026-10-16T10:00:00.000Z"
  }
}`}</Code>
      <p>
        For <code>HEARTBEAT</code> monitors the response also contains <code>pingUrl</code>, the URL your job should request.
      </p>

      <H2>Latest status</H2>
      <Code title="Response">{`{
  "data": {
    "id": "clx9k2m0a0001",
    "status": "up",          // up | down | pending | maintenance
    "time": "2026-10-16T10:05:00.000Z",
    "ping": 123,             // response time in ms, when available
    "message": "200 - OK"
  }
}`}</Code>

      <H2>Errors</H2>
      <Code>{`{ "error": { "code": "plan_limit", "message": "Your FREE plan allows up to 5 monitors. Upgrade to add more." } }`}</Code>
      <Table
        head={["Status", "Code", "Meaning"]}
        rows={[
          ["400", "validation", "Invalid or unsafe input, for example a private address."],
          ["401", "unauthorized", "Missing, invalid or revoked API key."],
          ["402", "plan_limit", "Your plan does not allow this (monitor count, check interval, API access)."],
          ["403", "suspended", "The account is suspended."],
          ["404", "not_found", "No such monitor (monitors of other accounts are never visible)."],
          ["429", "rate_limited", "Too many requests. Wait for the number of seconds in the Retry-After header."],
        ]}
      />

      <H2>Rate limits</H2>
      <p>
        Each API key may make 60 requests per minute. Creating and deleting monitors is also limited to 30 operations per minute per account.
      </p>
    </>
  );
}
