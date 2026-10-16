import type { MonitorType, NotificationType, Plan } from "@prisma/client";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { encrypt } from "./crypto";
import { NotFoundError, ValidationError } from "./errors";
import { DEFAULT_OPTIONS, monitorOptionsSchema, type MonitorOptions } from "./monitor-options";
import { prisma } from "./prisma";
import {
  assertCustomDomainAllowed,
  assertIntervalAllowed,
  assertMonitorQuota,
  assertStatusPageQuota,
  getLimits,
} from "./plans";
import { enforceRateLimit, LIMITS } from "./rate-limit";
import { assertPublicHost, assertPublicUrl, UnsafeTargetError } from "./security/url-guard";
import { getAdapter } from "./uptime-kuma";
import type { Heartbeat, MonitorKind } from "./uptime-kuma/types";

// Çok kiracılı servis katmanı: arayüz ve API'nin Uptime Kuma'ya ulaşmasının TEK yolu burasıdır.
// Her fonksiyon önce kaydın çağıran kullanıcıya ait olduğunu veritabanından doğrular.
// Başkasının kaydı "bulunamadı" olarak döner (varlığı sızdırılmaz).

const monitorSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    // HEARTBEAT için adres gerekmez (ping adresini biz üretiriz)
    url: z.string().trim().max(2048).default(""),
    type: z.enum(["HTTP", "KEYWORD", "PING", "PORT", "DNS", "HEARTBEAT"]),
    // HTTP/PING/PORT/DNS: kontrol aralığı; HEARTBEAT: işin beklenen çalışma sıklığı (en çok 7 gün)
    interval: z.number().int().min(30).max(7 * 86400),
    keyword: z.string().trim().max(200).optional(),
    // HEARTBEAT: gecikme toleransı (saniye)
    grace: z.number().int().min(0).max(86400).default(0),
    // Gelişmiş ayarlar (yeniden deneme, durum kodları, başlıklar vb.) ve düzenleme alanları
    options: monitorOptionsSchema.optional(),
    tags: z.array(z.string()).max(10).default([]),
    description: z.string().trim().max(200).optional(),
  })
  .superRefine((v, ctx) => {
    // İstek zaman aşımı kontrol aralığından uzun olamaz (Kuma'da çakışan kontroller oluşur)
    if (v.options && v.options.timeout > 0 && v.options.timeout >= v.interval && v.type !== "HEARTBEAT") {
      ctx.addIssue({ code: "custom", path: ["options", "timeout"], message: "Timeout must be shorter than the check interval" });
    }
    if (v.type === "HEARTBEAT") {
      if (v.interval < 60) ctx.addIssue({ code: "custom", path: ["interval"], message: "Heartbeat period must be at least 60 seconds" });
    } else {
      if (!v.url) ctx.addIssue({ code: "custom", path: ["url"], message: "Address is required" });
      if (v.interval > 86400) ctx.addIssue({ code: "custom", path: ["interval"], message: "Check interval is too long" });
    }
  });

// 32 karakterlik rastgele alfanümerik anahtar (Kuma push anahtarı biçimi)
const ALPHANUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export function newPingToken(): string {
  return Array.from({ length: 32 }, () => ALPHANUM[randomInt(ALPHANUM.length)]).join("");
}

export type MonitorInput = z.input<typeof monitorSchema>;

// Veritabanına yazılacak seçenekler: varsayılanlarla tamamlanır, anahtar kelime de eklenir
function storedOptions(data: { options?: MonitorOptions; keyword?: string }): object {
  return { ...(data.options ?? DEFAULT_OPTIONS), keyword: data.keyword ?? "" };
}

async function getUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("User not found");
  return user;
}

async function getOwnedMonitor(userId: string, monitorId: string) {
  // userId koşulu sorguda: başka kullanıcının kaydı hiç dönmez
  const monitor = await prisma.monitor.findFirst({ where: { id: monitorId, userId } });
  if (!monitor) throw new NotFoundError("Monitor not found");
  return monitor;
}

