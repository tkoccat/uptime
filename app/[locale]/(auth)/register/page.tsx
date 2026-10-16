import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { signInWithGoogle, signUp } from "../actions";

export default async function RegisterPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: { error?: string };
}) {
  setRequestLocale(locale);
  const t = await getTranslations("Auth");

  return (
    <AuthShell title={t("registerTitle")} description={t("registerDescription")} error={searchParams.error}>
      <form action={signUp} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="password">{t("password")}</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="confirm">{t("confirmPassword")}</Label>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
        </div>
        <Button type="submit" className="w-full">
          {t("registerButton")}
        </Button>
      </form>
      <form action={signInWithGoogle}>
        <Button type="submit" variant="outline" className="w-full">
          {t("google")}
        </Button>
      </form>
      <p className="text-sm">
        {t("haveAccount")}{" "}
        <Link href="/login" className="underline">
          {t("signInButton")}
        </Link>
      </p>
    </AuthShell>
  );
}
