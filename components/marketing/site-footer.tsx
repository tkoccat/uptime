import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCompany } from "@/lib/site-config";
import { comparisonSlugs } from "@/lib/marketing/content";

export async function SiteFooter() {
  const company = await getCompany();
  const t = await getTranslations("Footer");
  const tc = await getTranslations("Compare");

  const legal = [
    { href: "/terms", label: t("terms") },
    { href: "/privacy", label: t("privacy") },
    { href: "/cookies", label: t("cookies") },
    { href: "/refunds", label: t("refunds") },
    { href: "/dpa", label: t("dpa") },
    { href: "/sub-processors", label: t("subProcessors") },
  ] as const;

  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-3">
        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">{company.productName}</p>
          <p>
            {t("company", {
              legalName: company.legalName,
              companyNumber: company.companyNumber,
              jurisdiction: company.jurisdiction,
              address: company.address,
            })}
          </p>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-semibold">{t("compare")}</p>
          <ul className="space-y-1 text-muted-foreground">
            {comparisonSlugs.map((slug) => (
              <li key={slug}>
                <Link href={`/alternatives/${slug}`} className="hover:text-foreground">
                  {t("vs", { name: tc(`items.${slug}.name`) })}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-semibold">{t("legal")}</p>
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
