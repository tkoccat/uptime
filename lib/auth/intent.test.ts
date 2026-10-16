import { describe, expect, it } from "vitest";
import { safeNextPath } from "./messages";
import { intentPath, parsePlanIntent } from "./intent";

describe("plan niyeti", () => {
  it("geçerli ücretli planı ve dönemi tanır (büyük/küçük harf duyarsız)", () => {
    expect(parsePlanIntent("pro", "yearly")).toEqual({ plan: "PRO", billing: "yearly" });
    expect(parsePlanIntent("BUSINESS", "monthly")).toEqual({ plan: "BUSINESS", billing: "monthly" });
  });

  it("bilinmeyen dönem aylığa düşer; free ve rastgele değerler reddedilir", () => {
    expect(parsePlanIntent("pro", "weekly")).toEqual({ plan: "PRO", billing: "monthly" });
    expect(parsePlanIntent("free", "monthly")).toBeNull();
    expect(parsePlanIntent("<script>", "yearly")).toBeNull();
    expect(parsePlanIntent(undefined, undefined)).toBeNull();
  });

  it("yol site içidir ve açık yönlendirme denetiminden geçer", () => {
    const p = intentPath({ plan: "PRO", billing: "yearly" });
    expect(p).toBe("/dashboard/billing?select=PRO&billing=yearly");
    expect(safeNextPath(p)).toBe(p);
    expect(intentPath(null)).toBe("/dashboard");
  });
});
