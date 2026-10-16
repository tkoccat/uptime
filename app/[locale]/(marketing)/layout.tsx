import { setRequestLocale } from "next-intl/server";
import { AnnouncementBar } from "@/components/site/announcement-bar";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

// Pazarlama sayfaları en geç 2 dakikada bir yeniden üretilir: admin panelindeki fiyat/içerik değişiklikleri
// (ve yeniden başlatma sonrası veritabanı ayarları) kısa sürede yansır.
export const revalidate = 120;

export default function MarketingLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return (
    <>
      <AnnouncementBar />
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
