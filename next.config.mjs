import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Tüm yanıtlara eklenen güvenlik başlıkları.
// CSP bilinçli olarak yok: reklam/analiz betikleri (onayla yüklenir) ve satır içi tema betiği için ayrı, dikkatli bir politika gerekir.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  // HTTPS üzerinde tarayıcıya yalnızca güvenli bağlantıyı hatırlatır (HTTP'de yok sayılır)
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker imajı için küçük, bağımsız çıktı. Yerelde `next start` ile çalışabilmesi için
  // yalnızca Dockerfile'ın verdiği BUILD_STANDALONE=true ile açılır.
  output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined,
  poweredByHeader: false,
  // Sunucu tarafı paketler webpack'e gömülmez: bullmq'nun isteğe bağlı bağımlılık uyarısını ve gereksiz boyutu önler
  experimental: { serverComponentsExternalPackages: ["bullmq", "ioredis", "socket.io-client"] },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