export async function logUsage(userId: string, action: string, metadata?: Record<string, unknown>) {
  await prisma.usageLog.create({ data: { userId, action, metadata: metadata as object | undefined } });
}

// PORT için "host:port"; diğerleri için tam URL veya ana makine adı
async function validateTarget(type: MonitorKind, target: string) {
  try {
    if (type === "HTTP" || type === "KEYWORD") {
      await assertPublicUrl(target);
    } else if (type === "PORT") {
      const [host, port] = target.split(":");
      const p = Number(port);
      if (!host || !Number.isInteger(p) || p < 1 || p > 65535) throw new ValidationError("PORT target must be host:port");
      await assertPublicHost(host);
    } else {
      await assertPublicHost(target);
    }
  } catch (err) {
    if (err instanceof UnsafeTargetError) throw new ValidationError(err.message);
    throw err;
  }
}

export async function createMonitor(userId: string, input: MonitorInput) {
  const parsed = monitorSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Invalid monitor data");
  const data = parsed.data;

  await enforceRateLimit(`monitor:${userId}`, LIMITS.monitorMutations.limit, LIMITS.monitorMutations.windowSec);

  const user = await getUser(userId);
  const count = await prisma.monitor.count({ where: { userId } });
  const limits = await getLimits(user.plan);
  assertMonitorQuota(user.plan, count, limits);
  const heartbeat = data.type === "HEARTBEAT";
  // Plan alt sınırı kontrol aralığına uygulanır; heartbeat için "beklenen çalışma sıklığı" sayılır (daha seyrek olması serbesttir)
  assertIntervalAllowed(user.plan, data.interval, limits);
  if (!heartbeat) await validateTarget(data.type, data.url);

  const pingToken = heartbeat ? newPingToken() : undefined;
  const { kumaId } = await getAdapter().createMonitor(userId, {
    name: data.name,
    target: heartbeat ? "heartbeat" : data.url,
    type: data.type,
    // Heartbeat: Kuma, beklenen aralık + tolerans içinde ping gelmezse çöktü sayar
    interval: heartbeat ? data.interval + data.grace : data.interval,
    keyword: data.keyword,
    pushToken: pingToken,
    options: data.options,
    description: data.description,
  });

  try {
    const monitor = await prisma.monitor.create({
      data: {
        userId,
        uptimeKumaMonitorId: kumaId,
        name: data.name,
        url: heartbeat ? "heartbeat" : data.url,
        type: data.type as MonitorType,
        interval: data.interval,
        pingToken,
        graceSeconds: heartbeat ? data.grace : 0,
        options: storedOptions(data),
        tags: data.tags,
        description: data.description,
      },
    });
    await logUsage(userId, "monitor.create", { monitorId: monitor.id });
    return monitor;
  } catch (err) {
    // DB yazımı başarısızsa Kuma'da yetim monitör kalmasın
    await getAdapter().deleteMonitor(userId, kumaId).catch(() => undefined);
    throw err;
  }
}

