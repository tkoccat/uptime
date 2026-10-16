"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { mapSupabaseError, safeNextPath } from "@/lib/auth/messages";

function siteUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? `http://${headers().get("host")}`;
}

function fail(path: string, code: string): never {
  redirect(`${path}?error=${code}`);
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? ""));
  if (!email || !password) fail("/login", "missing_fields");

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) fail("/login", mapSupabaseError(error));

  redirect(next);
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!email || !password) fail("/register", "missing_fields");
  if (password.length < 8) fail("/register", "weak_password");
  if (password !== confirm) fail("/register", "password_mismatch");

  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback` },
  });
  if (error) fail("/register", mapSupabaseError(error));

  // E-posta doğrulaması zorunlu: kullanıcıdan gelen maili onaylaması istenir
  redirect("/login?info=check_email");
}

export async function signInWithGoogle() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${siteUrl()}/auth/callback` },
  });
  if (error || !data.url) fail("/login", "unknown");
  redirect(data.url);
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) fail("/forgot-password", "missing_fields");

  const supabase = createClient();
  // Hesap var mı yok mu bilgisini sızdırmamak için sonuç her zaman aynı gösterilir
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/reset-password`,
  });
  redirect("/forgot-password?info=check_email");
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) fail("/reset-password", "weak_password");
  if (password !== confirm) fail("/reset-password", "password_mismatch");

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) fail("/reset-password", mapSupabaseError(error));

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
