import { isIP } from "node:net";

// Host başlığına göre isteğin hangi durum sayfasına ait olduğunu belirler (middleware'de kullanılır).
// Saf fonksiyon: env değerleri dışarıdan verilir, böylece test edilebilir.

export type HostConfig = {
  appHost: string; // örn. app.siten.com
  statusBaseDomain: string; // örn. siten.com
  extraAppHosts: string[]; // www, iç ağ adları vb.
};

export type HostRoute =
  | { kind: "app" }
  | { kind: "slug"; slug: string }
  | { kind: "custom-domain"; host: string };

const SKIP_SUBDOMAINS = new Set(["www", "app", "api", "admin", "cname", "mail"]);

export function resolveHostRoute(rawHost: string | null, cfg: HostConfig): HostRoute {
  const host = (rawHost ?? "").split(":")[0].toLowerCase();
  if (!host) return { kind: "app" };

  const appHosts = new Set([cfg.appHost, cfg.statusBaseDomain, "localhost", "127.0.0.1", ...cfg.extraAppHosts]);
  if (appHosts.has(host) || isIP(host)) return { kind: "app" };

  const suffix = `.${cfg.statusBaseDomain}`;
  if (host.endsWith(suffix)) {
    const sub = host.slice(0, -suffix.length);
    // Tek seviyeli alt alan adı = durum sayfası; diğerleri uygulamaya aittir
    if (sub && !sub.includes(".") && !SKIP_SUBDOMAINS.has(sub)) return { kind: "slug", slug: sub };
    return { kind: "app" };
  }

  // Bilinmeyen herhangi bir ana makine: özel alan adı olarak ele alınır
  return { kind: "custom-domain", host };
}
