// Basit bellek içi TTL önbelleği: admin ayarları her istekte veritabanını yormasın.
// Tek süreçli çalışır; admin kaydedince invalidate() çağrılır (çok instance'ta en geç TTL kadar gecikir).

export type TtlCache<T> = { get(): Promise<T>; invalidate(): void };

export function ttlCache<T>(ttlMs: number, loader: () => Promise<T>): TtlCache<T> {
  let value: { data: T; at: number } | null = null;
  let inflight: Promise<T> | null = null;

  return {
    async get() {
      if (value && Date.now() - value.at < ttlMs) return value.data;
      // Aynı anda gelen istekler tek yüklemeyi paylaşır
      inflight ??= loader()
        .then((data) => {
          value = { data, at: Date.now() };
          return data;
        })
        .finally(() => {
          inflight = null;
        });
      return inflight;
    },
    invalidate() {
      value = null;
    },
  };
}
