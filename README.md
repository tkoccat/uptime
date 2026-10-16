# Uptime SaaS

Uptime Kuma'yı "motor" olarak kullanan, self-serve SaaS izleme platformu. Kullanıcılar kendi kendine kayıt olur,
plan seçer, ödeme yapar ve kendi panellerinden monitör, bildirim ve durum sayfalarını yönetir. Uptime Kuma'nın ham
arayüzü kullanıcıya gösterilmez.

**Teknoloji:** Next.js 14 (App Router) + Tailwind + shadcn/ui · Prisma + PostgreSQL · Supabase Auth · Stripe ·
BullMQ + Redis · Resend (e-posta) · next-intl (en/de/fr/tr) · Vitest + Playwright · Docker + Dokploy.

## Mimari

```
Kullanıcı ──► Next.js (app/, API route'ları) ──► PostgreSQL (SaaS verisi, Prisma)
                 │            │
                 │            └──► lib/uptimeKuma.ts  (sahiplik kontrolü + plan limiti + SSRF koruması)
                 │                       │
                 │                       ▼ UptimeKumaAdapter (arayüz)
                 │                  SocketUptimeKumaAdapter ──Socket.IO──► Uptime Kuma (MariaDB, kendi içinde)
                 │                                                          │ webhook (down/up)
                 ▼                                                          ▼
              Redis ◄── BullMQ ◄── /api/webhooks/kuma ─► alert işi ─► e-posta / Slack / webhook / SMS
                         ▲
                       worker  (zamanlanmış: 5 dk'da uptime özeti, saatlik deneme hatırlatması)
```

- **İki veritabanı ayrıdır:** Uptime Kuma kendi MariaDB'sini kullanır; SaaS katmanı kendi PostgreSQL'ini.
- **Kiracı izolasyonu (SEÇENEK A):** Uptime Kuma çoklu kullanıcıyı desteklemez (tek yönetici hesabı vardır). Bu yüzden
  tek örnek + tek servis hesabı kullanılır ve izolasyon uygulama katmanında sağlanır: her monitör DB'de bir kullanıcıya
  bağlıdır, her işlemde sahiplik sorguya `userId` koşulu eklenerek doğrulanır, başkasının kaydı 404 döner,
  Kuma'dan hiçbir zaman "hepsini listele" yapılmaz. Tüm Kuma işlemleri `UptimeKumaAdapter` arayüzünden geçer;
  kullanıcı başına instance'a (SEÇENEK B) geçmek için yalnızca yeni bir adapter yazılır.
- **Bildirimler:** Kuma'da tek bir webhook bildirimi vardır (`saas-alert-webhook`); olaylar uygulamaya gelir ve
  kullanıcının kanallarına (e-posta, Slack, webhook, SMS) uygulama tarafından dağıtılır.

## Kurulum

```bash
npm install
cp .env.example .env.local   # Windows: Copy-Item .env.example .env.local
# .env.local içindeki değerleri doldurun (Supabase, Neon/Postgres, Upstash/Redis, Uptime Kuma, Stripe...)
npx prisma generate
npx prisma migrate deploy    # migration'ları veritabanına uygular
npm run dev                  # http://localhost:3000
npm run worker               # ayrı terminalde: kuyruk işçisi (REDIS_URL varsa)
```

