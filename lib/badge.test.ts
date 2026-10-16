import { describe, expect, it } from "vitest";
import { renderBadge, statusBadge, uptimeBadge } from "./badge";
import type { StatusPageData, StatusMonitor } from "./status-page/data";

const mon = (over: Partial<StatusMonitor> = {}): StatusMonitor => ({ id: "m", name: "x", isActive: true, isDown: false, days: [], uptime: 100, ...over });
const page = (monitors: StatusMonitor[]): StatusPageData => ({ title: "t", locale: "en", timezone: "UTC", monitors, incidents: [] });

describe("rozetler", () => {
  it("geçerli SVG üretir ve metni kaçırır (XSS)", () => {
    const svg = renderBadge('<b>"x"</b>', "a&b", "green");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).not.toContain("<b>");
    expect(svg).toContain("&lt;b&gt;");
    expect(svg).toContain("a&amp;b");
  });

  it("genel durum: hepsi çalışıyor / kısmi / tam kesinti / veri yok / bilinmiyor", () => {
    expect(statusBadge(page([mon(), mon()]))).toContain("operational");
    expect(statusBadge(page([mon(), mon({ isDown: true })]))).toContain("partial outage");
    expect(statusBadge(page([mon({ isDown: true })]))).toContain("major outage");
    expect(statusBadge(page([mon({ isActive: false })]))).toContain("no data");
    expect(statusBadge(null)).toContain("unknown");
  });

  it("duraklatılmış monitörler genel durumu bozmaz", () => {
    expect(statusBadge(page([mon(), mon({ isActive: false, isDown: true })]))).toContain("operational");
  });

  it("uptime rozeti ortalamayı gösterir ve eşiklere göre renklenir", () => {
    expect(uptimeBadge(page([mon({ uptime: 100 }), mon({ uptime: 99.9 })]))).toContain("99.95%");
    expect(uptimeBadge(page([mon({ uptime: 99.5 })]))).toContain("#d9822b"); // amber
    expect(uptimeBadge(page([mon({ uptime: 90 })]))).toContain("#d64545"); // red
    expect(uptimeBadge(page([mon({ uptime: null })]))).toContain("n/a");
    expect(uptimeBadge(null)).toContain("n/a");
  });
});
