// Saat dilimi yardımcıları (bağımlılıksız, Intl tabanlı)

// Verilen anın o saat dilimindeki UTC farkı (milisaniye)
function offsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * "YYYY-MM-DDTHH:mm" biçimindeki yerel zamanı (datetime-local alanı) verilen saat dilimi olarak yorumlayıp UTC Date'e çevirir.
 * Geçersiz metin için Invalid Date döner.
 */
export function zonedToUtc(local: string, timeZone: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local.trim());
  if (!m) return new Date(NaN);
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Yaz saati geçişlerinde doğru farkı bulmak için iki yineleme yeterlidir
  let utc = guess - offsetMs(guess, timeZone);
  utc = guess - offsetMs(utc, timeZone);
  return new Date(utc);
}
