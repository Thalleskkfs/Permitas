"use client";

import { startTransition, useActionState, useId, useState } from "react";
import { saveStoreSettingsAction } from "@/modules/settings/actions";
import type { SettingsActionState } from "@/modules/settings/save";
import {
  WHATSAPP_TEMPLATE_MAX,
  formatWhatsAppNumber,
  normalizeLineBreaks,
  templateLength,
} from "@/modules/settings/schemas";
import { buildWhatsAppMessage, normalizeWhatsAppNumber } from "@/modules/storefront/whatsapp";
import { FormSection } from "./FormSection";
import { Field, buttonClass, inputClass } from "./ui";

/** Itens fictícios, só para a pré-visualização. Nada disto vai para o banco. */
const EXAMPLE_ITEMS = [
  { name: "Produto de exemplo", quantity: 2, unitPriceCents: 4990 },
  { name: "Outro produto", quantity: 1, unitPriceCents: 8990, variantLabel: "Tamanho M" },
];

const TEST_MESSAGE = "Teste do painel: este é o número que recebe os pedidos da loja.";

const IDLE_STATE: SettingsActionState = { status: "idle", message: "" };

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs font-medium text-foreground">
      {message}
    </p>
  );
}

/**
 * Número de WhatsApp e mensagem padrão da loja, ligados a store_settings.
 *
 * Os campos são controlados e o envio não usa `action={...}` direto no <form>: o React
 * limparia os campos a cada envio, e a vendedora perderia o que digitou quando o
 * servidor recusa. O formulário não envia store_id — a loja vem da sessão no servidor.
 */
