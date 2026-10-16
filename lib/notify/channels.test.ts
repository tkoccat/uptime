import type { NotificationChannel } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encrypt } from "../crypto";

import { sendToExternalChannel, type AlertPayload } from "./channels";

const payload: AlertPayload = {
  event: "monitor.down",
  title: "Site is down",
  text: "https://example.com — timeout",
  time: "2026-10-16T10:00:00.000Z",
};

const channel = (type: NotificationChannel["type"], cfg: object) =>
  ({ id: "c1", userId: "u1", type, name: "n", isVerified: true, config: { enc: encrypt(JSON.stringify(cfg)) } }) as NotificationChannel;

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response("ok", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const body = () => JSON.parse(fetchMock.mock.calls[0][1].body as string);

describe("bildirim kanalı gönderimi", () => {
  it("Slack: başlık ve metin tek mesajda", async () => {
    await sendToExternalChannel(channel("SLACK", { webhookUrl: "https://hooks.slack.com/services/T/B/X" }), payload);
    expect(fetchMock.mock.calls[0][0]).toBe("https://hooks.slack.com/services/T/B/X");
    expect(body().text).toContain("Site is down");
  });

  it("Discord: content alanı, 2000 karakter sınırı altında", async () => {
    await sendToExternalChannel(channel("DISCORD", { webhookUrl: "https://discord.com/api/webhooks/123/abc-DEF" }), { ...payload, text: "x".repeat(5000) });
    expect(body().content.length).toBeLessThanOrEqual(1900);
    expect(body().content).toContain("**Site is down**");
  });

  it("Teams: uyarlanabilir kart", async () => {
    await sendToExternalChannel(channel("TEAMS", { webhookUrl: "https://acme.webhook.office.com/webhookb2/abc" }), payload);
    const b = body();
    expect(b.type).toBe("message");
    expect(b.attachments[0].contentType).toBe("application/vnd.microsoft.card.adaptive");
    expect(b.attachments[0].content.body[0].text).toBe("Site is down");
  });

  it("Telegram: bot anahtarıyla sabit API adresine, sohbet kimliğiyle gönderir", async () => {
    await sendToExternalChannel(channel("TELEGRAM", { botToken: "123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef-_", chatId: "-100123" }), payload);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.telegram.org/bot123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef-_/sendMessage");
    expect(body()).toMatchObject({ chat_id: "-100123", disable_web_page_preview: true });
    expect(body().text).toContain("Site is down");
  });

  it("hedef hata dönerse istisna fırlatılır, yönlendirme izlenmez", async () => {
    fetchMock.mockResolvedValue(new Response("no", { status: 500 }));
    await expect(sendToExternalChannel(channel("SLACK", { webhookUrl: "https://hooks.slack.com/services/T/B/X" }), payload)).rejects.toThrow(/500/);
    expect(fetchMock.mock.calls[0][1].redirect).toBe("error");
  });
});
