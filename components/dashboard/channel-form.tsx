"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ChannelType = "EMAIL" | "SLACK" | "DISCORD" | "TELEGRAM" | "TEAMS" | "GOOGLE_CHAT" | "NTFY" | "PUSHOVER" | "WEBHOOK" | "SMS";

export const CHANNEL_TYPES: ChannelType[] = ["EMAIL", "SLACK", "DISCORD", "TELEGRAM", "TEAMS", "GOOGLE_CHAT", "NTFY", "PUSHOVER", "WEBHOOK", "SMS"];

// Alanlar seçilen türe göre değişir: yalnızca ilgili girdiler gösterilir (sunucu da yalnızca onları okur)
type Field = { name: string; label: string; type?: string; required?: boolean; placeholder?: string };

export function ChannelForm({ action }: { action: (fd: FormData) => void | Promise<void> }) {
  const t = useTranslations("Dash.notifications");
  const [type, setType] = useState<ChannelType>("EMAIL");

  const webhook: Field = { name: "webhookUrl", label: t("webhookUrl"), type: "url", required: true };
  const FIELDS: Record<ChannelType, Field[]> = {
    EMAIL: [{ name: "email", label: t("email"), type: "email", required: true }],
    SLACK: [{ ...webhook, placeholder: "https://hooks.slack.com/services/…" }],
    DISCORD: [{ ...webhook, placeholder: "https://discord.com/api/webhooks/…" }],
    TEAMS: [webhook],
    GOOGLE_CHAT: [{ ...webhook, placeholder: "https://chat.googleapis.com/v1/spaces/…" }],
    WEBHOOK: [webhook],
    TELEGRAM: [
      { name: "botToken", label: t("botToken"), required: true },
      { name: "chatId", label: t("chatId"), required: true },
    ],
    NTFY: [
      { name: "topic", label: t("ntfyTopic"), required: true },
      { name: "serverUrl", label: t("ntfyServer"), type: "url", placeholder: "https://ntfy.sh" },
      { name: "token", label: t("ntfyToken") },
    ],
    PUSHOVER: [
      { name: "userKey", label: t("pushoverUser"), required: true },
      { name: "appToken", label: t("pushoverApp"), required: true },
    ],
    SMS: [{ name: "phone", label: t("phone"), required: true, placeholder: "+447700900123" }],
  };

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor="cname">{t("name")}</Label>
        <Input id="cname" name="name" maxLength={100} required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="ctype">{t("type")}</Label>
        <select id="ctype" name="type" value={type} onChange={(e) => setType(e.target.value as ChannelType)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {CHANNEL_TYPES.map((x) => (
            <option key={x} value={x}>
              {t(`types.${x}`)}
            </option>
          ))}
        </select>
      </div>
      {/* key: tür değişince alanlar sıfırlanır, eski türün değerleri gönderilmez */}
      {FIELDS[type].map((f) => (
        <div key={`${type}-${f.name}`} className="space-y-1">
          <Label htmlFor={`c-${f.name}`}>{f.label}</Label>
          <Input id={`c-${f.name}`} name={f.name} type={f.type ?? "text"} required={f.required} placeholder={f.placeholder} autoComplete="off" />
        </div>
      ))}
      <div className="flex items-end sm:col-span-2">
        <Button type="submit">{t("create")}</Button>
      </div>
    </form>
  );
}
