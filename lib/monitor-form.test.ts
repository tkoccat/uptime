import { describe, expect, it } from "vitest";
import { monitorOptionsSchema } from "./monitor-options";
import { readMonitorForm } from "./monitor-form";

const form = (entries: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
};

// Tarayıcının HTTP monitörü formu için gerçekte gönderdiği alanlar (DNS alanları yok)
const httpForm = {
  name: "site", type: "HTTP", url: "https://example.com", interval: "180", opt_present: "1",
  opt_retries: "1", opt_retryInterval: "0", opt_timeout: "0", opt_resendEvery: "0",
  opt_method: "GET", opt_status: "200-299", opt_headers: "", opt_body: "", opt_followRedirects: "on", tags: "", description: "",
};

describe("readMonitorForm", () => {
  it("HTTP formu (DNS alanları olmadan) geçerli seçenek üretir", () => {
    const input = readMonitorForm(form(httpForm));
    const parsed = monitorOptionsSchema.safeParse(input.options);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({ method: "GET", retries: 1, followRedirects: true, ignoreTls: false, dnsType: "A" });
  });

  it("PING/DNS formunda HTTP alanları olmasa da geçerlidir ve onay kutuları varsayılanda kalır", () => {
    const input = readMonitorForm(form({ name: "p", type: "DNS", url: "example.com", interval: "300", opt_present: "1", opt_retries: "2", opt_dnsType: "MX", opt_dnsServer: "8.8.8.8" }));
    const parsed = monitorOptionsSchema.parse(input.options);
    expect(parsed).toMatchObject({ dnsType: "MX", dnsServer: "8.8.8.8", followRedirects: true, retries: 2 });
  });

  it("onay kutuları kaldırılınca kapanır; heartbeat'te seçenek gönderilmez", () => {
    const off = readMonitorForm(form({ ...httpForm, opt_followRedirects: "" }));
    const fd = form(httpForm);
    fd.delete("opt_followRedirects");
    expect(monitorOptionsSchema.parse(readMonitorForm(fd).options).followRedirects).toBe(false);
    expect(off.options).toBeDefined();
    expect(readMonitorForm(form({ name: "j", type: "HEARTBEAT", interval: "3600", grace: "300" })).options).toBeUndefined();
  });
});
