import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";
import {
  SETTINGS_FIELD_MESSAGES,
  WHATSAPP_TEMPLATE_MAX,
  formatWhatsAppNumber,
  storeSettingsInputSchema,
  toE164WhatsAppNumber,
} from "../src/modules/settings/schemas.ts";

/**
 * Tela Configurações: validação do número de WhatsApp e da mensagem padrão, e a fiação
 * da Server Action. A gravação sob RLS está em store-settings-save.test.mjs.
 */

// ---------------------------------------------------------------------------
// Normalização do número
// ---------------------------------------------------------------------------

describe("número de WhatsApp: formatos brasileiros viram E.164", () => {
  const cases = [
    ["(11) 99999-9999", "+5511999999999"],
    ["11999999999", "+5511999999999"],
    ["11 99999-9999", "+5511999999999"],
    ["11 9 9999-9999", "+5511999999999"],
    ["(011) 99999-9999", "+5511999999999"],
    ["011999999999", "+5511999999999"],
    ["+55 11 99999-9999", "+5511999999999"],
    ["+55 (11) 99999.9999", "+5511999999999"],
    ["55 11 99999-9999", "+5511999999999"],
    ["5511999999999", "+5511999999999"],
    ["  (21) 3333-4444  ", "+552133334444"],
    ["+1 415 555 2671", "+14155552671"],
    ["+351 912 345 678", "+351912345678"],
  ];

  for (const [typed, expected] of cases) {
    test(`"${typed}" → ${expected}`, () => {
      assert.equal(toE164WhatsAppNumber(typed), expected);
      const parsed = storeSettingsInputSchema.safeParse({ whatsappNumber: typed });
      assert.equal(parsed.success, true);
      assert.equal(parsed.data.whatsappNumber, expected);
    });
  }

  test("o resultado sempre satisfaz a constraint do banco", () => {
    for (const [typed] of cases) {
      assert.match(toE164WhatsAppNumber(typed), /^\+[1-9][0-9]{7,14}$/);
    }
  });

  test("vazio (ou só espaços) significa sem número: null", () => {
    for (const value of ["", "   ", undefined]) {
      const parsed = storeSettingsInputSchema.safeParse({ whatsappNumber: value });
      assert.equal(parsed.success, true);
      assert.equal(parsed.data.whatsappNumber, null);
    }
  });

  const invalid = [
    "9999-9999", // sem DDD
    "1199999999999", // dígito sobrando
    "+55 11 9999", // incompleto
    "+55 01 99999-9999", // DDD com zero
    "(11) 9999A-9999", // letra no meio
    "11 99999-9999 ramal 2",
    "abc",
    "+0 11 99999-9999",
    "+",
    "1234567",
    "+1234567890123456",
  ];

  for (const typed of invalid) {
    test(`recusa "${typed}" com mensagem no campo`, () => {
      assert.equal(toE164WhatsAppNumber(typed), null);
      const parsed = storeSettingsInputSchema.safeParse({ whatsappNumber: typed });
      assert.equal(parsed.success, false);
      assert.deepEqual(parsed.error.issues.map((issue) => [issue.path[0], issue.message]), [
        ["whatsappNumber", SETTINGS_FIELD_MESSAGES.invalidNumber],
      ]);
    });
  }

  test("formatação de volta para a tela", () => {
    assert.equal(formatWhatsAppNumber("+5511999999999"), "+55 (11) 99999-9999");
    assert.equal(formatWhatsAppNumber("+552133334444"), "+55 (21) 3333-4444");
    assert.equal(formatWhatsAppNumber("+14155552671"), "+14155552671");
    assert.equal(formatWhatsAppNumber(null), "");
    // O que a tela mostra, se reenviado, grava o mesmo número.
    assert.equal(toE164WhatsAppNumber(formatWhatsAppNumber("+5511999999999")), "+5511999999999");
  });
});

// ---------------------------------------------------------------------------
// Mensagem padrão
// ---------------------------------------------------------------------------

describe("mensagem padrão", () => {
  test("até 1000 caracteres é aceita; 1001 é recusada", () => {
    const ok = storeSettingsInputSchema.safeParse({ whatsappMessageTemplate: "a".repeat(WHATSAPP_TEMPLATE_MAX) });
    assert.equal(ok.success, true);

    const tooLong = storeSettingsInputSchema.safeParse({
      whatsappMessageTemplate: "a".repeat(WHATSAPP_TEMPLATE_MAX + 1),
    });
    assert.equal(tooLong.success, false);
    assert.equal(tooLong.error.issues[0].path[0], "whatsappMessageTemplate");
    assert.equal(tooLong.error.issues[0].message, SETTINGS_FIELD_MESSAGES.templateTooLong);
  });

  test("conta como o Postgres: emoji vale 1 e quebra \\r\\n vale 1", () => {
    const emoji = storeSettingsInputSchema.safeParse({ whatsappMessageTemplate: "🙂".repeat(1000) });
    assert.equal(emoji.success, true, "1000 emojis são 1000 caracteres para char_length");

    const lines = storeSettingsInputSchema.safeParse({ whatsappMessageTemplate: "a\r\n".repeat(500) });
    assert.equal(lines.success, true);
    assert.equal(lines.data.whatsappMessageTemplate, "a\n".repeat(500));
  });

  test("vazia ou só espaços vira null (a vitrine usa o texto padrão)", () => {
    for (const value of ["", "  \n "]) {
      assert.equal(storeSettingsInputSchema.parse({ whatsappMessageTemplate: value }).whatsappMessageTemplate, null);
    }
  });
});

// ---------------------------------------------------------------------------
// Fiação: a Server Action e a tela não aceitam loja do cliente
// ---------------------------------------------------------------------------

describe("fiação da tela", () => {
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

  test("a Server Action resolve a loja pela sessão e não lê store_id do formulário", async () => {
    const source = await read("src/modules/settings/actions.ts");
    assert.match(source, /^"use server";/);
    assert.match(source, /getStore: requireCurrentStore/);
    assert.match(source, /getClient: createClient/);
    const fields = [...source.matchAll(/formData\.get\("([^"]+)"\)/g)].map((match) => match[1]);
    assert.deepEqual(fields, ["whatsappNumber", "whatsappMessageTemplate", "storeDescription"]);
    assert.doesNotMatch(source, /formData\.getAll|Object\.fromEntries/);
    assert.doesNotMatch(source, /SERVICE_ROLE|serviceRole|createAdminClient/);
  });

  test("a tela não usa mais dados de mock", async () => {
    const page = await read("src/app/(admin)/admin/(panel)/configuracoes/page.tsx");
    assert.doesNotMatch(page, /dashboard\/mock/);
    assert.match(page, /requireCurrentStore/);
    for (const name of ["storeName", "storeSlug", "customDomain", "showOutOfStock", "showPrices", "lowStockAlert"]) {
      assert.doesNotMatch(page, new RegExp(`name="${name}"`), `campo mock ${name} removido`);
    }
  });
});
