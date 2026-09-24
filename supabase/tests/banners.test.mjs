import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { A, B, C, D, S1, S2, DENIED, RLS, asAnon, asService, asUser, setupDatabase } from "./support/harness.mjs";

/**
 * Banners da hero.
 *
 * O banner é texto e link editáveis por qualquer membro da loja e exibidos para todo
 * visitante. Por isso os testes cobrem três frentes: quem vê (só ativo de loja ativa),
 * quem mexe (membro edita, owner exclui, loja alheia nada) e o que o banco recusa
 * (link que sai do site e imagem que aponta para outra loja).
 */

const S3 = "10000000-0000-0000-0000-000000000003"; // loja DESATIVADA
const ON = "b0000000-0000-0000-0000-000000000001"; // ativo, loja 1
const OFF = "b0000000-0000-0000-0000-000000000002"; // inativo, loja 1
const HIDDEN = "b0000000-0000-0000-0000-000000000003"; // ativo, mas loja desativada
const OTHER = "b0000000-0000-0000-0000-000000000004"; // ativo, loja 2

const seed = `
  insert into public.stores (id, name, slug, active) values ('${S3}', 'Loja Off', 'loja-off', false);

  insert into public.store_banners (id, store_id, title, cta_label, cta_href, image_path, active, position) values
    ('${ON}',     '${S1}', 'Ativo',     'Ver', '/loja/loja-um/produtos', '${S1}/${ON}/a.webp', true, 0),
    ('${OFF}',    '${S1}', 'Inativo',   null,  null,                     null,                 false, 1),
    ('${HIDDEN}', '${S3}', 'Escondido', null,  null,                     null,                 true, 0),
    ('${OTHER}',  '${S2}', 'Da loja 2', null,  null,                     null,                 true, 0);
`;

const { run, rows, fails } = setupDatabase(seed);

const titles = async (actor) =>
  (await rows(actor, `select title from public.store_banners order by title`)).map((r) => r.title);

const insertBanner = (actor, columns, values) =>
  run(actor, `insert into public.store_banners (store_id, title, ${columns}) values ('${S1}', 'x', ${values})`);

describe("quem vê os banners", () => {
  test("visitante vê só os ativos de lojas ativas", async () => {
    assert.deepEqual(await titles(asAnon), ["Ativo", "Da loja 2"]);
  });

  test("visitante não vê o inativo nem pelo id", async () => {
    assert.deepEqual(await rows(asAnon, `select id from public.store_banners where id = '${OFF}'`), []);
    assert.deepEqual(await rows(asAnon, `select id from public.store_banners where id = '${HIDDEN}'`), []);
  });

  test("desativar a loja some com os banners dela", async () => {
    await run(asService, `update public.stores set active = false where id = '${S1}'`);
    assert.deepEqual(await titles(asAnon), ["Da loja 2"]);
  });

  test("membro vê todos os da própria loja, inclusive o inativo, e nada de outra loja", async () => {
    assert.deepEqual(await titles(asUser(A)), ["Ativo", "Inativo"]);
    assert.deepEqual(await titles(asUser(D)), ["Ativo", "Inativo"]);
  });

  test("usuário logado sem vínculo não vê banner algum", async () => {
    // A leitura pública vale só para anon; ver 20260921020555_allow_public_catalog_read.sql.
    assert.deepEqual(await titles(asUser(C)), []);
  });

  test("visitante não lê coluna interna", async () => {
    await fails(asAnon, `select created_at from public.store_banners`, DENIED);
  });
});

