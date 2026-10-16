import { getCompany } from "@/lib/site-config";

// Tüm yasal sayfalarda gösterilen uyarı. Avukat incelemesi bittiğinde
// LEGAL_REVIEWED=true yapılırsa uyarı gizlenir.
const reviewed = process.env.LEGAL_REVIEWED === "true";

export async function LegalPage({
  title,
  updated = "16 October 2026",
  children,
}: {
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  const company = await getCompany();
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-16">
      {!reviewed && (
        <p role="note" className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          <strong>Draft template.</strong> This document has not yet been reviewed by a qualified solicitor and must
          not be relied on as legal advice. Replace all [bracketed] details and have it reviewed before launch.
        </p>
      )}
      <h1 className="text-4xl font-bold">{title}</h1>
      <p className="text-sm text-muted-foreground">
        {company.legalName} · Last updated: {updated}
      </p>
      <div className="space-y-4 leading-7">{children}</div>
    </main>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="pt-4 text-xl font-semibold">{children}</h2>;
}

export function UL({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-6">
      {items.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  );
}
