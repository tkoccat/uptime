import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Admin panelinin ortak küçük bileşenleri (panel yalnızca İngilizcedir)

export function AdminFlash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return error ? (
    <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
      {error}
    </p>
  ) : (
    <p role="status" className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
      {ok}
    </p>
  );
}

export function Field({
  label,
  name,
  defaultValue,
  type = "text",
  help,
  placeholder,
  required,
  min,
  step,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  help?: string;
  placeholder?: string;
  required?: boolean;
  min?: number;
  step?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue ?? ""} placeholder={placeholder} required={required} min={min} step={step} />
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}

export function Check({ label, name, defaultChecked, help }: { label: string; name: string; defaultChecked?: boolean; help?: string }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-1" />
      <span>
        {label}
        {help && <span className="block text-xs text-muted-foreground">{help}</span>}
      </span>
    </label>
  );
}

export const selectClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";
export const textareaClass = "min-h-[96px] w-full rounded-md border bg-background px-3 py-2 text-sm";

/** Küçük birimi (peni/sent) ana birim metnine çevirir: 900 -> "9.00" */
export const money = (minor: number | null | undefined) => (minor == null ? "" : (minor / 100).toFixed(2));
