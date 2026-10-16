import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authMessage, detectLocale } from "@/lib/auth/messages";

type Props = {
  title: string;
  description?: string;
  error?: string;
  info?: string;
  children: React.ReactNode;
};

// Tüm giriş/kayıt sayfalarının ortak çerçevesi
export function AuthShell({ title, description, error, info, children }: Props) {
  const locale = detectLocale();
  const errorText = authMessage(error, locale);
  const infoText = authMessage(info, locale);

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
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