/** Monitörü düzenler. Tür değişmez; heartbeat anahtarı korunur. */
export async function updateMonitor(userId: string, monitorId: string, input: MonitorInput) {
  const existing = await getOwnedMonitor(userId, monitorId);
  // Tür düzenlemede değişmez: gelen değer yok sayılıp kayıttaki tür kullanılır
  const parsed = monitorSchema.safeParse({ ...input, type: existing.type });
  if (!parsed.success) throw new ValidationError("Invalid monitor data");
  const data = parsed.data;
  await enforceRateLimit(`monitor:${userId}`, LIMITS.monitorMutations.limit, LIMITS.monitorMutations.windowSec);

  const user = await getUser(userId);
  const limits = await getLimits(user.plan);
  const heartbeat = data.type === "HEARTBEAT";
  assertIntervalAllowed(user.plan, data.interval, limits);
  if (!heartbeat) await validateTarget(data.type, data.url);

  await getAdapter().updateMonitor(userId, existing.uptimeKumaMonitorId, {
    name: data.name,
    target: heartbeat ? "heartbeat" : data.url,
    type: data.type,
    interval: heartbeat ? data.interval + data.grace : data.interval,
    keyword: data.keyword,
    pushToken: existing.pingToken ?? undefined,
    options: data.options,
    description: data.description,
  });

  const monitor = await prisma.monitor.update({
    where: { id: existing.id },
    data: {
      name: data.name,
      url: heartbeat ? "heartbeat" : data.url,
      interval: data.interval,
      graceSeconds: heartbeat ? data.grace : 0,
      options: storedOptions(data),
      tags: data.tags,
      description: data.description ?? null,
    },
  });
  await logUsage(userId, "monitor.update", { monitorId });
  return monitor;
}

// --- Özet ve grafik verisi ---

export type MonitorSummary = {
  id: string;
  // Son kalp atışları (eskiden yeniye); Kuma'ya ulaşılamazsa boş
  beats: Heartbeat[];
  // Son 30 günün uptime yüzdesi (günlük özetlerden; veri yoksa null)
  uptime30d: number | null;
};

const BAR_BEATS = 40;

// Aynı anda en çok N Kuma isteği: yüzlerce monitörde socket'i boğmamak için
async function pool<T, R>(items: T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await work(items[i]);
      }
    })
  );
  return out;
}

export async function uptimeFromDaily(monitorIds: string[], days: number): Promise<Map<string, number>> {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await prisma.monitorDaily.groupBy({
    by: ["monitorId"],
    where: { monitorId: { in: monitorIds }, day: { gte: since } },
    _sum: { up: true, down: true },
  });
  const out = new Map<string, number>();
  for (const r of rows) {
    const up = r._sum.up ?? 0;
    const total = up + (r._sum.down ?? 0);
    if (total > 0) out.set(r.monitorId, (up / total) * 100);
  }
  return out;
}

/** Panel listesi için: kullanıcının tüm monitörlerinin son kalp atışları ve 30 günlük uptime'ı. */
export async function getMonitorSummaries(userId: string): Promise<Map<string, MonitorSummary>> {
  const monitors = await prisma.monitor.findMany({ where: { userId }, select: { id: true, uptimeKumaMonitorId: true, interval: true, type: true, isActive: true } });
  const uptime = await uptimeFromDaily(monitors.map((m) => m.id), 30);
  const adapter = getAdapter();

  const rows = await pool(monitors, 6, async (m): Promise<MonitorSummary> => {
    let beats: Heartbeat[] = [];
    if (m.isActive) {
      try {
        // Çubuk için yeterli kalp atışı kapsayan en küçük pencere (en çok 24 saat)
        const hours = Math.min(24, Math.max(1, Math.ceil((BAR_BEATS * Math.max(m.interval, 20)) / 3600)));
        beats = (await adapter.getMonitorHistory(userId, m.uptimeKumaMonitorId, hours)).slice(-BAR_BEATS);
      } catch {
        // Kuma'ya ulaşılamazsa liste yine açılır, çubuk boş kalır
      }
    }
    return { id: m.id, beats, uptime30d: uptime.get(m.id) ?? null };
  });
  return new Map(rows.map((r) => [r.id, r]));
}

export type ChartRange = "24h" | "7d" | "30d";
export type ChartPoint = { t: number; ping: number | null; down: boolean };
export type MonitorChart = {
  range: ChartRange;
  points: ChartPoint[];
  avg: number | null;
  min: number | null;
  max: number | null;
  // Aralıktaki başarılı/başarısız kontrol sayısı
  up: number;
  down: number;
  // En son kalp atışları (eskiden yeniye): çubuk ve "son kontroller" listesi için
  recent: Heartbeat[];
  // Seçili aralıktan bağımsız son 24 saat: istatistik şeridi için
  last24h: { avg: number | null; up: number; down: number };
};

