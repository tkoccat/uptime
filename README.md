# Uptime SaaS

Uptime Kuma'yı "motor" olarak kullanan, self-serve SaaS izleme platformu.
Next.js 14 (App Router) + Tailwind + shadcn/ui, Prisma + PostgreSQL, Supabase Auth, Stripe.

## Kurulum

```bash
npm install
cp .env.example .env.local   # Windows: Copy-Item .env.example .env.local
# .env.local içindeki değerleri doldurun
npx prisma generate
npm run dev
```

Uygulama http://localhost:3000 adresinde açılır.

Servisler: PostgreSQL (Neon veya yerel Docker), Redis (Upstash veya yerel Docker), Supabase projesi.
Uptime Kuma ayrı çalışır (Dokploy üzerinde) ve veritabanı olarak kendi MariaDB'sini kullanır;
SaaS katmanının PostgreSQL'i ile karıştırılmaz.

## Veritabanı

```bash
npx prisma migrate deploy   # mevcut migration'ları uygular
```

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Üretim derlemesi |
| `npm run lint` | ESLint |
| `npm run legal:dpa` | DPA PDF'ini yeniden üretir (`public/legal/dpa.pdf`) |

## Yasal sayfalar - AVUKAT İNCELEMESİ GEREKLİ

`/terms`, `/privacy`, `/cookies`, `/refunds`, `/dpa` ve `/sub-processors` **taslak şablonlardır**,
hukuki danışmanlık değildir. Yayına almadan önce:

1. `lib/company.json` içindeki köşeli parantezli şirket bilgilerini doldurun.
2. Metinleri İngiltere'de yetkili bir avukata inceletin (özellikle şartlar, gizlilik, DPA).
3. Sub-processor listesindeki konum ve sağlayıcıları gerçek kurulumunuza göre doğrulayın.
4. `npm run legal:dpa` ile PDF'i yeniden üretin.
5. İnceleme bitince `.env.local` içine `LEGAL_REVIEWED=true` ekleyin; sayfalardaki taslak uyarısı kalkar.

## Çoklu dil (i18n)

next-intl ile 4 dil: İngilizce (varsayılan, `/`), Almanca (`/de`), Fransızca (`/fr`), Türkçe (`/tr`).
Metinler `locales/{en,de,fr,tr}.json` içindedir; yeni metin eklerken dört dosyayı birlikte güncelleyin.
Rotalar `app/[locale]/` altındadır, yönlendirme ve link için `@/i18n/navigation` kullanılır.
Kayıt olan kullanıcının dili Supabase kullanıcı verisine ve `User.locale` alanına yazılır.

- Yasal sayfalar (`/terms`, `/privacy` vb.) avukat incelemesinden sonra çevrilecek; şimdilik tüm dillerde İngilizce gösterilir.
- Almanca, Fransızca ve Türkçe metinler yapay zekâ ile hazırlanmıştır; yayından önce ana dili konuşan biri okumalıdır.

## Çerez onayı

`lib/consent.ts` onay durumunu `cookie_consent` çerezinde tutar. Google Ads ve Meta Pixel betikleri
(Adım 15) yüklenmeden önce `hasAnalyticsConsent()` ile kontrol edilmelidir.

## Deploy

Dokploy rehberi Adım 13'te eklenecek.
