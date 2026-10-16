import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { AnnouncementBar } from "@/components/site/announcement-bar";
import { isAdminEmail } from "@/lib/admin/emails";
import { getCompany } from "@/lib/site-config";
import { requireUser } from "@/lib/auth/current-user";
import { LanguageSwitcher } from "@/components/marketing/language-switcher";
import { signOut } from "../(auth)/actions";
import { setLocalePreferenceAction } from "./actions";

// Oturuma bağlı içerik: hiçbir dashboard sayfası statik üretilmemeli veya önbelleğe alınmamalı
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/dashboard", key: "overview" },
  { href: "/dashboard/monitors", key: "monitors" },
  { href: "/dashboard/status-pages", key: "statusPages" },
  { href: "/dashboard/maintenance", key: "maintenance" },
  { href: "/dashboard/notifications", key: "notifications" },
  { href: "/dashboard/settings", key: "settings" },
  { href: "/dashboard/billing", key: "billing" },
  { href: "/dashboard/api", key: "api" },
] as const;

export default async function DashboardLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  setRequestLocale(locale);
  const user = await requireUser(); // oturum yoksa girişe yönlendirir (middleware'e ek savunma)
  const t = await getTranslations("Dash.nav");
  const company = await getCompany();
  const { Dash, Nav } = await getMessages();

  return (
    <>
      <AnnouncementBar />
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row">
      <aside className="md:w-56 md:shrink-0">
        <p className="mb-4 font-semibold">{company.productName}</p>
        <nav className="flex gap-1 overflow-x-auto md:flex-col" aria-label="Dashboard">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-md px-3 py-2 text-sm hover:bg-secondary"
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>
        <div className="mt-3 md:mt-4">
          <LanguageSwitcher persist={setLocalePreferenceAction} />
        </div>
        <div className="mt-6 hidden space-y-2 text-xs text-muted-foreground md:block">
          <p className="truncate">{user.email}</p>
          {isAdminEmail(user.email) && (
            <Link href="/admin" className="block font-medium text-primary underline">
              Admin panel
            </Link>
          )}
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              {t("signOut")}
            </Button>
          </form>
        </div>
      </aside>
      {/* Panel formları istemci bileşeni olduğundan yalnızca Dash çevirileri istemciye verilir */}
      <NextIntlClientProvider locale={locale} messages={{ Dash, Nav }}>
        <div className="min-w-0 flex-1 space-y-6">{children}</div>
      </NextIntlClientProvider>
      </div>
    </>
  );
}
