"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DNS_SERVERS, DNS_TYPES, HTTP_METHODS, type MonitorOptions } from "@/lib/monitor-options";

type Option = { value: number; label: string };
type Kind = "HTTP" | "KEYWORD" | "PING" | "PORT" | "DNS" | "HEARTBEAT";

export type MonitorFormInitial = {
  id: string;
  name: string;
  type: Kind;
  url: string;
  keyword: string;
  interval: number;
  grace: number;
  description: string;
  tags: string;
  options: MonitorOptions;
};

const TYPES: Kind[] = ["HTTP", "KEYWORD", "PING", "PORT", "DNS", "HEARTBEAT"];
const select = "h-10 w-full rounded-md border bg-background px-3 text-sm";

function Check({ name, label, defaultChecked, help }: { name: string; label: string; defaultChecked: boolean; help?: string }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-1" />
      <span>
        {label}
        {help && <span className="block text-xs text-muted-foreground">{help}</span>}
      </span>
    </label>
  );
}

// Uptime Kuma tarzı monitör formu: temel alanlar üstte, gelişmiş ayarlar açılır bölümde.
// Aynı form hem oluşturma hem düzenleme için kullanılır (düzenlemede tür kilitlidir).
export function MonitorForm({
  action,
  intervals,
  periods,
  graces,
  defaultInterval,
  initial,
}: {
  action: (formData: FormData) => void | Promise<void>;
  intervals: Option[];
  periods: Option[];
  graces: Option[];
  defaultInterval: number;
  initial?: MonitorFormInitial;
}) {
  const t = useTranslations("Dash.monitors");
  const edit = Boolean(initial);
  const [type, setType] = useState<Kind>(initial?.type ?? "HTTP");
  const heartbeat = type === "HEARTBEAT";
  const http = type === "HTTP" || type === "KEYWORD";
  const o = initial?.options;

  return (
    <form action={action} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="name">{t("name")}</Label>
          <Input id="name" name="name" maxLength={100} required defaultValue={initial?.name} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="type">{t("type")}</Label>
          {edit ? (
            <>
              <input type="hidden" name="type" value={type} />
              <p className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm">{t(`types.${type}`)}</p>
            </>
          ) : (
            <select id="type" name="type" value={type} onChange={(e) => setType(e.target.value as Kind)} className={select}>
              {TYPES.map((x) => (
                <option key={x} value={x}>
                  {t(`types.${x}`)}
                </option>
              ))}
            </select>
          )}
        </div>

        {heartbeat ? (
          <div className="space-y-1">
            <Label htmlFor="interval">{t("period")}</Label>
            <select id="interval" name="interval" defaultValue={String(initial?.interval ?? periods.find((p) => p.value >= 3600)?.value ?? periods[0]?.value)} className={select}>
              {periods.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="space-y-1">
            <Label htmlFor="interval">{t("interval")}</Label>
            <select id="interval" name="interval" defaultValue={String(initial?.interval ?? defaultInterval)} className={select}>
              {intervals.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {heartbeat ? (
          <>
            <p className="rounded-md bg-muted p-3 text-sm sm:col-span-2">{t("heartbeatHelp")}</p>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="grace">{t("grace")}</Label>
              <select id="grace" name="grace" defaultValue={String(initial?.grace ?? 300)} className={select}>
                {graces.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">{t("graceHelp")}</p>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="url">{t("target")}</Label>
              <Input id="url" name="url" required defaultValue={initial?.url} />
              <p className="text-xs text-muted-foreground">{t("targetHelp")}</p>
            </div>
            {type === "KEYWORD" && (
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="keyword">{t("keyword")}</Label>
                <Input id="keyword" name="keyword" maxLength={200} required defaultValue={initial?.keyword} />
              </div>
            )}
          </>
        )}
      </div>

      <details className="rounded-md border p-3" open={edit}>
        <summary className="cursor-pointer text-sm font-medium">{t("advanced")}</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {!heartbeat && (
            <>
              <input type="hidden" name="opt_present" value="1" />

              <div className="space-y-1">
                <Label htmlFor="opt_retries">{t("retries")}</Label>
                <Input id="opt_retries" name="opt_retries" type="number" min={0} max={10} defaultValue={o?.retries ?? 1} />
                <p className="text-xs text-muted-foreground">{t("retriesHelp")}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="opt_retryInterval">{t("retryInterval")}</Label>
                <Input id="opt_retryInterval" name="opt_retryInterval" type="number" min={0} max={3600} defaultValue={o?.retryInterval ?? 0} />
                <p className="text-xs text-muted-foreground">{t("retryIntervalHelp")}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="opt_timeout">{t("timeout")}</Label>
                <Input id="opt_timeout" name="opt_timeout" type="number" min={0} max={120} defaultValue={o?.timeout ?? 0} />
                <p className="text-xs text-muted-foreground">{t("timeoutHelp")}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="opt_resendEvery">{t("resend")}</Label>
                <Input id="opt_resendEvery" name="opt_resendEvery" type="number" min={0} max={100} defaultValue={o?.resendEvery ?? 0} />
                <p className="text-xs text-muted-foreground">{t("resendHelp")}</p>
              </div>

              {http && (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="opt_method">{t("method")}</Label>
                    <select id="opt_method" name="opt_method" defaultValue={o?.method ?? "GET"} className={select}>
                      {HTTP_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="opt_status">{t("accepted")}</Label>
                    <Input id="opt_status" name="opt_status" defaultValue={(o?.acceptedStatus ?? ["200-299"]).join(", ")} />
                    <p className="text-xs text-muted-foreground">{t("acceptedHelp")}</p>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="opt_headers">{t("headers")}</Label>
                    <textarea
                      id="opt_headers"
                      name="opt_headers"
                      rows={3}
                      maxLength={2000}
                      defaultValue={o?.headers ?? ""}
                      placeholder='{"Authorization": "Bearer …"}'
                      className="w-full rounded-md border bg-background px-3 py-2 font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="opt_body">{t("body")}</Label>
                    <textarea id="opt_body" name="opt_body" rows={3} maxLength={2000} defaultValue={o?.body ?? ""} className="w-full rounded-md border bg-background px-3 py-2 font-mono text-xs" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Check name="opt_followRedirects" label={t("followRedirects")} defaultChecked={o?.followRedirects ?? true} />
                    <Check name="opt_ignoreTls" label={t("ignoreTls")} defaultChecked={o?.ignoreTls ?? false} />
                    <Check name="opt_certExpiry" label={t("certExpiry")} defaultChecked={o?.certExpiry ?? false} />
                  </div>
                </>
              )}

              {type === "DNS" && (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="opt_dnsType">{t("dnsType")}</Label>
                    <select id="opt_dnsType" name="opt_dnsType" defaultValue={o?.dnsType ?? "A"} className={select}>
                      {DNS_TYPES.map((x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="opt_dnsServer">{t("dnsServer")}</Label>
                    <select id="opt_dnsServer" name="opt_dnsServer" defaultValue={o?.dnsServer ?? "1.1.1.1"} className={select}>
                      {DNS_SERVERS.map((x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="sm:col-span-2">
                <Check name="opt_upsideDown" label={t("upsideDown")} help={t("upsideDownHelp")} defaultChecked={o?.upsideDown ?? false} />
              </div>
            </>
          )}

          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="tags">{t("tags")}</Label>
            <Input id="tags" name="tags" maxLength={300} defaultValue={initial?.tags} placeholder="production, api" />
            <p className="text-xs text-muted-foreground">{t("tagsHelp")}</p>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="description">{t("description")}</Label>
            <Input id="description" name="description" maxLength={200} defaultValue={initial?.description} />
          </div>
        </div>
      </details>

      <Button type="submit" className="w-full sm:w-auto">
        {edit ? t("saveChanges") : t("create")}
      </Button>
    </form>
  );
}
