"use client";

import { startTransition, useActionState, useId, useState } from "react";
import { saveStoreDescriptionAction } from "@/modules/settings/actions";
import type { StoreDescriptionActionState } from "@/modules/settings/save";
import { STORE_DESCRIPTION_MAX } from "@/modules/settings/schemas";
import { FormSection } from "./FormSection";
import { Field, buttonClass, inputClass } from "./ui";

const IDLE_STATE: StoreDescriptionActionState = { status: "idle", message: "" };

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs font-medium text-foreground">
      {message}
    </p>
  );
}

/**
 * Identificação da loja: nome e endereço (fixos, vêm do cadastro) e a descrição, que é o
 * único campo editável aqui. Ela aparece em toda página da vitrine — `<meta
 * description>`, cartão de prévia do WhatsApp/Instagram — e sem ela cai no texto de
 * fallback do código, que não fala da loja de verdade.
 */
export function StoreProfileForm({
  storeName,
  siteUrl,
  initialDescription,
  canEdit,
}: {
  storeName: string;
  siteUrl: string | undefined;
  initialDescription: string | null;
  canEdit: boolean;
}) {
  const ids = useId();
  const [descricao, setDescricao] = useState(initialDescription ?? "");

  const [state, formAction, pending] = useActionState(
    async (prev: StoreDescriptionActionState, formData: FormData) => {
      const result = await saveStoreDescriptionAction(prev, formData);
      if (result.status === "success" && result.saved) {
        setDescricao(result.saved.storeDescription ?? "");
      }
      return result;
    },
    IDLE_STATE,
  );

  const errors = state.fieldErrors ?? {};
  const length = Array.from(descricao).length;
  const overLimit = length > STORE_DESCRIPTION_MAX;

  const descricaoId = `${ids}-descricao`;
  const descricaoErrorId = `${ids}-descricao-error`;

  let statusText = "";
  if (pending) statusText = "Salvando…";
  else if (state.status !== "idle") statusText = state.message;

  return (
    <FormSection title="Loja" description="Identificação da loja e o texto que representa ela fora do site.">
      <dl className="grid gap-4 rounded-md border border-border p-4 sm:grid-cols-2">
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">Nome</dt>
          <dd className="text-sm font-medium">{storeName}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">Endereço da vitrine</dt>
          <dd className="text-sm font-medium">{siteUrl ?? "Não configurado"}</dd>
        </div>
      </dl>

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!canEdit || pending) return;
          const formData = new FormData(event.currentTarget);
          startTransition(() => formAction(formData));
        }}
        className="flex flex-col gap-4"
      >
        {!canEdit && (
          <p role="note" className="rounded-md border border-border bg-muted px-3 py-2 text-sm">
            Somente o proprietário da loja pode alterar esta descrição. Você pode consultá-la.
          </p>
        )}

        <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-2">
          <Field
            label="Descrição"
            htmlFor={descricaoId}
            hint="Aparece no Google e na prévia de link do WhatsApp/Instagram. Quem é a loja, em uma frase."
          >
            <textarea
              id={descricaoId}
              name="storeDescription"
              rows={3}
              value={descricao}
              onChange={(event) => setDescricao(event.target.value)}
              placeholder="O que a loja vende e para quem, em poucas palavras."
              aria-invalid={errors.storeDescription || overLimit ? true : undefined}
              aria-describedby={descricaoErrorId}
              className={inputClass}
            />
            <div className="flex items-start justify-between gap-2">
              <FieldError id={descricaoErrorId} message={errors.storeDescription} />
              <span
                className={`ml-auto text-xs tabular-nums ${overLimit ? "font-medium text-foreground" : "text-muted-foreground"}`}
              >
                {length}/{STORE_DESCRIPTION_MAX}
              </span>
            </div>
          </Field>
        </fieldset>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p
            aria-live="polite"
            role="status"
            className={`text-sm ${state.status === "error" && !pending ? "font-medium text-foreground" : "text-muted-foreground"}`}
          >
            {statusText}
          </p>
          {canEdit && (
            <button type="submit" disabled={pending} aria-disabled={pending} className={buttonClass("primary")}>
              {pending ? "Salvando…" : "Salvar descrição"}
            </button>
          )}
        </div>
      </form>
    </FormSection>
  );
}
