import { Link } from "@/i18n/navigation";

// Dokümantasyon sayfalarının ortak bileşenleri (dokümanlar İngilizcedir)

export const DOC_NAV = [
  { href: "/docs", title: "Getting started" },
  { href: "/docs/monitors", title: "Monitors" },
  { href: "/docs/heartbeat", title: "Cron job monitoring" },
  { href: "/docs/alerts", title: "Alerts & integrations" },
  { href: "/docs/status-pages", title: "Status pages & badges" },
  { href: "/docs/api", title: "REST API" },
] as const;

export function DocLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 md:flex-row">
      <nav aria-label="Documentation" className="md:w-56 md:shrink-0">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Documentation</p>
        <ul className="flex gap-1 overflow-x-auto md:flex-col">
          {DOC_NAV.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="block whitespace-nowrap rounded-md px-3 py-2 text-sm hover:bg-secondary">
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <article className="min-w-0 max-w-3xl flex-1 space-y-5 leading-7">{children}</article>
    </div>
  );
}

export function DocTitle({ children, lead }: { children: React.ReactNode; lead?: string }) {
  return (
    <header className="space-y-2">
      <h1 className="text-3xl font-bold tracking-tight">{children}</h1>
      {lead && <p className="text-lg text-muted-foreground">{lead}</p>}
    </header>
  );
}

export function H2({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-20 pt-4 text-xl font-semibold">
      {children}
    </h2>
  );
}

export function Code({ children, title }: { children: string; title?: string }) {
  return (
    <figure className="overflow-hidden rounded-lg border">
      {title && <figcaption className="border-b bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground">{title}</figcaption>}
      <pre className="overflow-x-auto bg-muted/50 p-3 text-sm leading-6">
        <code>{children.trim()}</code>
      </pre>
    </figure>
  );
}

export function Callout({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warning" }) {
  return (
    <aside
      role="note"
      className={`rounded-lg border-l-4 p-4 text-sm ${tone === "warning" ? "border-amber-500 bg-amber-500/10" : "border-primary bg-primary/5"}`}
    >
      {children}
    </aside>
  );
}

export function UL({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1 pl-6">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <thead className="bg-secondary">
          <tr>
            {head.map((h) => (
              <th key={h} className="p-3" scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j} className="p-3 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Dokümanlardaki örnek adreslerin temeli: gerçek uygulama adresi (yoksa örnek alan adı). */
export const baseUrl = () => (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.example.com").replace(/\/$/, "");
