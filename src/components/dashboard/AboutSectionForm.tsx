"use client";

import { startTransition, useActionState, useId, useState } from "react";
import { saveAboutSectionAction, type AboutSectionActionState } from "@/modules/settings/about-actions";
import { ABOUT_TEXT_MAX } from "@/modules/settings/schemas";
import { FormSection } from "./FormSection";
import { ImageIcon } from "./icons";
import { Field, buttonClass, inputClass } from "./ui";

const IDLE_STATE: AboutSectionActionState = { status: "idle", message: "" };

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs font-medium text-foreground">
      {message}
    </p>
  );
}

/**
 * Seção "Sobre nós": uma foto e um texto curto, editados juntos, que aparecem numa
 * faixa acima do carrossel de banners na home. Sem foto OU sem texto, a vitrine não
 * mostra a seção (ver toStore() em mappers.ts) — por isso o aviso quando falta um dos
 * dois.
 */
export function AboutSectionForm({
  initialText,
  initialImageUrl,
  canEdit,
}: {
  initialText: string | null;
  initialImageUrl: string | undefined;
  canEdit: boolean;
}) {
  const ids = useId();
  const [texto, setTexto] = useState(initialText ?? "");
  const [imageUrl, setImageUrl] = useState(initialImageUrl);
  const [previewLocal, setPreviewLocal] = useState<string | null>(null);

  const [state, formAction, pending] = useActionState(
    async (prev: AboutSectionActionState, formData: FormData) => {
      const result = await saveAboutSectionAction(prev, formData);
      if (result.status === "success" && result.saved) {
        setTexto(result.saved.text ?? "");
        if (result.saved.imageUrl) setImageUrl(result.saved.imageUrl);
        setPreviewLocal(null);
      }
      return result;
    },
    IDLE_STATE,
  );

  const errors = state.fieldErrors ?? {};
  const length = Array.from(texto).length;
  const overLimit = length > ABOUT_TEXT_MAX;
  const faltaFoto = texto.trim() !== "" && !imageUrl && !previewLocal;
  const faltaTexto = texto.trim() === "" && Boolean(imageUrl || previewLocal);

  const textoId = `${ids}-texto`;
  const textoErrorId = `${ids}-texto-error`;
  const fotoId = `${ids}-foto`;
  const fotoErrorId = `${ids}-foto-error`;

  let statusText = "";
  if (pending) statusText = "Salvando…";
  else if (state.status !== "idle") statusText = state.message;

  return (
    <FormSection
      title="Sobre nós"
      description="Foto e texto curto acima dos banners da home. Só aparece com os dois preenchidos."
    >
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
            Somente o proprietário da loja pode alterar esta seção. Você pode consultá-la.
          </p>
        )}

        <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
            <div className="flex flex-col gap-1">
              <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                {previewLocal || imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- prévia local (object URL) ou URL assinada e temporária do Storage
                  <img src={previewLocal ?? imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
                ) : (
                  <ImageIcon className="size-5 text-muted-foreground" />
                )}
              </div>
              <Field label="Foto" htmlFor={fotoId} hint="Quadrada de preferência. JPG, PNG, WEBP ou AVIF, até 5 MB.">
                <input
                  id={fotoId}
                  name="foto"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  aria-invalid={Boolean(errors.foto)}
                  onChange={(event) => {
                    const arquivo = event.target.files?.[0];
                    setPreviewLocal(arquivo ? URL.createObjectURL(arquivo) : null);
                  }}
                  className={`${inputClass} file:mr-3 file:rounded-sm file:border-0 file:bg-muted file:px-2 file:py-1 file:text-foreground`}
                />
                <FieldError id={fotoErrorId} message={errors.foto} />
              </Field>
            </div>

            <Field label="Texto" htmlFor={textoId}>
              <textarea
                id={textoId}
                name="texto"
                rows={5}
                value={texto}
                onChange={(event) => setTexto(event.target.value)}
                placeholder="Quem é a loja, em poucas frases."
                aria-invalid={errors.texto || overLimit ? true : undefined}
                aria-describedby={`${textoErrorId}`}
                className={inputClass}
              />
              <div className="flex items-start justify-between gap-2">
                <FieldError id={textoErrorId} message={errors.texto} />
                <span
                  className={`ml-auto text-xs tabular-nums ${overLimit ? "font-medium text-foreground" : "text-muted-foreground"}`}
                >
                  {length}/{ABOUT_TEXT_MAX}
                </span>
              </div>
            </Field>
          </div>

          {faltaFoto && (
            <p className="text-sm">Sem foto, a seção não aparece na vitrine mesmo com o texto salvo.</p>
          )}
          {faltaTexto && (
            <p className="text-sm">Sem texto, a seção não aparece na vitrine mesmo com a foto salva.</p>
          )}
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
              {pending ? "Salvando…" : "Salvar seção"}
            </button>
          )}
        </div>
      </form>
    </FormSection>
  );
}