describe("quem mexe nos banners", () => {
  test("visitante não escreve", async () => {
    await fails(asAnon, `insert into public.store_banners (store_id, title) values ('${S1}', 'x')`, DENIED);
    await fails(asAnon, `update public.store_banners set title = 'x'`, DENIED);
    await fails(asAnon, `delete from public.store_banners`, DENIED);
  });

  test("editor cria e edita na própria loja, mas não exclui", async () => {
    await insertBanner(asUser(D), "active", "true");
    const updated = await rows(asUser(D), `update public.store_banners set title = 'Editado' where id = '${ON}' returning id`);
    assert.equal(updated.length, 1);
    const deleted = await rows(asUser(D), `delete from public.store_banners where id = '${ON}' returning id`);
    assert.equal(deleted.length, 0, "a policy de exclusão é só do owner");
  });

  test("owner exclui na própria loja", async () => {
    const deleted = await rows(asUser(A), `delete from public.store_banners where id = '${OFF}' returning id`);
    assert.equal(deleted.length, 1);
  });

  test("membro de uma loja não cria, edita nem exclui na outra", async () => {
    await fails(asUser(A), `insert into public.store_banners (store_id, title) values ('${S2}', 'invasor')`, RLS);
    assert.equal((await rows(asUser(A), `update public.store_banners set title = 'x' where id = '${OTHER}' returning id`)).length, 0);
    assert.equal((await rows(asUser(A), `delete from public.store_banners where id = '${OTHER}' returning id`)).length, 0);
    assert.equal((await rows(asUser(B), `update public.store_banners set title = 'x' where id = '${ON}' returning id`)).length, 0);
  });

  test("banner não muda de loja", async () => {
    await fails(asUser(A), `update public.store_banners set store_id = '${S2}' where id = '${ON}'`, DENIED);
  });
});

describe("o que o banco recusa", () => {
  const LINK = /store_banners_cta_href_internal/;

  for (const [nome, href] of [
    ["javascript:", "javascript:alert(1)"],
    ["endereço externo", "https://outro-site.com"],
    ["protocolo relativo", "//outro-site.com"],
    ["barra invertida", "/\\outro-site.com"],
    ["espaço", "/loja/x y"],
    ["quebra de linha", "/loja/x\ny"],
    ["caminho relativo", "loja/x"],
  ]) {
    test(`link de chamada recusado: ${nome}`, async () => {
      await fails(
        asService,
        `insert into public.store_banners (store_id, title, cta_label, cta_href) values ('${S1}', 'x', 'Ver', ${literal(href)})`,
        LINK,
      );
    });
  }

  test("link interno válido é aceito", async () => {
    await insertBanner(asService, "cta_label, cta_href", `'Ver', '/loja/loja-um/categoria/novidades?page=2'`);
  });

  test("chamada pela metade é recusada", async () => {
    await fails(asService, `insert into public.store_banners (store_id, title, cta_label) values ('${S1}', 'x', 'Ver')`, /store_banners_cta_complete/);
    await fails(asService, `insert into public.store_banners (store_id, title, cta_href) values ('${S1}', 'x', '/loja')`, /store_banners_cta_complete/);
  });

  test("imagem de outra loja é recusada", async () => {
    await fails(
      asService,
      `update public.store_banners set image_path = '${S2}/${ON}/a.webp' where id = '${ON}'`,
      /store_banners_image_path_scoped/,
    );
  });

  test("imagem de outro banner é recusada", async () => {
    await fails(
      asService,
      `update public.store_banners set image_path = '${S1}/${OFF}/a.webp' where id = '${ON}'`,
      /store_banners_image_path_scoped/,
    );
  });

  test("imagem fora da convenção é recusada", async () => {
    for (const path of [`${S1}/${ON}/../x.webp`, `${S1}/${ON}/a.svg`, `/${S1}/${ON}/a.webp`, `${S1}/${ON}/A.webp`]) {
      await fails(asService, `update public.store_banners set image_path = ${literal(path)} where id = '${ON}'`, /store_banners_image_path_scoped/);
    }
  });

  test("título vazio é recusado", async () => {
    await fails(asService, `insert into public.store_banners (store_id, title) values ('${S1}', '   ')`, /store_banners_title_length/);
  });
});

/** Literal SQL com aspas escapadas; só para os valores fixos deste arquivo. */
function literal(value) {
  return `E'${value.replace(/\\/g, "\\\\").replace(/'/g, "''").replace(/\n/g, "\\n")}'`;
}
