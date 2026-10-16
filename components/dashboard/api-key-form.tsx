"use client";

import { useFormState } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createApiKeyAction, type ApiKeyState } from "@/app/[locale]/dashboard/actions";

type Labels = {
  keyName: string;
  create: string;
  newKeyTitle: string;
  newKeyWarning: string;
  errors: Record<string, string>;
};

const initial: ApiKeyState = {};

// Yeni anahtar yalnızca bu yanıtta gösterilir (URL'ye veya günlüğe yazılmaz)
export function ApiKeyForm({ labels }: { labels: Labels }) {
  const [state, action] = useFormState(createApiKeyAction, initial);

  return (
    <div className="space-y-3">
      <form action={action} className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="keyname">{labels.keyName}</Label>
          <Input id="keyname" name="name" maxLength={60} required />
        </div>
        <Button type="submit">{labels.create}</Button>
      </form>
      {state.error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {labels.errors[state.error] ?? labels.errors.unknown}
        </p>
      )}
      {state.key && (
        <div className="space-y-2 rounded-md border border-primary p-3">
          <p className="font-medium">{labels.newKeyTitle}</p>
          <code className="block break-all rounded bg-muted p-2 text-sm">{state.key}</code>
          <p className="text-xs text-muted-foreground">{labels.newKeyWarning}</p>
        </div>
      )}
    </div>
  );
}
