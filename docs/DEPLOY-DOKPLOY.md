# Dokploy ile yayına alma

Bu rehber SaaS yığınını (Next.js, worker, PostgreSQL, Redis, Uptime Kuma) Dokploy üzerinde çalıştırmayı anlatır.
Dosyalar: [`Dockerfile`](../Dockerfile), [`docker/docker-compose.yml`](../docker/docker-compose.yml), [`docker/Caddyfile`](../docker/Caddyfile).

> **Durum:** Docker bu geliştirme bilgisayarında kurulu olmadığı için imaj ve compose dosyası **henüz derlenip
> çalıştırılmadı**. İlk deploy'da hataları bu rehberdeki "Sorun giderme" bölümüne göre ayıklayın.

## 0. Ön koşullar

- Dokploy kurulu bir sunucu ve bir alan adı (örn. `siten.com`).
- Hesaplar: Supabase, Stripe (UK hesabı), Resend. İsteğe bağlı: Twilio (SMS), Google Ads, Meta Pixel.
- Uptime Kuma örneğinde yönetici hesabı (kurulumda oluşturduğunuz).

## 1. DNS

| Kayıt | Hedef | Amaç |
| --- | --- | --- |
| `app.siten.com` A | Dokploy sunucu IP'si | Ana uygulama |
| `*.siten.com` A | **Caddy'nin IP'si** (bkz. 4) | Durum sayfası alt alan adları |
| `cname.siten.com` A | **Caddy'nin IP'si** | Müşterilerin özel alan adları buraya CNAME yapar |

## 2. Dokploy'da servis oluşturma

1. **Project → Create Service → Compose**.
2. Kaynak: GitHub deposu (önerilir) veya Raw. Compose yolu: `docker/docker-compose.yml`.
   Derleme bağlamı proje köküdür (`context: ..`), bu yüzden depo kökü deploy edilmelidir.
3. **Environment** sekmesine [`.env.example`](../.env.example) içeriğini yapıştırıp doldurun. Zorunlu olanlar:
   `NEXT_PUBLIC_*`, `POSTGRES_PASSWORD`, `APP_ENCRYPTION_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `UPTIME_KUMA_ADMIN_USERNAME/PASSWORD`, `KUMA_WEBHOOK_SECRET`, `CADDY_ASK_SECRET`.
4. **Domains** sekmesi: servis `nextjs-app`, port `3000`, host `app.siten.com`, HTTPS (Let's Encrypt) açık.
5. **Deploy**. Sıra: `postgres` ve `redis` sağlıklı olunca `migrate` (migration'lar) çalışır, ardından `nextjs-app` ve `worker` başlar.

> `NEXT_PUBLIC_*` değerleri derleme sırasında gömülür. Değiştirirseniz **Rebuild** gerekir.

## 3. Uptime Kuma

Compose içindeki `uptime-kuma` servisi, Dokploy'da zaten çalışan örneğin aynısıdır ve **varsayılan olarak kapalıdır**
(profil `kuma`; açmak için ortam değişkeni `COMPOSE_PROFILES=kuma`). İki seçenek:

- **Mevcut örneği kullan (önerilir):** compose'tan `uptime-kuma` servisini silin, `UPTIME_KUMA_URL`'i mevcut adrese
  (örn. `http://185.97.146.46:3001`) ayarlayın. Kuma'nın uygulamaya webhook gönderebilmesi için
  `KUMA_WEBHOOK_BASE_URL` Kuma'nın **uygulamaya erişebildiği** adres olmalıdır (örn. `https://app.siten.com`).
- **Yığınla birlikte çalıştır:** servisi bırakın; `UPTIME_KUMA_URL=http://uptime-kuma:3001`,
  `KUMA_WEBHOOK_BASE_URL=http://nextjs-app:3000`. Kuma'ya dışarıdan erişim gerekmez; ilk kurulumda
  yönetici hesabını oluşturmak için geçici bir alan adı ekleyin, sonra kaldırın.

**Önemli:** Uptime Kuma çoklu kullanıcıyı desteklemez; SaaS tek bir servis hesabıyla bağlanır. İzolasyon uygulama
katmanındadır (her istekte veritabanında sahiplik kontrolü). Kuma arayüzünü internete açmayın.

**Çıkış trafiğini kısıtlayın:** Kuma, kullanıcıların girdiği adreslere istek atar. Uygulama iç ağ adreslerini
reddeder, ancak DNS yeniden bağlama gibi hileler için Kuma konteynerinin iç ağa (Docker ağı, `10.0.0.0/8`,
`172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254`) çıkışını sunucu güvenlik duvarında da engelleyin.

## 4. Durum sayfaları ve Caddy (alt alan adları, özel alan adları)

