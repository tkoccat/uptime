import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { parsePlanIntent } from "@/lib/auth/intent";
import { signInWithGoogle, signUp } from "../actions";

export default async function RegisterPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: { error?: string; plan?: string; billing?: string };
}) {
  setRequestLocale(locale);
  const t = await getTranslations("Auth");
  // Fiyat sayfasından gelen plan seçimi (yalnızca geçerli ücretli planlar kabul edilir)
  const intent = parsePlanIntent(searchParams.plan, searchParams.billing);

  return (
    <AuthShell title={t("registerTitle")} description={t("registerDescription")} error={searchParams.error}>
      <form action={signUp} className="space-y-3">
        {intent && (
          <>
            <input type="hidden" name="plan" value={intent.plan} />
            <input type="hidden" name="billing" value={intent.billing} />
          </>
        )}
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
        {intent && (
          <>
            <input type="hidden" name="plan" value={intent.plan} />
            <input type="hidden" name="billing" value={intent.billing} />
          </>
        )}
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
