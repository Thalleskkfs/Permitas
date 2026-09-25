import { z } from "zod";
import { normalizeWhatsAppNumber } from "../storefront/whatsapp.ts";

/**
 * Validação das configurações da loja (tabela store_settings).
 *
 * Módulo sem dependências de servidor, para ser testado isoladamente. As constraints do
 * banco continuam valendo e são a última palavra:
 *   * whatsapp_number ~ '^\+[1-9][0-9]{7,14}$' (E.164 com "+");
 *   * char_length(whatsapp_message_template) <= 1000.
 */

export const WHATSAPP_TEMPLATE_MAX = 1000;

/** Mesma expressão da constraint store_settings_whatsapp_number_e164. */
export const E164 = /^\+[1-9][0-9]{7,14}$/;

export const SETTINGS_FIELD_MESSAGES = {
  invalidNumber:
    "Número inválido. Digite com DDD, por exemplo (11) 99999-9999, ou com o código do país, +55 11 99999-9999.",
  templateTooLong: `A mensagem pode ter no máximo ${WHATSAPP_TEMPLATE_MAX} caracteres.`,
} as const;

// Só o que uma pessoa digita num telefone: dígitos, espaço, parênteses, hífen, ponto
// e um "+" opcional no começo. Letras ou símbolos no meio indicam erro de digitação,
// e não queremos descartá-los em silêncio.
const PHONE_CHARACTERS = /^\+?[\d\s().-]+$/;

/**
 * Converte o número como a vendedora digita para E.164.
 *
 * A regra de DDI é a da vitrine (`normalizeWhatsAppNumber`), reaproveitada de propósito:
 * o número gravado é exatamente o que o link de compra vai usar. Antes dela, só tiramos
 * o "0" de discagem nacional, comum em "(011) 99999-9999".
 *
 * Devolve `null` quando o número não é aceitável.
 */
export function toE164WhatsAppNumber(raw: string): string | null {
  const trimmed = raw.trim();
  if (!PHONE_CHARACTERS.test(trimmed)) return null;

  const international = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  const national = international ? digits : digits.replace(/^0+/, "");

  const normalized = normalizeWhatsAppNumber(international ? `+${national}` : national);
  if (!normalized) return null;

  // Sem "+", só aceitamos número brasileiro. "9999-9999" (sem DDD) ou um celular com
  // dígito sobrando virariam um número válido de outro país, e os pedidos iriam para
  // um desconhecido. Número estrangeiro precisa vir com "+" e o código do país.
  if (!international && !normalized.startsWith("55")) return null;

  // Brasil: 55 + DDD (sem zero) + 8 ou 9 dígitos. Fora disso o número está incompleto
  // ou sobrando dígito, e a mensagem iria para ninguém (ou para outra pessoa).
  if (normalized.startsWith("55")) {
    if (normalized.length !== 12 && normalized.length !== 13) return null;
    if (normalized[2] === "0") return null;
  }

  const e164 = `+${normalized}`;
  return E164.test(e164) ? e164 : null;
}

/** Exibição amigável do número gravado: "+55 (11) 99999-9999". */
export function formatWhatsAppNumber(e164: string | null | undefined): string {
  if (!e164) return "";

  const digits = e164.replace(/\D/g, "");
  const brazil = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(digits);
  if (brazil) return `+55 (${brazil[1]}) ${brazil[2]}-${brazil[3]}`;

  return `+${digits}`;
}

/** Tamanho como o Postgres conta (char_length conta caracteres, não unidades UTF-16). */
export function templateLength(value: string) {
  return Array.from(value).length;
}

/** O textarea envia quebras como "\r\n"; gravamos "\n", como o contador conta. */
export const normalizeLineBreaks = (value: string) => value.replace(/\r\n?/g, "\n");

const whatsappNumberField = z
  .string()
  .default("")
  .transform((value, ctx) => {
    if (value.trim() === "") return null;

    const e164 = toE164WhatsAppNumber(value);
    if (!e164) {
      ctx.addIssue({ code: "custom", message: SETTINGS_FIELD_MESSAGES.invalidNumber });
      return z.NEVER;
    }
    return e164;
  });

const messageTemplateField = z
  .string()
  .default("")
  .transform((value, ctx) => {
    const normalized = normalizeLineBreaks(value);
    // Só espaços equivale a vazio: a vitrine usa o texto padrão.
    if (normalized.trim() === "") return null;

    if (templateLength(normalized) > WHATSAPP_TEMPLATE_MAX) {
      ctx.addIssue({ code: "custom", message: SETTINGS_FIELD_MESSAGES.templateTooLong });
      return z.NEVER;
    }
    return normalized;
  });

export const storeSettingsInputSchema = z.object({
  whatsappNumber: whatsappNumberField,
  whatsappMessageTemplate: messageTemplateField,
});

export type StoreSettingsInput = z.output<typeof storeSettingsInputSchema>;

/** Mesmo limite da constraint store_settings_about_text_length. */
export const ABOUT_TEXT_MAX = 600;

/**
 * Bem mais curto que o limite do banco (stores_description_length, 2000 caracteres):
 * é o texto que vira <meta description> e o resumo do cartão de prévia do
 * WhatsApp/Instagram — passar de ~160 caracteres é onde o Google já corta a frase.
 */
export const STORE_DESCRIPTION_MAX = 200;

const storeDescriptionField = z
  .string()
  .default("")
  .transform((value, ctx) => {
    const normalized = normalizeLineBreaks(value).trim();
    if (normalized === "") return null;

    if (templateLength(normalized) > STORE_DESCRIPTION_MAX) {
      ctx.addIssue({
        code: "custom",
        message: `Use até ${STORE_DESCRIPTION_MAX} caracteres.`,
      });
      return z.NEVER;
    }
    return normalized;
  });

export const storeDescriptionInputSchema = z.object({
  storeDescription: storeDescriptionField,
});

export type StoreDescriptionInput = z.output<typeof storeDescriptionInputSchema>;
