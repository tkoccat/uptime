// Fiyat sayfasından gelen "şu planı almak istiyorum" niyeti: kayıt ve e-posta doğrulaması boyunca taşınır,
// ilk girişte kullanıcı doğrudan seçtiği planın ödeme adımına yönlendirilir.

export type PlanIntent = { plan: "PRO" | "BUSINESS"; billing: "monthly" | "yearly" };

/** Kullanıcı girdisini doğrular: yalnızca bilinen ücretli plan ve dönem kabul edilir. */
export function parsePlanIntent(plan: unknown, billing: unknown): PlanIntent | null {
  const p = String(plan ?? "").toUpperCase();
  if (p !== "PRO" && p !== "BUSINESS") return null;
  return { plan: p, billing: billing === "yearly" ? "yearly" : "monthly" };
}

/** Giriş sonrası gidilecek site içi yol (safeNextPath'ten geçer). */
export function intentPath(intent: PlanIntent | null): string {
  return intent ? `/dashboard/billing?select=${intent.plan}&billing=${intent.billing}` : "/dashboard";
}
