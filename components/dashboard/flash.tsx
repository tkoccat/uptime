import { getTranslations } from "next-intl/server";

// Eylem sonrası gösterilen hata/başarı bandı (?error=kod veya ?ok=anahtar)
export async function Flash({ error, ok }: { error?: string; ok?: string }) {
  const te = await getTranslations("Dash.errors");
  const tc = await getTranslations("Dash.common");
  // URL'den gelen değere güvenilmez: bilinmeyen kodlar genel mesaja düşer
  const errorText = error ? (te.has(error) ? te(error) : te("unknown")) : null;

  return (
    <>
      {errorText && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {errorText}
        </p>
      )}
      {ok && !errorText && <p className="rounded-md bg-muted p-3 text-sm">{tc("saved")}</p>}
    </>
  );
}
