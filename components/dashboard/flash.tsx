import { getTranslations } from "next-intl/server";

// Eylem sonrası gösterilen hata/başarı bandı (?error=kod veya ?error=kod~neden, ?ok=anahtar)
export async function Flash({ error, ok }: { error?: string; ok?: string }) {
  const te = await getTranslations("Dash.errors");
  const tc = await getTranslations("Dash.common");
  // URL'den gelen değere güvenilmez: kod çevirisi yalnızca bilinen anahtarlardan gelir, bilinmeyenler genel mesaja düşer.
  // "~" sonrası neden metni (örn. "Address is required") düz metin olarak gösterilir, işlenmez.
  const [code, ...rest] = (error ?? "").split("~");
  const reason = rest.join("~").slice(0, 160);
  const errorText = error ? (te.has(code) ? te(code) : te("unknown")) : null;

  return (
    <>
      {errorText && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {errorText}
          {reason && <span className="mt-1 block font-medium">{reason}</span>}
        </p>
      )}
      {ok && !errorText && <p className="rounded-md bg-muted p-3 text-sm">{tc("saved")}</p>}
    </>
  );
}
