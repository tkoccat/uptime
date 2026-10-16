import { headers } from "next/headers";

// İstemci IP'si: Caddy/Traefik arkasında X-Forwarded-For'un ilk değeri
export function getClientIp(): string {
  const h = headers();
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || h.get("x-real-ip") || "unknown";
}

export function getUserAgent(): string {
  return headers().get("user-agent")?.slice(0, 300) ?? "";
}