`REDIS_URL` boşsa hız sınırı bellekte tutulur ve işler aynı süreçte çalışır (yalnızca geliştirme için).

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run dev` / `build` / `start` | Geliştirme / derleme / üretim sunucusu |
| `npm run lint` | ESLint |
| `npm test` | Vitest birim testleri (112 test) |
| `npm run test:e2e` | Playwright (bkz. aşağıda) |
| `npm run worker` | BullMQ işçisi |
| `npm run legal:dpa` | DPA PDF'ini yeniden üretir (`public/legal/dpa.pdf`) |

## Testler

- **Birim (Vitest):** plan limitleri, hız sınırı, SSRF koruması, şifreleme/jeton, Uptime Kuma Socket.IO istemcisi ve
  adapter'ı, çok kiracılı izolasyon, Stripe webhook işleyicisi (idempotensi, 3. başarısız ödemede Free'ye düşme),
  API anahtarları, host yönlendirme, admin metrikleri.
- **E2E (Playwright):** `e2e/smoke.spec.ts` hizmet gerektirmez. `e2e/full-flow.spec.ts` (giriş → monitör → ödeme → iptal)
  gerçek bir **staging** ortamı ister: `E2E_BASE_URL`, `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`; yalnızca Stripe **test**
  modunda çalıştırın. İlk kullanımda tarayıcıyı kurun: `npx playwright install chromium`.

## REST API

Pro ve Business planlarında, `Authorization: Bearer upk_...` ile (anahtarlar `/dashboard/api` sayfasından):

| Yöntem | Yol | Açıklama |
| --- | --- | --- |
| GET | `/api/v1/monitors` | Monitör listesi |
| POST | `/api/v1/monitors` | `{ name, url, type, interval }` ile oluşturur |
| GET | `/api/v1/monitors/{id}` | Son durum |
| DELETE | `/api/v1/monitors/{id}` | Siler |

Anahtar başına dakikada 60 istek; aşımda `429` + `Retry-After`.

## Yönetim paneli (`/admin`)

`ADMIN_EMAIL` ortam değişkenindeki e-posta ile giriş yapınca (birden fazla yönetici için virgülle ayırın) panele
**Dashboard → Admin panel** bağlantısından veya `/admin` adresinden girilir. Diğer kullanıcılar `/admin` için 404 alır.
Her eylem sunucuda yeniden yönetici kontrolü yapar ve **Audit log**'a yazılır.

| Bölüm | Ne yapılır |
| --- | --- |
| **Overview** | MRR, churn, kayıtlar, aktif kullanıcılar, plan dağılımı, kayıt kaynakları |
| **Plans & pricing** | GBP/EUR/USD fiyatları (aylık + yıllık), monitör/aralık/durum sayfası limitleri, özel alan adı ve API izni, deneme süresi, planı satıştan kaldırma. Fiyat değişince Stripe'ta **yeni fiyat** açılır, eskisi geçmişe alınır (mevcut aboneler etkilenmez). Fiyat tablosu, Checkout ve limitler buradan okunur. |
| **Discounts** | Stripe kupon + promosyon kodu: yüzde/tutar, tek seferlik/süreli/sürekli, kullanım sınırı, son tarih, plana veya yeni müşteriye kısıt; kapatma |
| **Users** | Arama/filtre; plan verme (kilitlenebilir "hediye plan"), deneme uzatma, hesabı askıya alma (giriş + API kapanır, monitörler durur), silme |
| **Site content** | Ana sayfa, SSS, özellik kartları, fiyat sayfası ve SEO metinleri, dil bazında |
| **Settings** | Duyuru bandı (satış/bakım), yeni kayıtları aç/kapat, şirket bilgileri (altbilgi, yasal sayfalar, e-postalar) |
| **Audit log** | Panelden yapılan her değişiklik, kim/ne zaman/ne değişti |
| **System** | PostgreSQL, Redis, Uptime Kuma ve Stripe bağlantı testleri; hangi ayarların tanımlı olduğu (değerler gösterilmez) |

Ayarlar veritabanında tutulur (`PlanConfig`, `SiteSetting`, `SiteContent`); kayıt yoksa koddaki varsayılanlar geçerlidir.
Değişiklikler herkese açık sayfalara en geç ~2 dakikada yansır. Admin panelinin dili İngilizcedir.

## Çoklu dil (i18n)

next-intl ile 4 dil: İngilizce (varsayılan, `/`), Almanca (`/de`), Fransızca (`/fr`), Türkçe (`/tr`).
Metinler `locales/` altındadır: `{dil}.json` (site), `dash.{dil}.json` (panel), `email.{dil}.json` (e-postalar).
Yeni metin eklerken dört dili birlikte güncelleyin. Rotalar `app/[locale]/` altındadır; yönlendirme ve link için
`@/i18n/navigation` kullanılır. Kayıt olan kullanıcının dili `User.locale` alanına yazılır, e-postalar o dilde gider.

- Yasal sayfalar avukat incelemesinden sonra çevrilecek; şimdilik tüm dillerde İngilizce gösterilir.
- Almanca, Fransızca ve Türkçe metinler yapay zekâ ile hazırlanmıştır; yayından önce ana dili konuşan biri okumalıdır.
- `/admin` paneli yalnızca İngilizcedir (yalnızca sahibi görür).

## Yasal sayfalar: AVUKAT İNCELEMESİ GEREKLİ

`/terms`, `/privacy`, `/cookies`, `/refunds`, `/dpa` ve `/sub-processors` **taslak şablonlardır**, hukuki danışmanlık
değildir. Yayına almadan önce:

1. `lib/company.json` içindeki köşeli parantezli şirket bilgilerini doldurun.
2. Metinleri İngiltere'de yetkili bir avukata inceletin (özellikle şartlar, gizlilik, DPA).
3. Sub-processor listesindeki konum ve sağlayıcıları gerçek kurulumunuza göre doğrulayın.
4. DPA'nın 1. ekindeki güvenlik önlemleri (yedekleme, günlükleme, şifreleme) gerçekten uygulanmalı veya metin düzeltilmelidir.
5. `npm run legal:dpa` ile PDF'i yeniden üretin.
6. İnceleme bitince `LEGAL_REVIEWED=true` yapın; sayfalardaki taslak uyarısı kalkar.

## Çerez onayı ve reklam

`lib/consent.ts` onay durumunu `cookie_consent` çerezinde tutar. Google Ads/gtag ve Meta Pixel betikleri ile UTM
kaynak çerezi (`signup_source`) **yalnızca "Tümünü kabul et" sonrası** çalışır (`components/tracking/analytics.tsx`).
Kayıt kaynağı (`utm_source`, `utm_medium`, `utm_campaign`, yönlendiren site) `User` kaydına yazılır ve `/admin`'de görünür.

## Güvenlik özeti

- Çok kiracılı sahiplik kontrolü her işlemde (bkz. `lib/uptimeKuma.test.ts`); API anahtarları yalnızca SHA-256 özetiyle saklanır.
- SSRF koruması: monitör ve webhook hedefleri herkese açık adreslere çözülmelidir (`lib/security/url-guard.ts`); gönderim anında yeniden doğrulanır, yönlendirme izlenmez.
- Stripe webhook imza doğrulaması ham gövde üzerinde; olaylar idempotent. Kuma webhook'u ve Caddy `ask` uç noktası gizli anahtarla korunur.
- Hız sınırı (Redis): giriş/kayıt/şifre sıfırlama (IP), monitör ekleme/silme (kullanıcı), API (anahtar).
- Bildirim kanalı gizli bilgileri AES-256-GCM ile şifreli; girdiler Prisma ile parametreli sorgulanır, ham SQL yok.
- "Hesabımı sil": Kuma monitörleri, Stripe abonelikleri, Supabase hesabı ve tüm SaaS verisi silinir (`lib/account.ts`).

## Deploy

Dokploy rehberi: [`docs/DEPLOY-DOKPLOY.md`](docs/DEPLOY-DOKPLOY.md) ·
[`Dockerfile`](Dockerfile) · [`docker/docker-compose.yml`](docker/docker-compose.yml) · [`docker/Caddyfile`](docker/Caddyfile).
