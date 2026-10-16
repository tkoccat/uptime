import { setRequestLocale } from "next-intl/server";
import { requireAdmin } from "@/lib/admin/guard";
import { envStatus, runConnectionChecks } from "@/lib/admin/system";

export default async function SystemPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  await requireAdmin();
  const checks = await runConnectionChecks();
  const env = envStatus();

  return (
    <>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">System</h1>
        <p className="text-sm text-muted-foreground">Live connection checks and which settings are configured. Secret values are never shown.</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Connections</h2>
        <ul className="divide-y rounded-lg border text-sm">
          {checks.map((c) => (
            <li key={c.name} className="flex flex-wrap items-start justify-between gap-2 p-3">
              <span className="font-medium">
                {c.ok ? "✓" : "✗"} {c.name}
              </span>
              <span className={`break-all ${c.ok ? "text-muted-foreground" : "text-destructive"}`}>{c.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Configuration</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {env.map((g) => (
            <div key={g.group} className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-medium">{g.group}</p>
              <ul className="space-y-1 text-xs">
                {g.items.map((i) => (
                  <li key={i.name} className="flex justify-between gap-2">
                    <code>{i.name}</code>
                    <span className={i.set ? "text-emerald-600" : i.required ? "text-destructive" : "text-muted-foreground"}>
                      {i.set ? "set" : i.required ? "MISSING" : "not set"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
