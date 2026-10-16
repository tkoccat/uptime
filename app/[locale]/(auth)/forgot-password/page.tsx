import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { requestPasswordReset } from "../actions";

export default async function ForgotPasswordPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: { error?: string; info?: string };
}) {
  setRequestLocale(locale);
  const t = await getTranslations("Auth");

  return (
    <AuthShell
      title={t("forgotTitle")}
      description={t("forgotDescription")}
      error={searchParams.error}
      info={searchParams.info}
    >
      <form action={requestPasswordReset} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <Button type="submit" className="w-full">
          {t("sendReset")}
        </Button>
      </form>
      <Link href="/login" className="text-sm underline">
        {t("backToSignIn")}
      </Link>
    </AuthShell>
  );
}
