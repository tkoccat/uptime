import type { Metadata } from "next";
import { H2, LegalPage } from "@/components/legal/legal-page";
import { Button } from "@/components/ui/button";
import { company } from "@/lib/company";
import dpa from "@/lib/legal/dpa.json";

export const metadata: Metadata = { title: "Data Processing Agreement" };

// {{alan}} yer tutucularını şirket bilgileriyle doldurur
const fill = (text: string) =>
  text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => (company as Record<string, string>)[key] ?? `{{${key}}}`);

export default function DpaPage() {
  return (
    <LegalPage title={dpa.title}>
      <Button asChild variant="outline">
        <a href="/legal/dpa.pdf" download>
          Download PDF
        </a>
      </Button>
      <p>{fill(dpa.intro)}</p>
      {dpa.sections.map((s) => (
        <section key={s.heading} className="space-y-2">
          <H2>{fill(s.heading)}</H2>
          {s.paragraphs.map((p) => (
            <p key={p}>{fill(p)}</p>
          ))}
        </section>
      ))}
    </LegalPage>
  );
}