export function WhatsAppSettingsForm({
  storeName,
  initialNumber,
  initialTemplate,
  canEdit,
}: {
  storeName: string;
  initialNumber: string | null;
  initialTemplate: string | null;
  canEdit: boolean;
}) {
  const ids = useId();
  const [number, setNumber] = useState(formatWhatsAppNumber(initialNumber));
  const [template, setTemplate] = useState(initialTemplate ?? "");
  const [savedNumber, setSavedNumber] = useState(initialNumber);

  const [state, formAction, pending] = useActionState(
    async (prev: SettingsActionState, formData: FormData) => {
      const result = await saveStoreSettingsAction(prev, formData);
      if (result.status === "success" && result.saved) {
        // Mostra de volta exatamente o que ficou gravado, já normalizado.
        setNumber(formatWhatsAppNumber(result.saved.whatsappNumber));
        setTemplate(result.saved.whatsappMessageTemplate ?? "");
        setSavedNumber(result.saved.whatsappNumber);
      }
      return result;
    },
    IDLE_STATE,
  );

  const errors = state.fieldErrors ?? {};
  const length = templateLength(normalizeLineBreaks(template));
  const overLimit = length > WHATSAPP_TEMPLATE_MAX;
  const trimmedTemplate = template.trim();
  const missingItems = trimmedTemplate !== "" && !template.includes("{itens}");
  const preview = buildWhatsAppMessage({ items: EXAMPLE_ITEMS, template, storeName });

  const savedDigits = savedNumber ? normalizeWhatsAppNumber(savedNumber) : null;
  const testUrl = savedDigits
    ? `https://wa.me/${savedDigits}?text=${encodeURIComponent(TEST_MESSAGE)}`
    : null;
  const unsavedNumber = number.trim() !== formatWhatsAppNumber(savedNumber);

  const numberId = `${ids}-number`;
  const numberErrorId = `${ids}-number-error`;
  const numberHintId = `${ids}-number-hint`;
  const templateId = `${ids}-template`;
  const templateErrorId = `${ids}-template-error`;
  const templateHintId = `${ids}-template-hint`;

  let statusText = "";
  if (pending) statusText = "Salvando…";
  else if (state.status !== "idle") statusText = state.message;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!canEdit || pending) return;
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="flex flex-col gap-8"
    >
      {!savedNumber && (
        <div role="note" className="rounded-md border border-foreground px-4 py-3 text-sm">
          <p className="font-medium">A loja ainda não tem número de WhatsApp.</p>
          <p className="text-muted-foreground">
            Sem número, a vitrine não consegue vender: o botão de compra fica desabilitado para
            os clientes. Cadastre o número abaixo e salve.
          </p>
        </div>
      )}

      {!canEdit && (
        <p role="note" className="rounded-md border border-border bg-muted px-3 py-2 text-sm">
          Somente o proprietário da loja pode alterar estas configurações. Você pode consultá-las.
        </p>
      )}

      <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-8">
        <FormSection
          title="WhatsApp"
          description="Número que recebe os pedidos da vitrine. Cada compra abre uma conversa com ele."
        >
          <Field label="Número de WhatsApp" htmlFor={numberId}>
            <input
              id={numberId}
              name="whatsappNumber"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              placeholder="(11) 99999-9999"
              aria-invalid={errors.whatsappNumber ? true : undefined}
              aria-describedby={`${numberHintId}${errors.whatsappNumber ? ` ${numberErrorId}` : ""}`}
              className={inputClass}
            />
            <FieldError id={numberErrorId} message={errors.whatsappNumber} />
            <p id={numberHintId} className="text-xs text-muted-foreground">
              Com DDD, do jeito que preferir: (11) 99999-9999, 11999999999 ou +55 11 99999-9999.
              Número de outro país: comece com + e o código do país. Deixe vazio para remover.
            </p>
          </Field>

          {canEdit && number.trim() === "" && savedNumber && (
            <p className="text-sm">
              Ao salvar com o campo vazio, o número é removido e a vitrine para de vender.
            </p>
          )}

          <div className="flex flex-col gap-2 rounded-md border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium">Conferir no aparelho</span>
                <span className="text-xs text-muted-foreground">
                  {savedNumber
                    ? `Abre uma conversa com ${formatWhatsAppNumber(savedNumber)}, o número salvo.`
                    : "Disponível depois de salvar um número."}
                </span>
              </div>
              {testUrl ? (
                <a
                  href={testUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClass("outline")}
                >
                  Testar no WhatsApp
                  <span className="sr-only"> (abre em nova aba)</span>
                </a>
              ) : (
                <button type="button" disabled className={buttonClass("outline")}>
                  Testar no WhatsApp
                </button>
              )}
            </div>
            {testUrl && unsavedNumber && (
              <p className="text-xs text-muted-foreground">
                O número digitado ainda não foi salvo; o teste usa o número salvo.
              </p>
            )}
          </div>
        </FormSection>

        <FormSection
          title="Mensagem padrão"
          description="Texto que já chega escrito na conversa quando o cliente finaliza a compra."
        >
          <Field label="Mensagem" htmlFor={templateId}>
            <textarea
              id={templateId}
              name="whatsappMessageTemplate"
              rows={5}
              value={template}
              onChange={(event) => setTemplate(event.target.value)}
              placeholder={"Olá! Quero fazer este pedido:\n{itens}\nTotal: {total}"}
              aria-invalid={errors.whatsappMessageTemplate || overLimit ? true : undefined}
              aria-describedby={`${templateHintId}${errors.whatsappMessageTemplate ? ` ${templateErrorId}` : ""}`}
              className={inputClass}
            />
            <div className="flex flex-wrap items-start justify-between gap-2">
              <FieldError id={templateErrorId} message={errors.whatsappMessageTemplate} />
              <span
                className={`ml-auto text-xs tabular-nums ${overLimit ? "font-medium text-foreground" : "text-muted-foreground"}`}
              >
                {length}/{WHATSAPP_TEMPLATE_MAX}
                {overLimit && " — acima do limite"}
              </span>
            </div>
            <div id={templateHintId} className="flex flex-col gap-1 text-xs text-muted-foreground">
              <p>
                <code className="rounded bg-muted px-1 font-mono text-foreground">{"{itens}"}</code>{" "}
                vira a lista de produtos do pedido, com quantidade e valor.{" "}
                <code className="rounded bg-muted px-1 font-mono text-foreground">{"{total}"}</code>{" "}
                vira o valor total. Deixe vazio para usar o texto padrão.
              </p>
            </div>
            {missingItems && (
              <p className="text-xs font-medium text-foreground">
                Sem {"{itens}"}, a mensagem não informa quais produtos o cliente quer.
              </p>
            )}
          </Field>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium" id={`${ids}-preview-label`}>
              Pré-visualização{trimmedTemplate === "" ? " (texto padrão)" : ""}
            </p>
            <pre
              aria-labelledby={`${ids}-preview-label`}
              className="whitespace-pre-wrap break-words rounded-md border border-border bg-muted p-4 font-sans text-sm"
            >
              {preview}
            </pre>
            <p className="text-xs text-muted-foreground">Com itens de exemplo.</p>
          </div>
        </FormSection>
      </fieldset>

      <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p
          aria-live="polite"
          role="status"
          className={`text-sm ${state.status === "error" && !pending ? "font-medium text-foreground" : "text-muted-foreground"}`}
        >
          {statusText}
        </p>
        {canEdit && (
          <button
            type="submit"
            disabled={pending}
            aria-disabled={pending}
            className={buttonClass("primary")}
          >
            {pending ? "Salvando…" : "Salvar alterações"}
          </button>
        )}
      </div>
    </form>
  );
}
