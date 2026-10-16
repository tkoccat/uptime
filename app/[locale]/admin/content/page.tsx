import { setRequestLocale } from "next-intl/server";
import { AdminFlash, textareaClass } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { CONTENT_KEYS, getByPath, toEditorText } from "@/lib/admin/content-keys";
import { requireAdmin } from "@/lib/admin/guard";
import { loadMessages } from "@/i18n/messages";
import { isLocale, routing } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { saveContentAction } from "../actions";

const NAMES: Record<string, string> = { en: "English", de: "Deutsch", fr: "Français", tr: "Türkçe" };

export default async function ContentPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: { locale?: string; ok?: string; error?: string };
}) {
  setRequestLocale(locale);
  await requireAdmin();

  const editing = isLocale(searchParams.locale) ? searchParams.locale : routing.defaultLocale;
  const [defaults, rows] = await Promise.all([loadMessages(editing), prisma.siteContent.findMany({ where: { locale: editing } })]);
  const overrides = new Map(rows.map((r) => [r.key, r.value]));

  const groups = [...new Set(CONTENT_KEYS.map((k) => k.group))];

  return (
    <>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Site content</h1>
        <p className="text-sm text-muted-foreground">
          Edit the marketing text per language. Clearing a field (or restoring the original text) returns it to the default. Changes appear on the public site within a couple of minutes.
        </p>
      </div>
      <AdminFlash ok={searchParams.ok} error={searchParams.error} />

      <nav className="flex gap-2" aria-label="Language">
        {routing.locales.map((l) => (
          <Link
            key={l}
            href={`/admin/content?locale=${l}`}
            className={`rounded-md border px-3 py-1 text-sm ${l === editing ? "bg-primary text-primary-foreground" : ""}`}
          >
            {NAMES[l]}
          </Link>
        ))}
      </nav>

      <form action={saveContentAction} className="space-y-8">
        <input type="hidden" name="locale" value={editing} />
        {groups.map((group) => (
          <section key={group} className="space-y-4">
            <h2 className="text-lg font-semibold">{group}</h2>
            {CONTENT_KEYS.filter((k) => k.group === group).map((k) => {
              const current = overrides.has(k.key) ? overrides.get(k.key) : getByPath(defaults, k.key);
              const edited = overrides.has(k.key);
              return (
                <div key={k.key} className="space-y-1">
                  <label htmlFor={`c:${k.key}`} className="text-sm font-medium">
                    {k.label} {edited && <span className="text-xs text-primary">(edited)</span>}
                  </label>
                  <textarea
                    id={`c:${k.key}`}
                    name={`c:${k.key}`}
                    defaultValue={toEditorText(k.kind, current)}
                    rows={k.kind === "text" ? 2 : 8}
                    className={textareaClass}
                  />
                  {k.help && <p className="text-xs text-muted-foreground">{k.help}</p>}
                </div>
              );
            })}
          </section>
        ))}
        <Button type="submit">Save {NAMES[editing]} content</Button>
      </form>
    </>
  );
}