/** Son 24 saatin ortalama yanıt süresi ve başarılı/başarısız kontrol sayısı. */
export function summarize24h(beats: Heartbeat[], now: number = Date.now()): MonitorChart["last24h"] {
  const day = beats.filter((b) => new Date(b.time).getTime() >= now - 24 * 3600_000);
  const pings = day.filter((b) => b.status === "up" && b.ping !== null).map((b) => b.ping as number);
  return {
    avg: pings.length ? Math.round(pings.reduce((a, b) => a + b, 0) / pings.length) : null,
    up: day.filter((b) => b.status === "up").length,
    down: day.filter((b) => b.status === "down").length,
  };
}

const MAX_POINTS = 120;

/** Kalp atışlarını en çok `buckets` eşit zaman dilimine indirger (ping ortalaması; dilimde çöküş varsa işaretli). */
export function downsample(beats: Heartbeat[], from: number, to: number, buckets = MAX_POINTS): ChartPoint[] {
  const size = (to - from) / buckets;
  const groups: { sum: number; n: number; down: boolean }[] = Array.from({ length: buckets }, () => ({ sum: 0, n: 0, down: false }));
  for (const b of beats) {
    const t = new Date(b.time).getTime();
    if (t < from || t > to) continue;
    const g = groups[Math.min(buckets - 1, Math.floor((t - from) / size))];
    if (b.status === "down") g.down = true;
    if (b.ping !== null && b.status === "up") {
      g.sum += b.ping;
      g.n += 1;
    }
  }
  return groups.map((g, i) => ({ t: Math.round(from + (i + 0.5) * size), ping: g.n ? Math.round(g.sum / g.n) : null, down: g.down }));
}

export async function getMonitorChart(userId: string, monitorId: string, range: ChartRange): Promise<MonitorChart> {
  const monitor = await getOwnedMonitor(userId, monitorId);
  const hours = PERIOD_HOURS[range];
  const beats = await getAdapter().getMonitorHistory(userId, monitor.uptimeKumaMonitorId, hours);
  const to = Date.now();
  const points = downsample(beats, to - hours * 3600_000, to);
  const pings = beats.filter((b) => b.status === "up" && b.ping !== null).map((b) => b.ping as number);
  return {
    range,
    points,
    avg: pings.length ? Math.round(pings.reduce((a, b) => a + b, 0) / pings.length) : null,
    min: pings.length ? Math.min(...pings) : null,
    max: pings.length ? Math.max(...pings) : null,
    up: beats.filter((b) => b.status === "up").length,
    down: beats.filter((b) => b.status === "down").length,
    recent: beats.slice(-60),
    last24h: summarize24h(beats, to),
  };
}

// --- Planlı bakım ---

const maintenanceSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    startsAt: z.date(),
    endsAt: z.date(),
    monitorIds: z.array(z.string()).min(1).max(200),
  })
  .refine((v) => v.endsAt > v.startsAt, { message: "End must be after start" })
  .refine((v) => v.endsAt.getTime() - v.startsAt.getTime() <= 30 * 86_400_000, { message: "Maintenance can last at most 30 days" });

export async function createMaintenance(userId: string, input: z.input<typeof maintenanceSchema>) {
  const parsed = maintenanceSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid maintenance window");
  const { title, startsAt, endsAt, monitorIds } = parsed.data;

  // Seçilen monitörlerin hepsi bu kullanıcıya ait olmalı
  const owned = await prisma.monitor.findMany({ where: { userId, id: { in: monitorIds } }, select: { id: true } });
  if (owned.length !== new Set(monitorIds).size) throw new NotFoundError("Monitor not found");
  const count = await prisma.maintenance.count({ where: { userId, endsAt: { gt: new Date() } } });
  if (count >= 50) throw new ValidationError("Too many scheduled maintenance windows");

  const m = await prisma.maintenance.create({ data: { userId, title, startsAt, endsAt, monitors: { connect: owned.map((x) => ({ id: x.id })) } } });
  await logUsage(userId, "maintenance.create", { maintenanceId: m.id });
  return m;
}

