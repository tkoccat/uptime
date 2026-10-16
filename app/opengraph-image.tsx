import { ImageResponse } from "next/og";
import baseCompany from "@/lib/company.json";

// Edge çalışma zamanı: Node sürümü Windows'ta derleme sırasında font yolunu çözemiyor, edge her ortamda çalışır
export const runtime = "edge";
export const alt = "Website monitoring for indie hackers and small teams";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Paylaşım (Open Graph) görseli: bağlantı önizlemelerinde (sosyal medya, sohbet uygulamaları) görünür.
// Şirket adı company.json'dan gelir; admin panelinden değiştirilen ad görsele yansımaz (önbelleğe alınır).
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #07122b 0%, #0b1f44 60%, #0f3d4a 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="72" height="72" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="8" fill="#2dd4bf" />
            <circle cx="16" cy="16" r="8" fill="none" stroke="#07122b" strokeWidth="2.6" strokeDasharray="38 12" strokeLinecap="round" />
            <circle cx="16" cy="16" r="2.8" fill="#07122b" />
          </svg>
          <div style={{ fontSize: 40, fontWeight: 700 }}>{baseCompany.productName}</div>
        </div>
        <div style={{ marginTop: 48, fontSize: 68, fontWeight: 800, lineHeight: 1.1, maxWidth: 980 }}>
          Website monitoring for indie hackers and small teams
        </div>
        <div style={{ marginTop: 28, fontSize: 30, color: "#9fb3c8" }}>Uptime checks · Cron job monitoring · Status pages · Alerts</div>
      </div>
    ),
    size
  );
}
