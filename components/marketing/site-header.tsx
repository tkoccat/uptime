import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/marketing/language-switcher";
import { MobileNav } from "@/components/marketing/mobile-nav";
import { ThemeToggle } from "@/components/marketing/theme-toggle";
import { LogoMark } from "@/components/site/logo";
import { Link } from "@/i18n/navigation";
import { getCompany } from "@/lib/site-config";

export async function SiteHeader() {
  const t = await getTranslations("Nav");
  const company = await getCompany();
  const nav = [
    { href: "/features", label: t("features") },
    { href: "/pricing", label: t("pricing") },
    { href: "/docs", label: t("docs") },
    { href: "/about", label: t("about") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <LogoMark />
          <span>{company.productName}</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm md:flex" aria-label="Main">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="text-muted-foreground hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/login">{t("signIn")}</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/register">{t("startFree")}</Link>
          </Button>
          <MobileNav items={[...nav, { href: "/login", label: t("signIn") }]} />
        </div>
      </div>
    </header>
  );
}
