import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { signIn, signInWithGoogle } from "../actions";

export default async function LoginPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: { error?: string; info?: string; next?: string };
}) {
  setRequestLocale(locale);
  const t = await getTranslations("Auth");

  return (
    <AuthShell title={t("signInTitle")} error={searchParams.error} info={searchParams.info}>
      <form action={signIn} className="space-y-3">
        <input type="hidden" name="next" value={searchParams.next ?? ""} />
        <div className="space-y-1">
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="password">{t("password")}</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <Button type="submit" className="w-full">
          {t("signInButton")}
        </Button>
      </form>
      <form action={signInWithGoogle}>
        <Button type="submit" variant="outline" className="w-full">
          {t("google")}
        </Button>
      </form>
      <div className="flex justify-between text-sm">
        <Link href="/forgot-password" className="underline">
          {t("forgotLink")}
        </Link>
        <Link href="/register" className="underline">
          {t("createLink")}
        </Link>
      </div>
    </AuthShell>
  );
}
