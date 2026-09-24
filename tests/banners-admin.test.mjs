import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";

const ROOT = new URL("../", import.meta.url);
const ACTIONS = new URL("src/modules/banners/actions.ts", ROOT);

/** Corpo de cada função exportada, do `export async function` até a próxima. */
function exportedBodies(source) {
  const names = [...source.matchAll(/export async function (\w+)\(/g)].map((match) => match[1]);
  return names.map((name) => {
    const start = source.indexOf(`export async function ${name}(`);
    const next =
      names
        .map((other) => source.indexOf(`export async function ${other}(`))
        .filter((index) => index > start)
        .sort((a, b) => a - b)[0] ?? source.length;
    return { name, body: source.slice(start, next) };
  });
}

describe("banners do painel: ninguém de fora usa as ações", () => {
  test("o módulo é de Server Actions e não toca na service_role", async () => {
    const source = await readFile(ACTIONS, "utf8");
    assert.match(source, /^"use server";/m);
    assert.doesNotMatch(source, /createAdminClient|SERVICE_ROLE|\.storage\.from\(/);
  });

  test("toda ação exportada começa exigindo sessão com duas etapas e vínculo com a loja", async () => {
    const source = await readFile(ACTIONS, "utf8");
    const actions = exportedBodies(source);
    assert.ok(actions.length >= 6, `esperava as ações de banner, achei ${actions.length}`);

    for (const { name, body } of actions) {
      // A PRIMEIRA espera da função é a checagem de acesso: nada é lido, validado,
      // consultado ou enviado antes dela.
      const firstAwait = body.match(/await\s+([\w.]+)\(/);
      assert.equal(firstAwait?.[1], "requireCurrentStore", `${name} faz outra coisa antes de checar o acesso`);
      assert.match(body, /store\.storeId/, `${name} não usa a loja autorizada`);
      assert.doesNotMatch(
        body,
        /store_id:(?!\s*store\.storeId)/,
        `${name} grava store_id que não vem da loja autorizada`,
      );
    }
  });

  test("toda consulta e escrita em store_banners é escopada pela loja autorizada", async () => {
    const source = await readFile(ACTIONS, "utf8");
    const usos = source.split('.from("store_banners")').slice(1);
    assert.ok(usos.length > 0);
    for (const trecho of usos) {
      const comando = trecho.slice(0, trecho.indexOf(";"));
      if (/\.insert\(/.test(comando)) {
        assert.match(comando, /store_id:\s*store\.storeId/, "insert sem a loja autorizada");
      } else {
        assert.match(comando, /\.eq\("store_id", store\.storeId\)/, `consulta sem escopo de loja: ${comando.slice(0, 80)}`);
      }
    }
  });

  test("excluir exige o papel de proprietário antes de qualquer coisa", async () => {
    const source = await readFile(ACTIONS, "utf8");
    const { body } = exportedBodies(source).find((action) => action.name === "deleteBannerAction");
    const checagem = body.indexOf("canDeleteStructures(store.role)");
    assert.ok(checagem > 0, "deleteBannerAction não confere o papel");
    assert.ok(checagem < body.indexOf("createClient()"), "o papel é conferido depois de abrir o banco");
  });
});
