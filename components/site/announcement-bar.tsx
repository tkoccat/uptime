import { getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getAnnouncement } from "@/lib/site-config";

const TONES = {
  info: "bg-primary text-primary-foreground",
  sale: "bg-amber-500 text-black",
  warning: "bg-destructive text-white",
} as const;

// Admin panelinden yönetilen duyuru bandı (site ve panel üstünde)
export async function AnnouncementBar() {
  const a = await getAnnouncement();
  if (!a.enabled) return null;
  const locale = await getLocale();
  const text = a.text[locale] || a.text.en;
  if (!text) return null;

  const body = <span>{text}</span>;
  return (
    <div role="status" className={`px-4 py-2 text-center text-sm ${TONES[a.tone] ?? TONES.info}`}>
      {a.link ? (
        a.link.startsWith("/") ? (
          <Link href={a.link} className="underline">
            {body}
          </Link>
        ) : (
          <a href={a.link} className="underline" rel="noreferrer">
            {body}
          </a>
        )
      ) : (
        body
      )}
    </div>
  );
}