export async function deleteMaintenance(userId: string, id: string) {
  await prisma.maintenance.deleteMany({ where: { id, userId } });
}

export async function deleteMonitor(userId: string, monitorId: string) {
  await enforceRateLimit(`monitor:${userId}`, LIMITS.monitorMutations.limit, LIMITS.monitorMutations.windowSec);
  const monitor = await getOwnedMonitor(userId, monitorId);
  await getAdapter().deleteMonitor(userId, monitor.uptimeKumaMonitorId);
  await prisma.monitor.delete({ where: { id: monitor.id } });
  await logUsage(userId, "monitor.delete", { monitorId });
}

export async function setMonitorActive(userId: string, monitorId: string, active: boolean) {
  const monitor = await getOwnedMonitor(userId, monitorId);
  await getAdapter().setMonitorActive(userId, monitor.uptimeKumaMonitorId, active);
  return prisma.monitor.update({ where: { id: monitor.id }, data: { isActive: active } });
}

export async function getMonitorStatus(userId: string, monitorId: string): Promise<Heartbeat> {
  const monitor = await getOwnedMonitor(userId, monitorId);
  return getAdapter().getMonitorStatus(userId, monitor.uptimeKumaMonitorId);
}

const PERIOD_HOURS = { "24h": 24, "7d": 168, "30d": 720 } as const;
export type HistoryPeriod = keyof typeof PERIOD_HOURS;

export async function getMonitorHistory(userId: string, monitorId: string, period: HistoryPeriod = "24h") {
  const monitor = await getOwnedMonitor(userId, monitorId);
  return getAdapter().getMonitorHistory(userId, monitor.uptimeKumaMonitorId, PERIOD_HOURS[period]);
}

// --- Bildirim kanalları ---

const channelSchemas = {
  EMAIL: z.object({ email: z.email() }),
  SLACK: z.object({ webhookUrl: z.string().startsWith("https://hooks.slack.com/") }),
  WEBHOOK: z.object({ url: z.string().url() }),
  SMS: z.object({ phone: z.string().regex(/^\+[1-9]\d{6,14}$/, "E.164 format required") }),
  // Yalnızca bilinen sağlayıcı adresleri kabul edilir: gizli bilgi içeren adreslere rastgele sunucu yazılamaz
  DISCORD: z.object({ webhookUrl: z.string().regex(/^https:\/\/(?:discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/, "Discord webhook URL required") }),
  TEAMS: z.object({
    webhookUrl: z.string().regex(/^https:\/\/[a-z0-9.-]+\.(?:webhook\.office\.com|logic\.azure\.com|environment\.api\.powerplatform\.com)\/.+$/i, "Microsoft Teams webhook URL required"),
  }),
  GOOGLE_CHAT: z.object({ webhookUrl: z.string().regex(/^https:\/\/chat\.googleapis\.com\/v1\/spaces\/[\w-]+\/messages\?.+$/, "Google Chat webhook URL required") }),
  // ntfy: boş sunucu = ntfy.sh; kendi sunucusu için tam adres (genel adres olmalı)
  NTFY: z.object({
    serverUrl: z.string().trim().max(200).optional().or(z.literal("")),
    topic: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "ntfy topic: letters, digits, - and _"),
    token: z.string().trim().max(200).optional().or(z.literal("")),
  }),
  PUSHOVER: z.object({
    userKey: z.string().regex(/^[A-Za-z0-9]{30}$/, "Pushover user key required (30 characters)"),
    appToken: z.string().regex(/^[A-Za-z0-9]{30}$/, "Pushover app token required (30 characters)"),
  }),
  TELEGRAM: z.object({
    botToken: z.string().regex(/^\d{5,}:[A-Za-z0-9_-]{30,}$/, "Telegram bot token required"),
    chatId: z.string().regex(/^(?:-?\d{1,20}|@[A-Za-z0-9_]{5,32})$/, "Telegram chat id required"),
  }),
} as const;

