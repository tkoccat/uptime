import { describe, expect, it } from "vitest";
import { adminEmails, isAdminEmail } from "./emails";

describe("admin e-posta kontrolü", () => {
  it("tek veya çoklu (virgüllü) liste, büyük/küçük harf duyarsız", () => {
    expect(adminEmails("A@x.com, b@y.com ,")).toEqual(["a@x.com", "b@y.com"]);
    expect(isAdminEmail("A@X.com", "a@x.com")).toBe(true);
    expect(isAdminEmail("b@y.com", "a@x.com,b@y.com")).toBe(true);
  });

  it("liste dışındaki ve benzer görünen adresler reddedilir", () => {
    expect(isAdminEmail("c@z.com", "a@x.com")).toBe(false);
    expect(isAdminEmail("a@x.com.evil.com", "a@x.com")).toBe(false);
    expect(isAdminEmail("aa@x.com", "a@x.com")).toBe(false);
  });

  it("ADMIN_EMAIL tanımsız veya boşsa kimse yönetici değildir", () => {
    expect(isAdminEmail("a@x.com", "")).toBe(false);
    expect(isAdminEmail("a@x.com", undefined)).toBe(false);
    expect(isAdminEmail("", "")).toBe(false);
  });
});
