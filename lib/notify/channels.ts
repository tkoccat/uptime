import type { NotificationChannel } from "@prisma/client";
import { decrypt } from "../crypto";
import { assertPublicUrl } from "../security/url-guard";

export type AlertPayload = {
  event: "monitor.down" | "monitor.up" | "test";
  title: string;
  text: string;
  monitor?: { id: string; name: string; url: string };
  time: string;
};

type ChannelSecrets = { email?: string; webhookUrl?: string; url?: string; phone?: string };

export function readChannelConfig(channel: Pick<NotificationChannel, "config">): ChannelSecrets {
  const enc = (channel.config as { enc?: string } | null)?.enc;
  if (!enc) throw new Error("Kanal ayarları okunamadı");
  return JSON.parse(decrypt(enc)) as ChannelSecrets;
}

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8_000),
    redirect: "error", // yönlendirmelerle iç adrese sıçramayı engeller
  });
  if (!res.ok) throw new Error(`Hedef ${res.status} döndü`);
}

// E-posta kanalı dışındaki kanalları gönderir (e-posta, çağıran tarafta şablonla gönderilir)
export async function sendToExternalChannel(channel: NotificationChannel, payload: AlertPayload): Promise<void> {
  const cfg = readChannelConfig(channel);

  switch (channel.type) {
    case "SLACK":
      await post(cfg.webhookUrl!, { text: `*${payload.title}*\n${payload.text}` });
      return;
    case "WEBHOOK": {
      // Gönderim anında tekrar doğrula: kayıttan sonra DNS iç adrese çevrilmiş olabilir
      await assertPublicUrl(cfg.url!);
      await post(cfg.url!, payload);
      return;
    }
    case "SMS": {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const token = process.env.TWILIO_AUTH_TOKEN;
      const from = process.env.TWILIO_FROM;
      if (!sid || !token || !from) throw new Error("SMS sağlayıcısı (Twilio) yapılandırılmamış");
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: cfg.phone!, From: from, Body: `${payload.title}: ${payload.text}`.slice(0, 300) }),
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) throw new Error(`Twilio hatası ${res.status}`);
      return;
    }
    default:
      throw new Error(`Bu kanal türü burada gönderilemez: ${channel.type}`);
  }
}
