import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { isLocale, routing } from "@/i18n/routing";
import { isAdminEmail } from "../admin/emails";
import { prisma } from "../prisma";
import { createClient } from "../supabase/server";

/**
 * Oturum açmış kullanıcının SaaS veritabanı kaydını döndürür; oturum yoksa girişe yönlendirir.
 * Kayıt henüz yoksa (örn. callback atlanmışsa) oluşturulur.
 */
export async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect({ href: "/login", locale: await getLocale() });
    throw new Error("unreachable");
  }

  const metaLocale = user.user_metadata?.locale as string | undefined;
  const record = await prisma.user.upsert({
    where: { supabaseId: user.id },
    update: {},
    create: {
      supabaseId: user.id,
      email: user.email,
      name: (user.user_metadata?.full_name as string | undefined) ?? null,
      locale: isLocale(metaLocale) ? metaLocale : routing.defaultLocale,
    },
  });

  // Yönetici tarafından askıya alınan hesap panele giremez (yöneticinin kendisi hariç: kilitlenmesin)
  if (record.suspendedAt && !isAdminEmail(record.email)) {
    redirect({ href: "/login?error=suspended", locale: await getLocale() });
    throw new Error("unreachable");
  }
  return record;
}
