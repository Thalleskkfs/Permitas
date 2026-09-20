"use client";

import { useActionState, useEffect, useRef } from "react";
import { IDLE_ACTION_STATE, type ActionState } from "@/modules/catalog/errors";
import { buttonClass } from "./ui";

export type EntityFormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Diálogo de criação e edição das entidades simples do catálogo (categoria, tag,
 * coleção). Os campos vêm por `children`, e os erros por campo chegam pelo estado da
 * própria Server Action.
 */
export function CatalogEntityDialog({
  open,
  title,
  action,
  submitLabel,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  action: EntityFormAction;
  submitLabel: string;
  onClose: () => void;
  children: (errors: Record<string, string>) => React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(action, IDLE_ACTION_STATE);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (state.status === "success") onClose();
  }, [state, onClose]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      aria-labelledby="entity-dialog-title"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-md border border-border bg-background p-0 text-foreground backdrop:bg-black/40"
    >
      <form action={formAction} className="flex flex-col gap-4 p-6">
        <h2 id="entity-dialog-title" className="text-lg font-semibold">
          {title}
        </h2>

        {state.status === "error" && state.message && (
          <p role="alert" className="rounded-md border border-border bg-muted px-3 py-2 text-sm">
            {state.message}
          </p>
        )}

        {children(state.fieldErrors ?? {})}

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={buttonClass("ghost")}>
            Cancelar
          </button>
          <button type="submit" disabled={pending} className={buttonClass("primary")}>
            {pending ? "Salvando…" : submitLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