export async function createNotificationChannel(
  userId: string,
  input: { type: NotificationType; name: string; config: unknown }
) {
  const schema = channelSchemas[input.type];
  const parsed = schema.safeParse(input.config);
  if (!parsed.success) throw new ValidationError("Invalid channel settings");
  const name = input.name.trim().slice(0, 100);
  if (!name) throw new ValidationError("Channel name is required");

  if (input.type === "WEBHOOK" || (input.type === "NTFY" && (parsed.data as { serverUrl?: string }).serverUrl)) {
    try {
      const d = parsed.data as { url?: string; serverUrl?: string };
      await assertPublicUrl((d.url ?? d.serverUrl) as string);
    } catch (err) {
      if (err instanceof UnsafeTargetError) throw new ValidationError(err.message);
      throw err;
    }
  }

  await getUser(userId);
  // Gizli bilgiler (Slack/webhook adresleri, telefon) şifreli saklanır
  const channel = await prisma.notificationChannel.create({
    data: {
      userId,
      type: input.type,
      name,
      config: { enc: encrypt(JSON.stringify(parsed.data)) },
      // E-posta kanalları doğrulanana kadar uyarı göndermez (test e-postası, bkz. Adım 11)
      isVerified: false,
    },
  });
  await logUsage(userId, "channel.create", { channelId: channel.id, type: input.type });
  return channel;
}

// --- Status page ---

const RESERVED_SLUGS = new Set([
  "www", "app", "api", "admin", "status", "mail", "smtp", "ftp", "dashboard", "login", "support", "help", "blog",
  "docs", "static", "assets", "cdn", "billing", "auth", "dev", "staging", "test", "cname", "custom-domain",
]);

const statusPageSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,30})[a-z0-9]$/, "3-32 chars: a-z, 0-9 and hyphens"),
  title: z.string().trim().min(1).max(100),
  monitorIds: z.array(z.string()).max(200).default([]),
  customDomain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^(?=.{4,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/)
    .optional(),
});

export async function createStatusPage(userId: string, config: z.input<typeof statusPageSchema>) {
  const parsed = statusPageSchema.safeParse(config);
  if (!parsed.success) throw new ValidationError("Invalid status page settings");
  const { slug, title, monitorIds, customDomain } = parsed.data;
  if (RESERVED_SLUGS.has(slug)) throw new ValidationError("This address is reserved");

  const user = await getUser(userId);
  const count = await prisma.statusPage.count({ where: { userId } });
  const limits = await getLimits(user.plan);
  assertStatusPageQuota(user.plan, count, limits);
  if (customDomain) assertCustomDomainAllowed(user.plan, limits);

  // Seçilen monitörlerin hepsi bu kullanıcıya ait olmalı
  const owned = await prisma.monitor.findMany({ where: { userId, id: { in: monitorIds } }, select: { id: true } });
  if (owned.length !== new Set(monitorIds).size) throw new NotFoundError("Monitor not found");

  const taken = await prisma.statusPage.findFirst({
    where: { OR: [{ slug }, ...(customDomain ? [{ customDomain }] : [])] },
    select: { id: true },
  });
  if (taken) throw new ValidationError("This address is already taken");

  const page = await prisma.statusPage.create({
    data: {
      userId,
      slug,
      customDomain,
      config: { title },
      monitors: { connect: owned.map((m) => ({ id: m.id })) },
    },
  });
  await logUsage(userId, "statuspage.create", { statusPageId: page.id });
  return page;
}

export type { Plan };
