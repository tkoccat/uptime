import { getTranslations, setRequestLocale } from "next-intl/server";
import { ConfirmSubmit } from "@/components/dashboard/confirm-submit";
import { Flash } from "@/components/dashboard/flash";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routing } from "@/i18n/routing";
import { requireUser } from "@/lib/auth/current-user";
import { EMAIL_PREF_KEYS } from "@/lib/notify/prefs";
import { deleteAccountAction, updateSettingsAction } from "../actions";

const LANGUAGE_NAMES: Record<string, string> = { en: "English", de: "Deutsch", fr: "Français", tr: "Türkçe" };

export default async function SettingsPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: { error?: string; ok?: string };
}) {
  setRequestLocale(locale);
  const user = await requireUser();
  const t = await getTranslations("Dash.settings");

  const timezones = Intl.supportedValuesOf("timeZone");
  const prefs = (user.emailPrefs ?? {}) as Record<string, boolean>;

  return (
    <>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <Flash error={searchParams.error} ok={searchParams.ok} />

      <form action={updateSettingsAction} className="max-w-lg space-y-5">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t("profile")}</h2>
          <div className="space-y-1">
            <Label htmlFor="name">{t("name")}</Label>
            <Input id="name" name="name" defaultValue={user.name ?? ""} maxLength={100} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="locale">{t("language")}</Label>
            <select id="locale" name="locale" defaultValue={user.locale} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {routing.locales.map((l) => (
                <option key={l} value={l}>
                  {LANGUAGE_NAMES[l]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="timezone">{t("timezone")}</Label>
            <select id="timezone" name="timezone" defaultValue={user.timezone} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {!timezones.includes(user.timezone) && <option value={user.timezone}>{user.timezone}</option>}
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </section>

        <fieldset className="space-y-2">
          <legend className="text-lg font-semibold">{t("emailPrefs")}</legend>
          {EMAIL_PREF_KEYS.map((k) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              {/* Varsayılan: açık (kaydedilmiş değer yoksa) */}
              <input type="checkbox" name={`pref_${k}`} defaultChecked={prefs[k] !== false} />
              {t(`prefs.${k}`)}
            </label>
          ))}
        </fieldset>

        <Button type="submit">{t("save")}</Button>
      </form>

      <section className="max-w-lg space-y-3 rounded-lg border border-destructive/40 p-4">
        <h2 className="text-lg font-semibold text-destructive">{t("danger")}</h2>
        <h3 className="font-medium">{t("deleteTitle")}</h3>
        <p className="text-sm text-muted-foreground">{t("deleteWarning")}</p>
        <form action={deleteAccountAction} className="space-y-2">
          <Label htmlFor="confirm">{t("deleteConfirm")}</Label>
          <Input id="confirm" name="confirm" autoComplete="off" required />
          <ConfirmSubmit label={t("deleteButton")} message={t("deleteWarning")} className="text-destructive" />
        </form>
      </section>
    </>
  );
}
