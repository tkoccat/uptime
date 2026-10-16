import Link from "next/link";
import { company } from "@/lib/company";
import { comparisons } from "@/lib/marketing/content";

const legal = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/cookies", label: "Cookies" },
  { href: "/refunds", label: "Refunds" },
  { href: "/dpa", label: "DPA" },
  { href: "/sub-processors", label: "Sub-processors" },
];

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-3">
        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">{company.productName}</p>
          <p>
            {company.legalName}, Company No: {company.companyNumber}, Registered in {company.jurisdiction}, Address:{" "}
            {company.address}
          </p>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-semibold">Compare</p>
          <ul className="space-y-1 text-muted-foreground">
            {comparisons.map((c) => (
              <li key={c.slug}>
                <Link href={`/alternatives/${c.slug}`} className="hover:text-foreground">
                  vs {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-semibold">Legal</p>
          <ul className="space-y-1 text-muted-foreground">
            {legal.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-foreground">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
