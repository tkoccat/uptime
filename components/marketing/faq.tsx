import { faqs } from "@/lib/marketing/content";

// Ek JS gerektirmeyen, erişilebilir SSS (details/summary)
export function Faq() {
  return (
    <div className="mx-auto max-w-3xl divide-y rounded-lg border">
      {faqs.map((item) => (
        <details key={item.q} className="group p-4">
          <summary className="cursor-pointer list-none font-medium marker:hidden">
            <span className="mr-2 text-primary group-open:hidden">+</span>
            <span className="mr-2 hidden text-primary group-open:inline">−</span>
            {item.q}
          </summary>
          <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
