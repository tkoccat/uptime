import { getTranslations, setRequestLocale } from "next-intl/server";
import { ConfirmSubmit } from "@/components/dashboard/confirm-submit";
import { Flash } from "@/components/dashboard/flash";
import { Button } from "@/components/ui/button";
import { ChannelForm } from "@/components/dashboard/channel-form";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { createChannelAction, deleteChannelAction, testChannelAction } from "../actions";

export default async function NotificationsPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: { error?: string; ok?: string; test?: string; verify?: string };
}) {
  setRequestLocale(locale);
  const user = await requireUser();
  const t = await getTranslations("Dash.notifications");

  const channels = await prisma.notificationChannel.findMany({
    where: { userId: user.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true, type: true, isVerified: true },
  });

  // Doğrulama/test sonuçları için bilgi bandı (hata bandından ayrı)
  const notice =
    searchParams.test === "sent"
      ? t("testSent")
      : searchParams.test === "failed"
        ? t("testFailed")
        : searchParams.verify === "ok"
          ? t("verifyOk")
          : searchParams.verify === "invalid"
            ? t("verifyInvalid")
            : null;

  return (
    <>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>

      <Flash error={searchParams.error} ok={searchParams.ok} />
      {notice && <p className="rounded-md bg-muted p-3 text-sm">{notice}</p>}

      {channels.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {channels.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t(`types.${c.type}`)} · {c.isVerified ? t("verified") : t("unverified")}
                </p>
              </div>
              <div className="flex gap-2">
                <form action={testChannelAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <Button type="submit" variant="outline" size="sm">
                    {t("sendTest")}
                  </Button>
                </form>
                <form action={deleteChannelAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <ConfirmSubmit label={t("delete")} message={`${t("delete")}?`} className="text-destructive" />
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-lg font-semibold">{t("new")}</h2>
        <ChannelForm action={createChannelAction} />
      </section>
    </>
  );
}
