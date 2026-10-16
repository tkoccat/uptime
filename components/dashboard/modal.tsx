"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";

// Yerel <dialog> öğesiyle çalışan basit modal (odak yönetimi ve Esc tarayıcıdan gelir)
export function Modal({ trigger, title, closeLabel, children }: {
  trigger: string;
  title: string;
  closeLabel: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <Button onClick={() => ref.current?.showModal()}>{trigger}</Button>
      <dialog
        ref={ref}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border bg-background p-6 text-foreground backdrop:bg-black/50"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" size="sm" onClick={() => ref.current?.close()}>
            {closeLabel}
          </Button>
        </div>
        {children}
      </dialog>
    </>
  );
}
