import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  title: string;
  description?: string;
  error?: string;
  info?: string;
  children: React.ReactNode;
};

// Tüm giriş/kayıt sayfalarının ortak çerçevesi
export async function AuthShell({ title, description, error, info, children }: Props) {
  const te = await getTranslations("Auth.errors");
  const ti = await getTranslations("Auth.info");
  // Bilinmeyen kodlar "unknown" mesajına düşer (URL'den gelen değere güvenilmez)
  const errorText = error ? (te.has(error) ? te(error) : te("unknown")) : null;
  const infoText = info && ti.has(info) ? ti(info) : null;

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          {/* Sayfanın tek h1'i: erişilebilirlik ve arama motorları için gerçek başlık öğesi */}
          <CardTitle>
            <h1>{title}</h1>
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-4">
          {errorText && (
            <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {errorText}
            </p>
          )}
          {infoText && <p className="rounded-md bg-muted p-3 text-sm">{infoText}</p>}
          {children}
        </CardContent>
      </Card>
    </main>
  );
}
