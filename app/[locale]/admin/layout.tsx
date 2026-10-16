import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/admin/guard";

// Oturuma bağlı, yalnızca yöneticiye açık içerik: hiçbir admin sayfası statik üretilmemeli
export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false, follow: false } };

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/plans", label: "Plans & pricing" },
  { href: "/admin/discounts", label: "Discounts" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/content", label: "Site content" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/integrations", label: "Integrations" },
  { href: "/admin/audit", label: "Audit log" },
  { href: "/admin/system", label: "System" },
] as const;

export default async function AdminLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  setRequestLocale(locale);
  const admin = await requireAdmin(); // yönetici değilse 404

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row">
      <aside className="md:w-52 md:shrink-0">
        <p className="mb-1 font-semibold">Admin</p>
        <p className="mb-4 truncate text-xs text-muted-foreground">{admin.email}</p>
        <nav className="flex gap-1 overflow-x-auto md:flex-col" aria-label="Admin">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="whitespace-nowrap rounded-md px-3 py-2 text-sm hover:bg-secondary">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-6 space-y-1 text-xs">
          <Link href="/dashboard" className="block underline">
            My dashboard
          </Link>
          <Link href="/" className="block underline">
            View site
          </Link>
        </div>
      </aside>
      <div className="min-w-0 flex-1 space-y-6">{children}</div>
    </div>
  );
}
