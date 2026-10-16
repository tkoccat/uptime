import { describe, expect, it } from "vitest";
import { resolveHostRoute, type HostConfig } from "./host";

const cfg: HostConfig = { appHost: "app.siten.com", statusBaseDomain: "siten.com", extraAppHosts: ["www.siten.com", "nextjs-app"] };

describe("resolveHostRoute", () => {
  it("uygulama ana makineleri ve IP/localhost uygulamaya gider", () => {
    for (const h of ["app.siten.com", "siten.com", "localhost:3000", "127.0.0.1:3000", "185.97.146.46:3000", "www.siten.com", "nextjs-app:3000", null, ""]) {
      expect(resolveHostRoute(h, cfg)).toEqual({ kind: "app" });
    }
  });

  it("<slug>.siten.com durum sayfasına yönlenir (büyük/küçük harf duyarsız)", () => {
    expect(resolveHostRoute("acme.siten.com", cfg)).toEqual({ kind: "slug", slug: "acme" });
    expect(resolveHostRoute("ACME.Siten.com:443", cfg)).toEqual({ kind: "slug", slug: "acme" });
  });

  it("ayrılmış veya çok seviyeli alt alan adları durum sayfası sayılmaz", () => {
    expect(resolveHostRoute("api.siten.com", cfg)).toEqual({ kind: "app" });
    expect(resolveHostRoute("admin.siten.com", cfg)).toEqual({ kind: "app" });
    expect(resolveHostRoute("a.b.siten.com", cfg)).toEqual({ kind: "app" });
  });

  it("bilinmeyen alan adı özel alan adı olarak ele alınır", () => {
    expect(resolveHostRoute("status.customer.com", cfg)).toEqual({ kind: "custom-domain", host: "status.customer.com" });
  });

  it("benzer görünen alan adı (siten.com.evil.com) alt alan adı sayılmaz", () => {
    expect(resolveHostRoute("siten.com.evil.com", cfg)).toEqual({ kind: "custom-domain", host: "siten.com.evil.com" });
  });
});
