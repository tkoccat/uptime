import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Supabase ortam değişkenleri tanımlı mı? (ilk kurulumda boş olabilir; eylemler çökmek yerine hata kodu döndürür)
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

// Sunucu tarafı Supabase istemcisi (Server Component, Server Action, Route Handler)
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, { ...options, httpOnly: true })
            );
          } catch {
            // Server Component içinden çağrılırsa cookie yazılamaz;
            // oturumu middleware yeniler, bu hata güvenle yok sayılır
          }
        },
      },
    }
  );
}
