import type { MonitorType, NotificationType, Plan } from "@prisma/client";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { encrypt } from "./crypto";
import { NotFoundError, ValidationError } from "./errors";
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
  })
  .superRefine((v, ctx) => {
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

  if (input.type === "WEBHOOK") {
    try {
      await assertPublicUrl((parsed.data as { url: string }).url);
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
