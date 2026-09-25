import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { A, B, C, D, S1, S2, asSuperuser, asUser, setupDatabase } from "../supabase/tests/support/harness.mjs";
import { canEditStoreSettings, settingsRoleAllows } from "../src/modules/settings/authorization.ts";
import { SETTINGS_MESSAGES, saveStoreDescription, saveStoreSettings } from "../src/modules/settings/save.ts";
import { SETTINGS_FIELD_MESSAGES, STORE_DESCRIPTION_MAX } from "../src/modules/settings/schemas.ts";

/**
 * Tela Configurações: gravação de store_settings sob RLS.
 *
 * A gravação é exercitada contra o banco real (PGlite com as migrations), sob o papel
 * `authenticated` do usuário da vez. O cliente injetado é um tradutor mínimo das
 * chamadas do supabase-js que a gravação usa (update/eq/select e insert) para SQL — as
 * policies e constraints que respondem são as de produção.
 */

const { run, rows } = setupDatabase();

/** Cliente de sessão falso: mesma API encadeada, executada como `actor`, sob RLS. */
function sessionClient(actor) {
  const log = [];

  const execute = async (sql, params) => {
    log.push(sql);
    try {
      return { data: (await run(actor, sql, params)).rows, error: null };
    } catch (error) {
      return { data: null, error: { code: error.code, message: error.message } };
    }
  };

  const client = {
    log,
    from(table) {
      return {
        update(values) {
          const keys = Object.keys(values);
          const filters = [];
          const builder = {
            eq(column, value) {
              filters.push([column, value]);
              return builder;
            },
            select(columns) {
              const params = [...keys.map((key) => values[key]), ...filters.map(([, value]) => value)];
              const set = keys.map((key, index) => `"${key}" = $${index + 1}`).join(", ");
              const where = filters
                .map(([column], index) => `"${column}" = $${keys.length + index + 1}`)
                .join(" and ");
              return execute(
                `update public."${table}" set ${set}${where ? ` where ${where}` : ""} returning ${columns}`,
                params,
              );
            },
          };
          return builder;
        },
        insert(values) {
          const keys = Object.keys(values);
          return execute(
            `insert into public."${table}" (${keys.map((key) => `"${key}"`).join(", ")}) values (${keys
              .map((_, index) => `$${index + 1}`)
              .join(", ")})`,
            keys.map((key) => values[key]),
          );
        },
      };
    },
  };
  return client;
}

/**
 * Monta as dependências da ação para um usuário. `context` é a loja que o servidor
 * resolveria pela membership; nos testes de RLS ele é forjado de propósito.
 */
function depsFor(actor, context) {
  const client = sessionClient(actor);
  const calls = { getStore: 0, getClient: 0 };
  return {
    client,
    calls,
    deps: {
      getStore: async () => {
        calls.getStore += 1;
        return context;
      },
      getClient: async () => {
        calls.getClient += 1;
        return client;
      },
    },
  };
}

const settingsOf = async (storeId) =>
  (
    await rows(
      asSuperuser,
      `select whatsapp_number, whatsapp_message_template from public.store_settings where store_id = '${storeId}'`,
    )
  )[0];

const ORIGINAL_S1 = { whatsapp_number: "+5511999990001", whatsapp_message_template: "Olá, loja 1" };
const ORIGINAL_S2 = { whatsapp_number: "+5511999990002", whatsapp_message_template: "Olá, loja 2" };

const OWNER_S1 = { storeId: S1, role: "owner" };
const EDITOR_S1 = { storeId: S1, role: "editor" };

// ---------------------------------------------------------------------------
// Autorização (espelho das policies store_settings_*)
// ---------------------------------------------------------------------------

describe("papéis, conforme as policies de store_settings", () => {
  test("owner lê e altera; editor só lê", () => {
    assert.equal(canEditStoreSettings("owner"), true);
    assert.equal(canEditStoreSettings("editor"), false);
    assert.equal(settingsRoleAllows("editor", "settings:read"), true);
    assert.equal(settingsRoleAllows("owner", "settings:read"), true);
  });

  test("a policy real concorda: editor não grava, owner grava", async () => {
    const asEditor = await rows(
      asUser(D),
      `update public.store_settings set whatsapp_number = '+5511900000000' where store_id = '${S1}' returning store_id`,
    );
    assert.deepEqual(asEditor, []);
    const asOwner = await rows(
      asUser(A),
      `update public.store_settings set whatsapp_number = '+5511900000000' where store_id = '${S1}' returning store_id`,
    );
    assert.equal(asOwner.length, 1);
    assert.equal((await rows(asUser(D), `select 1 from public.store_settings where store_id = '${S1}'`)).length, 1, "editor lê");
  });
});

