import { getTranslations } from "next-intl/server";
import { LogoMark } from "@/components/site/logo";
import { Link } from "@/i18n/navigation";
import { getCompany } from "@/lib/site-config";
import { comparisonSlugs } from "@/lib/marketing/content";

type LinkItem = { href: string; label: string };

function Column({ title, links }: { title: string; links: LinkItem[] }) {
  return (
    <div className="space-y-3 text-sm">
      <p className="font-semibold">{title}</p>
      <ul className="space-y-2 text-muted-foreground">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="hover:text-foreground">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function SiteFooter() {
  const company = await getCompany();
  const t = await getTranslations("Footer");
  const tc = await getTranslations("Compare");

  const product: LinkItem[] = [
    { href: "/features", label: t("features") },
    { href: "/pricing", label: t("pricing") },
    { href: "/docs/heartbeat", label: t("status") },
    { href: "/docs/api", label: t("api") },
  ];
  const resources: LinkItem[] = [
    { href: "/docs", label: t("docs") },
    { href: "/faq", label: t("faq") },
    ...comparisonSlugs.map((slug) => ({ href: `/alternatives/${slug}`, label: t("vs", { name: tc(`items.${slug}.name`) }) })),
  ];
  const companyLinks: LinkItem[] = [
    { href: "/about", label: t("about") },
    { href: "/contact", label: t("contact") },
    { href: "/security", label: t("security") },
  ];
  const legal: LinkItem[] = [
    { href: "/terms", label: t("terms") },
    { href: "/privacy", label: t("privacy") },
    { href: "/cookies", label: t("cookies") },
    { href: "/refunds", label: t("refunds") },
    { href: "/dpa", label: t("dpa") },
    { href: "/sub-processors", label: t("subProcessors") },
  ];

  return (
    <footer className="border-t bg-secondary/30">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-3 text-sm lg:col-span-1">
          <p className="flex items-center gap-2 font-semibold">
            <LogoMark className="h-6 w-6" />
            {company.productName}
          </p>
          <p className="text-muted-foreground">{company.supportEmail}</p>
        </div>
        <Column title={t("product")} links={product} />
        <Column title={t("resources")} links={resources} />
        <Column title={t("companyTitle")} links={companyLinks} />
        <Column title={t("legal")} links={legal} />
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted-foreground">
          {t("company", {
            legalName: company.legalName,
            companyNumber: company.companyNumber,
            jurisdiction: company.jurisdiction,
            address: company.address,
          })}
        </p>
      </div>
    </footer>
  );
}
