import type { Metadata } from "next";
import "../globals.css";

// Herkese açık durum sayfaları için ayrı kök düzen: dil öneki ve uygulama çerçevesi yok
export const metadata: Metadata = {
  title: "Status",
  robots: { index: true, follow: true },
};

const themeScript = `try{if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.add('dark')}}catch(e){}`;

export default function StatusRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
