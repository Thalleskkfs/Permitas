"use client";

import { useEffect, useRef } from "react";
import { buttonClass } from "./ui";

/**
 * Diálogo de confirmação sobre <dialog> nativo: foco preso, Esc e backdrop sem
 * dependência externa.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  note,
  confirmLabel = "Confirmar",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  note?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      aria-labelledby="confirm-dialog-title"
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-md border border-border bg-background p-0 text-foreground backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-3 p-6">
        <h2 id="confirm-dialog-title" className="text-lg font-semibold">
          {title}
        </h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
        {note && (
          <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
            {note}
          </p>
        )}

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={buttonClass("ghost")}>
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} className={buttonClass("primary")}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
