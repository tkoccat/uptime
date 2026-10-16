import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Item = { title: string; body: string };

// Desteklediğimiz bildirim kanalları (yalnızca gerçekten çalışanlar listelenir)
const CHANNELS = ["Email", "Slack", "Discord", "Telegram", "Microsoft Teams", "Webhooks", "SMS"] as const;

export async function HowItWorks() {
  const t = await getTranslations("Home");
  const steps = t.raw("steps") as Item[];

  return (
    <section className="mx-auto max-w-6xl space-y-10 px-4 py-20">
      <h2 className="text-center text-3xl font-bold text-balance">{t("howTitle")}</h2>
      <ol className="grid gap-6 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="relative rounded-xl border bg-card p-6">
            <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
            <h3 className="mb-1 text-lg font-semibold">{s.title}</h3>
            <p className="text-sm text-muted-foreground">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export async function UseCases() {
  const t = await getTranslations("Home");
  const items = t.raw("useCases") as Item[];

  return (
    <section className="bg-secondary/50">
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-20">
        <h2 className="text-center text-3xl font-bold text-balance">{t("useCasesTitle")}</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {items.map((u) => (
            <Card key={u.title}>
              <CardHeader>
                <CardTitle className="text-lg">{u.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{u.body}</CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export async function Integrations() {
  const t = await getTranslations("Home");

  return (
    <section className="mx-auto max-w-4xl space-y-6 px-4 py-20 text-center">
      <h2 className="text-3xl font-bold text-balance">{t("integrationsTitle")}</h2>
      <p className="text-muted-foreground">{t("integrationsSub")}</p>
      <ul className="flex flex-wrap justify-center gap-3">
        {CHANNELS.map((c) => (
          <li key={c} className="rounded-full border bg-card px-4 py-2 text-sm font-medium shadow-sm">
            {c}
          </li>
        ))}
      </ul>
    </section>
  );
}
