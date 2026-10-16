import { getTranslations, setRequestLocale } from "next-intl/server";
import { ConfirmSubmit } from "@/components/dashboard/confirm-submit";
import { Flash } from "@/components/dashboard/flash";
import { Modal } from "@/components/dashboard/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireUser } from "@/lib/auth/current-user";
import { limitsFor } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { createStatusPageAction, deleteStatusPageAction } from "../actions";

export default async function StatusPagesPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: { error?: string; ok?: string };
}) {
  setRequestLocale(locale);
  const user = await requireUser();
  const t = await getTranslations("Dash.statusPages");
  const tc = await getTranslations("Dash.common");

  const [pages, monitors] = await Promise.all([
    prisma.statusPage.findMany({ where: { userId: user.id }, orderBy: { slug: "asc" } }),
    prisma.monitor.findMany({ where: { userId: user.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const baseDomain = process.env.NEXT_PUBLIC_STATUS_BASE_DOMAIN ?? "example.com";
  const canCustomDomain = limitsFor(user.plan).customDomain;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        {monitors.length > 0 && (
          <Modal trigger={t("new")} title={t("new")} closeLabel={tc("back")}>
            <form action={createStatusPageAction} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="title">{t("pageTitle")}</Label>
                <Input id="title" name="title" maxLength={100} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="slug">{t("slug")}</Label>
                <Input id="slug" name="slug" pattern="[a-z0-9][a-z0-9\-]{1,30}[a-z0-9]" minLength={3} maxLength={32} required />
                <p className="text-xs text-muted-foreground">{t("slugHelp", { domain: `<slug>.${baseDomain}` })}</p>
              </div>
              <fieldset className="space-y-1">
                <legend className="text-sm font-medium">{t("monitors")}</legend>
                {monitors.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="monitorIds" value={m.id} defaultChecked />
                    {m.name}
                  </label>
                ))}
              </fieldset>
              {canCustomDomain && (
                <div className="space-y-1">
                  <Label htmlFor="customDomain">
                    {t("customDomain")} ({tc("optional")})
                  </Label>
                  <Input id="customDomain" name="customDomain" placeholder="status.example.com" />
                  <p className="text-xs text-muted-foreground">{t("customDomainHelp", { target: `cname.${baseDomain}` })}</p>
                </div>
              )}
              <Button type="submit" className="w-full">
                {t("create")}
              </Button>
            </form>
          </Modal>
        )}
      </div>

      <Flash error={searchParams.error} ok={searchParams.ok} />
      {monitors.length === 0 && <p className="text-sm text-muted-foreground">{t("noMonitors")}</p>}

      {pages.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {pages.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="font-medium">{(p.config as { title?: string } | null)?.title ?? p.slug}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {p.slug}.{baseDomain}
                  {p.customDomain ? ` · ${p.customDomain}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={`/status/${p.slug}`} target="_blank" rel="noreferrer">
                    {t("view")}
                  </a>
                </Button>
                <form action={deleteStatusPageAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <ConfirmSubmit label={t("delete")} message={`${t("delete")}?`} className="text-destructive" />
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
