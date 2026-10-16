import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/site/logo";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("NotFound");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <LogoMark className="h-12 w-12" />
      <p className="text-sm font-semibold uppercase tracking-widest text-primary">404</p>
      <h1 className="text-3xl font-bold md:text-4xl">{t("title")}</h1>
      <p className="max-w-md text-muted-foreground">{t("body")}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/">{t("home")}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/docs">{t("docs")}</Link>
        </Button>
      </div>
    </main>
  );
}
