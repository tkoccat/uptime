import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export async function FinalCta() {
  const t = await getTranslations("FinalCta");

  return (
    <section className="bg-secondary">
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-16 text-center">
        <h2 className="text-3xl font-bold text-balance">{t("title")}</h2>
        <p className="text-muted-foreground">{t("body")}</p>
        <Button asChild size="lg">
          <Link href="/register">{t("cta")}</Link>
        </Button>
      </div>
    </section>
  );
}
