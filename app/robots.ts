import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Oturum gerektiren ve makine kullanımına yönelik yollar dizinlenmez
        disallow: ["/dashboard", "/admin", "/api/", "/auth/", "/login", "/register", "/forgot-password", "/reset-password", "/*/dashboard", "/*/admin"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
