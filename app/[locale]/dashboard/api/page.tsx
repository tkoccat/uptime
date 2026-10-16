import { getTranslations, setRequestLocale } from "next-intl/server";
import { ApiKeyForm } from "@/components/dashboard/api-key-form";
import { ConfirmSubmit } from "@/components/dashboard/confirm-submit";
import { Flash } from "@/components/dashboard/flash";
import { requireUser } from "@/lib/auth/current-user";
import { getLimits } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { revokeApiKeyAction } from "../actions";

export default async function ApiPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: { error?: string; ok?: string };
}) {
  setRequestLocale(locale);
  const user = await requireUser();
  const t = await getTranslations("Dash.api");
  const te = await getTranslations("Dash.errors");

  const allowed = (await getLimits(user.plan)).api;
  const keys = await prisma.apiKey.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, prefix: true, lastUsedAt: true, revokedAt: true },
  });
  const fmt = new Intl.DateTimeFormat(user.locale, { dateStyle: "short", timeStyle: "short", timeZone: user.timezone });

  // İstemci bileşenine yalnızca gereken hata metinleri gönderilir
  const errors = Object.fromEntries(
    ["plan_limit_api", "validation", "rate_limited", "unknown"].map((k) => [k, te(k)])
  );

  return (
    <>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>
      <Flash error={searchParams.error} ok={searchParams.ok} />

      {!allowed ? (
        <p className="rounded-md bg-muted p-3 text-sm">{t("planRequired")}</p>
      ) : (
        <ApiKeyForm
          labels={{
            keyName: t("keyName"),
            create: t("create"),
            newKeyTitle: t("newKeyTitle"),
            newKeyWarning: t("newKeyWarning"),
            errors,
          }}
        />
      )}

      {keys.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {keys.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <div>
                <p className="font-medium">{k.name}</p>
                <p className="text-xs text-muted-foreground">
                  {k.prefix}… · {t("lastUsed")}: {k.lastUsedAt ? fmt.format(k.lastUsedAt) : t("never")}
                </p>
              </div>
              {k.revokedAt ? (
                <span className="text-xs text-muted-foreground">{t("revoked")}</span>
              ) : (
                <form action={revokeApiKeyAction}>
                  <input type="hidden" name="id" value={k.id} />
                  <ConfirmSubmit label={t("revoke")} message={`${t("revoke")}?`} className="text-destructive" />
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
