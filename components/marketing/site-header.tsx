import Link from "next/link";
import { Button } from "@/components/ui/button";
import { company } from "@/lib/company";

const nav = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/alternatives/uptime-kuma", label: "Self-hosted vs hosted" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="font-semibold">
          {company.productName}
        </Link>
        <nav className="hidden items-center gap-6 text-sm md:flex">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="text-muted-foreground hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/register">Start free</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
