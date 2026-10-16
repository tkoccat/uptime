import { setRequestLocale } from "next-intl/server";
import { AdminFlash, Check, Field, selectClass } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin/guard";
import { routing } from "@/i18n/routing";
import { getAnnouncement, getCompany, signupsEnabled } from "@/lib/site-config";
import { saveSettingsAction } from "../actions";

const NAMES: Record<string, string> = { en: "English", de: "Deutsch", fr: "Français", tr: "Türkçe" };

export default async function SettingsPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: { ok?: string; error?: string };
}) {
  setRequestLocale(locale);
  await requireAdmin();
  const [announcement, company, signups] = await Promise.all([getAnnouncement(), getCompany(), signupsEnabled()]);

  return (
    <>
      <h1 className="text-2xl font-semibold">Settings</h1>
      <AdminFlash ok={searchParams.ok} error={searchParams.error} />

      <form action={saveSettingsAction} className="max-w-2xl space-y-8">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Sign-ups</h2>
          <Check label="Allow new sign-ups" name="signupsEnabled" defaultChecked={signups} help="When off, the registration form and new Google sign-ins are closed. Existing users are not affected." />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Announcement banner</h2>
          <p className="text-sm text-muted-foreground">Shown at the top of the public site and the dashboard. Use it for sales, maintenance notices or news.</p>
          <Check label="Show the banner" name="announcementEnabled" defaultChecked={announcement.enabled} />
          <div className="space-y-1">
            <label htmlFor="tone" className="text-sm font-medium">
              Style
            </label>
            <select id="tone" name="tone" defaultValue={announcement.tone} className={selectClass}>
              <option value="info">Information</option>
              <option value="sale">Sale / promotion</option>
              <option value="warning">Warning / maintenance</option>
            </select>
          </div>
          {routing.locales.map((l) => (
            <Field key={l} label={`Text (${NAMES[l]})`} name={`announcement_${l}`} defaultValue={announcement.text[l] ?? ""} help={l === "en" ? "Other languages fall back to English when empty." : undefined} />
          ))}
          <Field label="Link (optional)" name="announcementLink" defaultValue={announcement.link} placeholder="/pricing or https://…" />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Company details</h2>
          <p className="text-sm text-muted-foreground">
            Shown in the footer, legal pages, status pages and emails. Must match your Companies House registration. (The downloadable DPA PDF is generated separately.)
          </p>
          <Field label="Product name" name="company_productName" defaultValue={company.productName} />
          <Field label="Legal name" name="company_legalName" defaultValue={company.legalName} />
          <Field label="Company number" name="company_companyNumber" defaultValue={company.companyNumber} />
          <Field label="Registered address" name="company_address" defaultValue={company.address} />
          <Field label="Support email" name="company_supportEmail" type="email" defaultValue={company.supportEmail} />
        </section>

        <Button type="submit">Save settings</Button>
      </form>
    </>
  );
}