Dokploy'un Traefik'i 80/443 portlarını kullanır; Caddy ile çakışır. İki yol:

- **Önerilen:** Caddy'yi ayrı bir küçük sunucuda/IP'de çalıştırın (`docker compose --profile edge up caddy`
  veya Dokploy'da ikinci bir Compose). `CADDY_UPSTREAM=app.siten.com:443` yerine, uygulamaya erişebilen bir adres verin,
  `*.siten.com` ve `cname.siten.com` kayıtlarını bu sunucunun IP'sine yönlendirin.
  Caddy sertifikayı yalnızca `/api/caddy/ask` onayı varsa üretir (kayıtlı slug veya DNS'i bize işaret eden özel alan adı).
- **Alternatif:** Tek sunucuda çalışmak için Dokploy'un Traefik'ini farklı portlara alın (Dokploy ayarları),
  sonra Caddy'yi 80/443'te çalıştırın. Bu, Dokploy'un kendi alan adı yönetimini etkiler; dikkatli olun.

Özel alan adı doğrulaması: müşteri `status.musteri.com` için CNAME'i `cname.siten.com`'a yönlendirir (kök alan adları için
`STATUS_SERVER_IP`'e A kaydı). Doğrulama, Caddy sertifika isterken otomatik yapılır.

## 5. Stripe

1. Ürünler: Pro ve Business; her biri için aylık ve yıllık **GBP** fiyatı (£9/£86 ve £29/£278). EUR/USD için fiyatlara
   `currency_options` ekleyin. Fiyat kimliklerini ilgili `STRIPE_PRICE_ID_*` değişkenlerine yazın.
2. **Stripe Tax**'ı etkinleştirin (başlangıç adresi ve UK KDV kaydı); Checkout `automatic_tax` kullanır.
3. Webhook: `https://app.siten.com/api/webhooks/stripe`. Olaylar: `checkout.session.completed`,
   `customer.subscription.created|updated|deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`.
   Signing secret'ı `STRIPE_WEBHOOK_SECRET`'a yazın.
4. Müşteri Portalı'nı (Billing → Customer portal) etkinleştirin; iptal ve ödeme yöntemi güncellemeye izin verin.
5. Yerelde test: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`, ardından
   `stripe trigger checkout.session.completed` ve `stripe trigger invoice.payment_failed`.

## 6. Supabase

- Authentication → URL Configuration: Site URL `https://app.siten.com`, Redirect URL'ler:
  `https://app.siten.com/auth/callback`.
- Providers: Email (doğrulama zorunlu) ve Google (OAuth istemci kimliği/gizli anahtarı).
- Şablonlar: e-posta doğrulama ve şifre sıfırlama metinlerini dört dile göre özelleştirin.

## 7. Yayın öncesi kontrol listesi

- [ ] `lib/company.json` şirket bilgileri dolu; yasal sayfalar avukattan geçti; `LEGAL_REVIEWED=true`; `npm run legal:dpa` çalıştırıldı.
- [ ] Sub-processor listesi gerçek sağlayıcılar ve konumlarla doğrulandı.
- [ ] Stripe **canlı** anahtarlar ve fiyatlar; webhook canlı adrese kayıtlı.
- [ ] Kuma yönetici hesabı güçlü şifreli; Kuma arayüzü internete kapalı; çıkış trafiği kısıtlı.
- [ ] Yedekler: PostgreSQL (`postgres-data`) ve Kuma (`uptime-kuma-data`) volume'ları için Dokploy yedekleri açık.
- [ ] `/api/health` yanıt veriyor; `worker` günlüğünde `[worker] hazır` görünüyor.
- [ ] Staging'de `npm run test:e2e` (E2E_* değişkenleriyle, Stripe **test** modunda) geçti.

## Sorun giderme

| Belirti | Olası neden |
| --- | --- |
| `migrate` başarısız | `POSTGRES_PASSWORD` ilk kurulumdan sonra değiştirildi (volume eski şifreyi tutar) |
| `nextjs-app` başlıyor ama giriş çalışmıyor | `NEXT_PUBLIC_SUPABASE_*` derlemeden sonra değiştirildi → Rebuild |
| Monitör eklenemiyor | `UPTIME_KUMA_ADMIN_*` yanlış veya Kuma'da 2FA açık (servis hesabında 2FA kapalı olmalı) |
| Uyarı e-postası/bildirim gelmiyor | `worker` çalışmıyor; Kuma'nın `KUMA_WEBHOOK_BASE_URL` adresine ulaşamıyor |
| Durum sayfası alt alan adı sertifika hatası | Caddy `ask` uç noktasına ulaşamıyor veya slug kayıtlı değil |
