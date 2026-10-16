"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { CONSENT_EVENT, clearConsent, getConsent, setConsent, type Consent } from "@/lib/consent";

function useConsent() {
  const [consent, setState] = useState<Consent | undefined>(undefined);
  useEffect(() => {
    const sync = () => setState(getConsent());
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);
  return consent;
}

// "Reddet" ve "Kabul et" aynı görsel ağırlıkta (ICO/PECR beklentisi)
export function CookieBanner() {
  const t = useTranslations("Cookie");
  const consent = useConsent();
  // undefined: henüz okunmadı, null: seçim yapılmadı
  if (consent !== null) return null;

  return (
    <div
      role="dialog"
      aria-label={t("dialogLabel")}
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background p-4 shadow-lg"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 md:flex-row md:items-center">
        <p className="text-sm">
          {t("text")}{" "}
          <Link href="/cookies" className="underline">
            {t("policy")}
          </Link>
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setConsent("rejected")}>
            {t("reject")}
          </Button>
          <Button variant="outline" onClick={() => setConsent("accepted")}>
            {t("accept")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Cookie Policy sayfasındaki "tercihi değiştir" düğmesi: seçimi siler, banner tekrar açılır
export function CookieSettingsButton() {
  const t = useTranslations("Cookie");
  return (
    <Button variant="outline" onClick={() => clearConsent()}>
      {t("change")}
    </Button>
  );
}
