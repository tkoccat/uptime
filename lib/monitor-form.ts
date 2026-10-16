import { parseStatusList, parseTags } from "./monitor-options";
import type { MonitorInput } from "./uptimeKuma";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "");
// Boş veya forma hiç eklenmemiş alan "yok" sayılır; böylece servis katmanındaki varsayılanlar devreye girer
const text = (fd: FormData, key: string) => str(fd, key).trim() || undefined;
const num = (fd: FormData, key: string) => (str(fd, key).trim() === "" ? undefined : Number(str(fd, key)));

/** Monitör formunu (oluşturma ve düzenleme) servis katmanının beklediği girdiye çevirir. */
export function readMonitorForm(fd: FormData): MonitorInput {
  // Gelişmiş ayarlar yalnızca form bunları gönderdiyse (heartbeat'te gönderilmez) okunur
  const hasOptions = fd.get("opt_present") === "1";
  return {
    name: str(fd, "name"),
    url: str(fd, "url"),
    type: str(fd, "type") as "HTTP",
    interval: Number(str(fd, "interval")),
    keyword: str(fd, "keyword") || undefined,
    grace: str(fd, "grace") ? Number(str(fd, "grace")) : 0,
    description: str(fd, "description") || undefined,
    tags: parseTags(str(fd, "tags")),
    options: hasOptions
      ? {
          // Türe özgü alanlar (yöntem, DNS vb.) başka türlerde formda yoktur: boş gelirse varsayılan kullanılır
          method: text(fd, "opt_method") as "GET" | undefined,
          retries: num(fd, "opt_retries"),
          retryInterval: num(fd, "opt_retryInterval"),
          timeout: num(fd, "opt_timeout"),
          acceptedStatus: text(fd, "opt_status") ? parseStatusList(str(fd, "opt_status")) : undefined,
          // Onay kutuları yalnızca HTTP türünde bulunur; yoksa varsayılan kalır
          followRedirects: fd.has("opt_status") ? fd.get("opt_followRedirects") === "on" : undefined,
          ignoreTls: fd.has("opt_status") ? fd.get("opt_ignoreTls") === "on" : undefined,
          certExpiry: fd.has("opt_status") ? fd.get("opt_certExpiry") === "on" : undefined,
          upsideDown: fd.get("opt_upsideDown") === "on",
          headers: text(fd, "opt_headers"),
          body: str(fd, "opt_body") || undefined,
          resendEvery: num(fd, "opt_resendEvery"),
          dnsType: text(fd, "opt_dnsType") as "A" | undefined,
          dnsServer: text(fd, "opt_dnsServer") as "1.1.1.1" | undefined,
        }
      : undefined,
  };
}
