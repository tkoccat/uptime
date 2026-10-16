"use client";

import { Button } from "@/components/ui/button";

// Form gönderilmeden önce tarayıcı onayı ister (geri alınamaz işlemler için)
export function ConfirmSubmit({ label, message, className }: { label: string; message: string; className?: string }) {
  return (
    <Button
      type="submit"
      variant="outline"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {label}
    </Button>
  );
}
