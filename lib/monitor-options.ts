import { z } from "zod";

// Uptime Kuma'nın gelişmiş monitör ayarları. Veritabanında Monitor.options (JSON) olarak saklanır,
// eksik alanlar varsayılanla tamamlanır; böylece eski kayıtlar da geçerli kalır.

export const HTTP_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;
export const DNS_TYPES = ["A", "AAAA", "CNAME", "MX", "NS", "TXT", "SRV", "CAA"] as const;
export const DNS_SERVERS = ["1.1.1.1", "8.8.8.8", "9.9.9.9"] as const;

// "200-299" ya da "301" biçiminde kabul edilen HTTP durum kodları
const statusCode = z.string().regex(/^[1-5]\d\d(-[1-5]\d\d)?$/, "Invalid status code");

// Başlık/gövde yalnızca JSON nesnesi/metni olarak kabul edilir, boyutu sınırlıdır
const jsonObjectText = z
  .string()
  .max(2000)
  .refine((v) => {
    if (!v.trim()) return true;
    try {
      const parsed = JSON.parse(v);
      return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
    } catch {
      return false;
    }
  }, "Must be a JSON object");

export const monitorOptionsSchema = z.object({
  method: z.enum(HTTP_METHODS).default("GET"),
  // Üst üste kaç başarısız denemeden sonra "çöktü" sayılır (yanlış alarmı azaltır)
  retries: z.number().int().min(0).max(10).default(1),
  // Yeniden deneme aralığı (saniye); 0 = kontrol aralığıyla aynı
  retryInterval: z.number().int().min(0).max(3600).default(0),
  // İstek zaman aşımı (saniye); 0 = otomatik
  timeout: z.number().int().min(0).max(120).default(0),
  acceptedStatus: z.array(statusCode).min(1).max(10).default(["200-299"]),
  followRedirects: z.boolean().default(true),
  ignoreTls: z.boolean().default(false),
  // Ters mod: hedef ulaşılabilirse "çöktü" sayılır
  upsideDown: z.boolean().default(false),
  // HTTPS sertifikası dolmadan önce uyar
  certExpiry: z.boolean().default(false),
  headers: jsonObjectText.default(""),
  body: z.string().max(2000).default(""),
  // Çöken monitör için bildirimi her N kontrolde bir tekrarla (0 = tekrarlama)
  resendEvery: z.number().int().min(0).max(100).default(0),
  // KEYWORD monitörünün aranan metni (düzenleme formunun önceden doldurulması için burada da saklanır)
  keyword: z.string().max(200).default(""),
  dnsType: z.enum(DNS_TYPES).default("A"),
  dnsServer: z.enum(DNS_SERVERS).default("1.1.1.1"),
});

export type MonitorOptions = z.infer<typeof monitorOptionsSchema>;

export const DEFAULT_OPTIONS: MonitorOptions = monitorOptionsSchema.parse({});

/** Kayıtlı (kısmi/eski) seçenekleri varsayılanlarla tamamlar; bozuk veri varsayılana döner. */
export function readOptions(raw: unknown): MonitorOptions {
  const parsed = monitorOptionsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : DEFAULT_OPTIONS;
}

/** "200-299, 301" gibi virgülle ayrılmış metni listeye çevirir. */
export function parseStatusList(text: string): string[] {
  return text
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Etiketler: küçük harf, en çok 10 adet, her biri en çok 24 karakter. */
export function parseTags(text: string): string[] {
  const tags = text
    .split(/[,\n]+/)
    .map((t) => t.trim().toLowerCase().replace(/\s+/g, "-"))
    .filter((t) => /^[\p{L}\p{N}_-]{1,24}$/u.test(t));
  return [...new Set(tags)].slice(0, 10);
}
