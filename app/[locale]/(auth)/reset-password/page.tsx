import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePassword } from "../actions";

export default async function ResetPasswordPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: { error?: string };
}) {
  setRequestLocale(locale);
  const t = await getTranslations("Auth");

  return (
    <AuthShell title={t("resetTitle")} error={searchParams.error}>
      <form action={updatePassword} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="password">{t("newPassword")}</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="confirm">{t("confirmPassword")}</Label>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
        </div>
        <Button type="submit" className="w-full">
          {t("updatePassword")}
        </Button>
      </form>
    </AuthShell>
  );
}