// ---------------------------------------------------------------------------
// Gravação ponta a ponta, sob RLS
// ---------------------------------------------------------------------------

describe("salvar configurações", () => {
  test("owner salva: número normalizado para E.164 e mensagem gravados", async () => {
    const { deps } = depsFor(asUser(A), OWNER_S1);
    const result = await saveStoreSettings(deps, {
      whatsappNumber: "(11) 98888-7777",
      whatsappMessageTemplate: "Pedido:\r\n{itens}\r\nTotal: {total}",
    });

    assert.equal(result.status, "success", result.message);
    assert.deepEqual(result.saved, {
      whatsappNumber: "+5511988887777",
      whatsappMessageTemplate: "Pedido:\n{itens}\nTotal: {total}",
    });
    assert.deepEqual(await settingsOf(S1), {
      whatsapp_number: "+5511988887777",
      whatsapp_message_template: "Pedido:\n{itens}\nTotal: {total}",
    });
    assert.deepEqual(await settingsOf(S2), ORIGINAL_S2, "a outra loja não muda");
  });

  test("campo vazio remove o número (null) e a mensagem volta ao padrão", async () => {
    const { deps } = depsFor(asUser(A), OWNER_S1);
    const result = await saveStoreSettings(deps, { whatsappNumber: "  ", whatsappMessageTemplate: "" });

    assert.equal(result.status, "success", result.message);
    assert.deepEqual(await settingsOf(S1), { whatsapp_number: null, whatsapp_message_template: null });
  });

  test("loja sem linha em store_settings: o owner cria na primeira gravação", async () => {
    await run(asSuperuser, `delete from public.store_settings where store_id = '${S1}'`);

    const { deps } = depsFor(asUser(A), OWNER_S1);
    const result = await saveStoreSettings(deps, { whatsappNumber: "21 3333-4444", whatsappMessageTemplate: "" });

    assert.equal(result.status, "success", result.message);
    assert.deepEqual(await settingsOf(S1), { whatsapp_number: "+552133334444", whatsapp_message_template: null });
  });

  test("número inválido é recusado sem ir ao banco e sem gravar", async () => {
    const { deps, calls, client } = depsFor(asUser(A), OWNER_S1);
    const result = await saveStoreSettings(deps, {
      whatsappNumber: "9999-9999",
      whatsappMessageTemplate: "Nova mensagem",
    });

    assert.equal(result.status, "error");
    assert.equal(result.fieldErrors.whatsappNumber, SETTINGS_FIELD_MESSAGES.invalidNumber);
    assert.deepEqual(calls, { getStore: 0, getClient: 0 });
    assert.deepEqual(client.log, []);
    assert.deepEqual(await settingsOf(S1), ORIGINAL_S1, "nem a mensagem válida é gravada");
  });

  test("mensagem acima de 1000 caracteres é recusada sem gravar", async () => {
    const { deps, client } = depsFor(asUser(A), OWNER_S1);
    const result = await saveStoreSettings(deps, {
      whatsappNumber: "(11) 98888-7777",
      whatsappMessageTemplate: "x".repeat(1001),
    });

    assert.equal(result.status, "error");
    assert.equal(result.fieldErrors.whatsappMessageTemplate, SETTINGS_FIELD_MESSAGES.templateTooLong);
    assert.deepEqual(client.log, []);
    assert.deepEqual(await settingsOf(S1), ORIGINAL_S1);
  });

  test("editor é barrado pela aplicação antes de abrir o cliente do banco", async () => {
    const { deps, calls, client } = depsFor(asUser(D), EDITOR_S1);
    const result = await saveStoreSettings(deps, {
      whatsappNumber: "(11) 98888-7777",
      whatsappMessageTemplate: "",
    });

    assert.equal(result.status, "error");
    assert.equal(result.message, SETTINGS_MESSAGES.notAllowed);
    assert.equal(calls.getClient, 0, "a checagem de papel vem antes do banco");
    assert.deepEqual(client.log, []);
    assert.deepEqual(await settingsOf(S1), ORIGINAL_S1);
  });

  test("editor que passe pela aplicação é barrado pela RLS (update e insert)", async () => {
    // Contexto forjado como owner: prova que a policy decide mesmo sem a 1ª barreira.
    const { deps, client } = depsFor(asUser(D), OWNER_S1);
    const result = await saveStoreSettings(deps, { whatsappNumber: "11988887777", whatsappMessageTemplate: "" });

    assert.equal(result.status, "error");
    assert.equal(result.message, SETTINGS_MESSAGES.notAllowed);
    assert.equal(client.log.length, 2, "tentou update (0 linhas) e insert (recusado)");
    assert.deepEqual(await settingsOf(S1), ORIGINAL_S1);
  });

  test("usuário de outra loja não altera, mesmo apontando o store_id dela", async () => {
    // B é owner de S2. Mesmo com um contexto forjado para S1, a sessão é de B.
    const { deps } = depsFor(asUser(B), OWNER_S1);
    const result = await saveStoreSettings(deps, { whatsappNumber: "11988887777", whatsappMessageTemplate: "invadido" });

    assert.equal(result.status, "error");
    assert.equal(result.message, SETTINGS_MESSAGES.notAllowed);
    assert.deepEqual(await settingsOf(S1), ORIGINAL_S1);
    assert.deepEqual(await settingsOf(S2), ORIGINAL_S2);
  });

  test("usuário sem vínculo não cria linha para loja sem configurações", async () => {
    await run(asSuperuser, `delete from public.store_settings where store_id = '${S1}'`);

    const { deps } = depsFor(asUser(C), OWNER_S1);
    const result = await saveStoreSettings(deps, { whatsappNumber: "11988887777", whatsappMessageTemplate: "" });

    assert.equal(result.status, "error");
    assert.equal(result.message, SETTINGS_MESSAGES.notAllowed);
    assert.equal(await settingsOf(S1), undefined);
  });
});

