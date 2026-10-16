"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

// Dar ekranlarda gezinme menüsü (masaüstünde gizlidir)
export function MobileNav({ items }: { items: { href: string; label: string }[] }) {
  const t = useTranslations("Nav");
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-menu" aria-label={t("menu")}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </Button>
      {open && (
        <nav id="mobile-menu" aria-label={t("menu")} className="absolute inset-x-0 top-16 border-b bg-background p-4 shadow-lg">
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.href}>
                <Link href={item.href} onClick={() => setOpen(false)} className="block rounded-md px-3 py-3 text-base font-medium hover:bg-secondary">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
