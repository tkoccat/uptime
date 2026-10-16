import { getTranslations, setRequestLocale } from "next-intl/server";
import { ConfirmSubmit } from "@/components/dashboard/confirm-submit";
import { Flash } from "@/components/dashboard/flash";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { createMaintenanceAction, deleteMaintenanceAction } from "../actions";

export default async function MaintenancePage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: { error?: string; ok?: string };
}) {
  setRequestLocale(locale);
  const user = await requireUser();
  const t = await getTranslations("Dash.maintenance");

  const [windows, monitors] = await Promise.all([
    prisma.maintenance.findMany({
      where: { userId: user.id },
      include: { monitors: { select: { id: true, name: true } } },
      orderBy: { startsAt: "desc" },
      take: 50,
    }),
    prisma.monitor.findMany({ where: { userId: user.id }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const now = Date.now();
  const fmt = new Intl.DateTimeFormat(user.locale, { dateStyle: "medium", timeStyle: "short", timeZone: user.timezone });
  const stateOf = (w: { startsAt: Date; endsAt: Date }) => (w.endsAt.getTime() <= now ? "past" : w.startsAt.getTime() <= now ? "active" : "upcoming");

  return (
    <>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>

      <Flash error={searchParams.error} ok={searchParams.ok} />

      {windows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {windows.map((w) => {
            const state = stateOf(w);
            return (
              <li key={w.id} className="flex flex-wrap items-start justify-between gap-2 p-3">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">
                    {w.title}{" "}
                    <span
                      className={`ml-1 rounded-full px-2 py-0.5 text-xs ${state === "active" ? "bg-blue-500/15 text-blue-700 dark:text-blue-400" : "bg-muted text-muted-foreground"}`}
                    >
                      {t(state)}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fmt.format(w.startsAt)} → {fmt.format(w.endsAt)}
                  </p>
                  <p className="text-xs text-muted-foreground">{w.monitors.map((m) => m.name).join(", ")}</p>
                </div>
                <form action={deleteMaintenanceAction}>
                  <input type="hidden" name="id" value={w.id} />
                  <ConfirmSubmit label={t("delete")} message={`${t("delete")}?`} className="text-destructive" />
                </form>
              </li>
            );
          })}
        </ul>
      )}

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-lg font-semibold">{t("new")}</h2>
        {monitors.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("noMonitors")}{" "}
            <Link href="/dashboard/monitors" className="underline">
              →
            </Link>
          </p>
        ) : (
          <form action={createMaintenanceAction} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="title">{t("titleField")}</Label>
              <Input id="title" name="title" maxLength={100} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="startsAt">{t("starts")}</Label>
              <Input id="startsAt" name="startsAt" type="datetime-local" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="endsAt">{t("ends")}</Label>
              <Input id="endsAt" name="endsAt" type="datetime-local" required />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">{t("timezoneNote", { tz: user.timezone })}</p>
            <fieldset className="space-y-1 sm:col-span-2">
              <legend className="text-sm font-medium">{t("monitors")}</legend>
              <div className="grid gap-1 sm:grid-cols-2">
                {monitors.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="monitorIds" value={m.id} />
                    {m.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="sm:col-span-2">
              <Button type="submit">{t("create")}</Button>
            </div>
          </form>
        )}
      </section>
    </>
  );
}
