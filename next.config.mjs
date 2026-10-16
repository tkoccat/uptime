import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker imajı için küçük, bağımsız çıktı. Yerelde `next start` ile çalışabilmesi için
  // yalnızca Dockerfile'ın verdiği BUILD_STANDALONE=true ile açılır.
  output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined,
  poweredByHeader: false,
  // Sunucu tarafı paketler webpack'e gömülmez: bullmq'nun isteğe bağlı bağımlılık uyarısını ve gereksiz boyutu önler
  experimental: { serverComponentsExternalPackages: ["bullmq", "ioredis", "socket.io-client"] },
};

export default withNextIntl(nextConfig);
