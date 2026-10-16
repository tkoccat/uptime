"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { CONSENT_EVENT, getConsent } from "@/lib/consent";
import { SIGNUP_SOURCE_COOKIE } from "@/lib/signup-source";

const GTAG_ID = process.env.NEXT_PUBLIC_GTAG_ID;
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

// İlk ziyaretteki UTM parametreleri ve yönlendiren site, 30 gün geçerli çerezde saklanır.
// Yalnızca çerez onayı verildiyse çalışır; "ilk dokunuş" korunur (varsa üzerine yazılmaz).
function captureSource() {
  if (document.cookie.includes(`${SIGNUP_SOURCE_COOKIE}=`)) return;
  const q = new URLSearchParams(location.search);
  const s = q.get("utm_source");
  let r = "";
  try {
    r = document.referrer ? new URL(document.referrer).hostname : "";
  } catch {
    /* geçersiz referrer */
  }
  if (!s && !r) return;
  const value = encodeURIComponent(JSON.stringify({ s, m: q.get("utm_medium"), c: q.get("utm_campaign"), r }));
  document.cookie = `${SIGNUP_SOURCE_COOKIE}=${value}; Max-Age=${60 * 60 * 24 * 30}; Path=/; SameSite=Lax${
    location.protocol === "https:" ? "; Secure" : ""
  }`;
}

// Reklam ve analiz betikleri yalnızca "Tümünü kabul et" sonrası yüklenir
export function Analytics() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const sync = () => {
      const ok = getConsent() === "accepted";
      setAllowed(ok);
      if (ok) captureSource();
    };
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);

  if (!allowed) return null;

  return (
    <>
      {GTAG_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GTAG_ID}`} strategy="afterInteractive" />
          <Script id="gtag-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GTAG_ID}');`}
          </Script>
        </>
      )}
      {PIXEL_ID && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${PIXEL_ID}');fbq('track','PageView');`}
        </Script>
      )}
    </>
  );
}

type Win = Window & { gtag?: (...a: unknown[]) => void; fbq?: (...a: unknown[]) => void };

// Kayıt tamamlandığında dönüşüm olayı (yalnızca betikler yüklüyse bir şey yapar)
export function SignupConversion() {
  useEffect(() => {
    if (getConsent() !== "accepted") return;
    const w = window as Win;
    w.gtag?.("event", "sign_up");
    // Google Ads dönüşümü: "AW-XXXXXXXX/etiket" biçiminde
    const label = process.env.NEXT_PUBLIC_GTAG_CONVERSION_LABEL;
    if (label) w.gtag?.("event", "conversion", { send_to: label });
    w.fbq?.("track", "CompleteRegistration");
  }, []);
  return null;
}