// ---------------------------------------------------------------------------
// Descrição da loja (public.stores.description) — mesma regra do owner, tabela
// diferente. A migration allow_store_description_update é quem libera a coluna.
// ---------------------------------------------------------------------------

const descriptionOf = async (storeId) =>
  (await rows(asSuperuser, `select description from public.stores where id = '${storeId}'`))[0]?.description ?? null;

describe("salvar descrição da loja", () => {
  test("owner salva e o texto sai com espaços nas pontas cortados", async () => {
    const { deps } = depsFor(asUser(A), OWNER_S1);
    const result = await saveStoreDescription(deps, { storeDescription: "  Lubrificantes e géis, discreto. " });

    assert.equal(result.status, "success", result.message);
    assert.deepEqual(result.saved, { storeDescription: "Lubrificantes e géis, discreto." });
    assert.equal(await descriptionOf(S1), "Lubrificantes e géis, discreto.");
    assert.equal(await descriptionOf(S2), null, "a outra loja não muda");
  });

  test("campo vazio grava null (volta ao texto padrão do código)", async () => {
    const { deps } = depsFor(asUser(A), OWNER_S1);
    const result = await saveStoreDescription(deps, { storeDescription: "   " });

    assert.equal(result.status, "success", result.message);
    assert.equal(await descriptionOf(S1), null);
  });

  test(`acima de ${STORE_DESCRIPTION_MAX} caracteres é recusado sem ir ao banco`, async () => {
    const { deps, calls, client } = depsFor(asUser(A), OWNER_S1);
    const result = await saveStoreDescription(deps, { storeDescription: "x".repeat(STORE_DESCRIPTION_MAX + 1) });

    assert.equal(result.status, "error");
    assert.ok(result.fieldErrors.storeDescription);
    assert.deepEqual(calls, { getStore: 0, getClient: 0 });
    assert.deepEqual(client.log, []);
    assert.equal(await descriptionOf(S1), null);
  });

  test("editor é barrado pela aplicação antes de abrir o cliente do banco", async () => {
    const { deps, calls, client } = depsFor(asUser(D), EDITOR_S1);
    const result = await saveStoreDescription(deps, { storeDescription: "Tentativa de editor" });

    assert.equal(result.status, "error");
    assert.equal(result.message, SETTINGS_MESSAGES.notAllowed);
    assert.equal(calls.getClient, 0, "a checagem de papel vem antes do banco");
    assert.deepEqual(client.log, []);
    assert.equal(await descriptionOf(S1), null);
  });

  test("editor que passe pela aplicação é barrado pela RLS", async () => {
    const { deps, client } = depsFor(asUser(D), OWNER_S1);
    const result = await saveStoreDescription(deps, { storeDescription: "Invadido" });

    assert.equal(result.status, "error");
    assert.equal(result.message, SETTINGS_MESSAGES.notAllowed);
    assert.equal(client.log.length, 1, "tentou update (0 linhas, sem insert de fallback)");
    assert.equal(await descriptionOf(S1), null);
  });

  test("usuário de outra loja não altera, mesmo apontando o store_id dela", async () => {
    const { deps } = depsFor(asUser(B), OWNER_S1);
    const result = await saveStoreDescription(deps, { storeDescription: "Invadido" });

    assert.equal(result.status, "error");
    assert.equal(result.message, SETTINGS_MESSAGES.notAllowed);
    assert.equal(await descriptionOf(S1), null);
    assert.equal(await descriptionOf(S2), null);
  });
});

