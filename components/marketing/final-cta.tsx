import Link from "next/link";
import { Button } from "@/components/ui/button";

export function FinalCta() {
  return (
    <section className="bg-secondary">
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-16 text-center">
        <h2 className="text-3xl font-bold text-balance">Know when your site is down before your users do</h2>
        <p className="text-muted-foreground">Set up your first monitor in under a minute.</p>
        <Button asChild size="lg">
          <Link href="/register">Start free — no credit card required</Link>
        </Button>
      </div>
    </section>
  );
}
