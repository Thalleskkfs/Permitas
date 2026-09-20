import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { A, B, C, D, S1, S2, RLS, asService, asSuperuser, asUser, setupDatabase } from "./support/harness.mjs";

/**
 * Semânticas de banco em que as Server Actions do painel se apoiam.
 *
 * As ações filtram por `.eq("store_id", store.storeId)` com a loja vinda da membership e
 * conferem as linhas retornadas. Estes testes provam o que acontece de fato quando a RLS
 * recusa: UPDATE e DELETE não dão erro, simplesmente não afetam linha nenhuma.
 */

const CAT1 = "20000000-0000-0000-0000-000000000001";
const CAT2 = "20000000-0000-0000-0000-000000000003";
const P1 = "30000000-0000-0000-0000-000000000001";
const P2 = "30000000-0000-0000-0000-000000000002";
const T1 = "40000000-0000-0000-0000-000000000001";
const T2 = "40000000-0000-0000-0000-000000000002";
const COL1 = "50000000-0000-0000-0000-000000000001";
const COL2 = "50000000-0000-0000-0000-000000000002";

const seed = `
  insert into public.categories (id, store_id, name, slug) values
    ('${CAT1}', '${S1}', 'Roupas', 'roupas'), ('${CAT2}', '${S2}', 'Roupas', 'roupas');
  insert into public.products (id, store_id, category_id, name, slug, price_cents, stock, status) values
    ('${P1}', '${S1}', '${CAT1}', 'Camiseta', 'camiseta', 5000, 10, 'published'),
    ('${P2}', '${S2}', '${CAT2}', 'Camiseta', 'camiseta', 5000, 10, 'published');
  insert into public.tags (id, store_id, name, slug) values
    ('${T1}', '${S1}', 'Novo', 'novo'), ('${T2}', '${S2}', 'Novo', 'novo');
  insert into public.collections (id, store_id, name, slug) values
    ('${COL1}', '${S1}', 'Destaques', 'destaques'), ('${COL2}', '${S2}', 'Destaques', 'destaques');
`;

const { run, rows, fails } = setupDatabase(seed);

/** Reproduz o filtro que as ações aplicam: id + loja autorizada. */
const updateProduct = (actor, productId, storeId, set) =>
  rows(actor, `update public.products set ${set} where id = '${productId}' and store_id = '${storeId}' returning id`);

const deleteProduct = (actor, productId, storeId) =>
  rows(actor, `delete from public.products where id = '${productId}' and store_id = '${storeId}' returning id`);

describe("criar produto", () => {
  for (const [label, user] of [["owner", A], ["editor", D]]) {
    test(`${label} cria na própria loja`, async () => {
      const created = await rows(
        asUser(user),
        `insert into public.products (store_id, name, slug, price_cents, stock, status)
         values ('${S1}', 'Novo ${label}', 'novo-${label}', 1990, 5, 'draft') returning id`,
      );
      assert.equal(created.length, 1);
    });
  }

  test("não cria na loja de outro, mesmo informando o store_id dela", async () => {
    await fails(
      asUser(A),
      `insert into public.products (store_id, name, slug, price_cents) values ('${S2}', 'x', 'invasor', 1000)`,
      RLS,
    );
    assert.equal((await rows(asSuperuser, `select 1 from public.products where slug = 'invasor'`)).length, 0);
  });

  test("usuário sem vínculo não cria nem lê", async () => {
    await fails(
      asUser(C),
      `insert into public.products (store_id, name, slug, price_cents) values ('${S1}', 'x', 'sem-vinculo', 1000)`,
      RLS,
    );
    assert.deepEqual(await rows(asUser(C), `select id from public.products`), []);
  });
});

describe("editar produto", () => {
  for (const [label, user] of [["owner", A], ["editor", D]]) {
    test(`${label} edita produto da própria loja`, async () => {
      const updated = await updateProduct(asUser(user), P1, S1, `name = 'Editado por ${label}'`);
      assert.equal(updated.length, 1);
    });

    test(`${label} arquiva produto da própria loja`, async () => {
      assert.equal((await updateProduct(asUser(user), P1, S1, `status = 'archived'`)).length, 1);
      const [product] = await rows(asSuperuser, `select status from public.products where id = '${P1}'`);
      assert.equal(product.status, "archived");
    });
  }

  test("editar produto de outra loja não afeta linha alguma, e sem erro", async () => {
    assert.deepEqual(await updateProduct(asUser(A), P2, S2, `name = 'invadido'`), []);
    assert.deepEqual(await updateProduct(asUser(A), P2, S1, `name = 'invadido'`), []);

    const [product] = await rows(asSuperuser, `select name from public.products where id = '${P2}'`);
    assert.equal(product.name, "Camiseta");
  });
});

describe("excluir produto", () => {
  test("owner exclui da própria loja", async () => {
    assert.equal((await deleteProduct(asUser(A), P1, S1)).length, 1);
  });

  test("editor não exclui: a policy simplesmente não devolve linhas", async () => {
    assert.deepEqual(await deleteProduct(asUser(D), P1, S1), [], "nenhuma linha removida");
    assert.equal((await rows(asSuperuser, `select 1 from public.products where id = '${P1}'`)).length, 1);
  });

  test("owner de uma loja não exclui produto de outra", async () => {
    assert.deepEqual(await deleteProduct(asUser(A), P2, S2), []);
    assert.equal((await rows(asSuperuser, `select 1 from public.products where id = '${P2}'`)).length, 1);
  });
});

describe("um store_id arbitrário não concede nada", () => {
  test("filtrar por outra loja devolve vazio na leitura", async () => {
    assert.deepEqual(await rows(asUser(A), `select id from public.products where store_id = '${S2}'`), []);
    assert.deepEqual(await rows(asUser(A), `select id from public.categories where store_id = '${S2}'`), []);
    assert.deepEqual(await rows(asUser(A), `select id from public.tags where store_id = '${S2}'`), []);
    assert.deepEqual(await rows(asUser(A), `select id from public.collections where store_id = '${S2}'`), []);
  });

  test("owner de S2 enxerga S2 — a diferença é o vínculo, não o filtro", async () => {
    assert.equal((await rows(asUser(B), `select id from public.products where store_id = '${S2}'`)).length, 1);
  });
});

describe("vínculos entre entidades de lojas diferentes", () => {
  test("categoria de outra loja não pode ser usada pelo produto", async () => {
    await fails(
      asUser(A),
      `update public.products set category_id = '${CAT2}' where id = '${P1}' and store_id = '${S1}'`,
      "23503",
    );
  });

  test("tag de outra loja não pode ser associada", async () => {
    await fails(
      asUser(A),
      `insert into public.product_tags (store_id, product_id, tag_id) values ('${S1}', '${P1}', '${T2}')`,
      "23503",
    );
  });

  test("coleção de outra loja não pode receber o produto", async () => {
    await fails(
      asUser(A),
      `insert into public.collection_products (store_id, collection_id, product_id) values ('${S1}', '${COL2}', '${P1}')`,
      "23503",
    );
  });

  test("vínculos da mesma loja funcionam e podem ser refeitos", async () => {
    await run(asUser(D), `insert into public.product_tags (store_id, product_id, tag_id) values ('${S1}', '${P1}', '${T1}')`);
    await run(asUser(D), `insert into public.collection_products (store_id, collection_id, product_id) values ('${S1}', '${COL1}', '${P1}')`);

    // O editor pode refazer vínculos: é o que a ação de salvar produto faz.
    assert.equal((await rows(asUser(D), `delete from public.product_tags where product_id = '${P1}' returning tag_id`)).length, 1);
    assert.equal((await rows(asUser(D), `delete from public.collection_products where product_id = '${P1}' returning product_id`)).length, 1);
  });
});

describe("variantes", () => {
  test("pertencem ao produto e à loja corretos", async () => {
    const [variant] = await rows(
      asUser(D),
      `insert into public.product_variants (store_id, product_id, name, stock) values ('${S1}', '${P1}', 'Tamanho M', 4) returning id, product_id, store_id`,
    );
    assert.equal(variant.product_id, P1);
    assert.equal(variant.store_id, S1);

    await fails(
      asUser(A),
      `insert into public.product_variants (store_id, product_id, name) values ('${S1}', '${P2}', 'x')`,
      "23503",
    );
    assert.deepEqual(await rows(asUser(B), `select id from public.product_variants`), []);
  });

  test("editor cria e edita variante, mas não exclui", async () => {
    const [variant] = await rows(
      asUser(D),
      `insert into public.product_variants (store_id, product_id, name, stock) values ('${S1}', '${P1}', 'Tamanho G', 2) returning id`,
    );
    assert.equal((await rows(asUser(D), `update public.product_variants set stock = 7 where id = '${variant.id}' returning id`)).length, 1);
    assert.deepEqual(await rows(asUser(D), `delete from public.product_variants where id = '${variant.id}' returning id`), []);
    assert.equal((await rows(asUser(A), `delete from public.product_variants where id = '${variant.id}' returning id`)).length, 1);
  });
});

describe("paginação e filtros no banco", () => {
  test("a paginação devolve fatias distintas e o total correto", async () => {
    await run(
      asService,
      `insert into public.products (store_id, name, slug, price_cents, stock, status)
       select '${S1}', 'Produto ' || i, 'produto-' || i, 1000 + i, i, 'published'
       from generate_series(1, 30) as i`,
    );

    const [{ total }] = await rows(asUser(A), `select count(*)::int as total from public.products where store_id = '${S1}'`);
    assert.equal(total, 31);

    const page = (offset) =>
      rows(asUser(A), `select id from public.products where store_id = '${S1}' order by created_at desc, id limit 24 offset ${offset}`);

    const first = await page(0);
    const second = await page(24);
    assert.equal(first.length, 24);
    assert.equal(second.length, 7);
    assert.equal(new Set([...first, ...second].map((r) => r.id)).size, 31, "sem repetição entre páginas");
  });

  test("filtros por status, categoria e texto funcionam", async () => {
    await run(asService, `insert into public.products (store_id, name, slug, sku, price_cents, status) values ('${S1}', 'Regata Azul', 'regata-azul', 'REG-1', 2000, 'draft')`);

    const drafts = await rows(asUser(A), `select slug from public.products where store_id = '${S1}' and status = 'draft'`);
    assert.deepEqual(drafts.map((r) => r.slug), ["regata-azul"]);

    const byCategory = await rows(asUser(A), `select slug from public.products where store_id = '${S1}' and category_id = '${CAT1}'`);
    assert.deepEqual(byCategory.map((r) => r.slug), ["camiseta"]);

    const byName = await rows(asUser(A), `select slug from public.products where store_id = '${S1}' and (name ilike '%regata%' or sku ilike '%regata%')`);
    assert.deepEqual(byName.map((r) => r.slug), ["regata-azul"]);

    const bySku = await rows(asUser(A), `select slug from public.products where store_id = '${S1}' and (name ilike '%REG-1%' or sku ilike '%REG-1%')`);
    assert.deepEqual(bySku.map((r) => r.slug), ["regata-azul"]);
  });
});

describe("o banco continua sendo a última barreira de preço", () => {
  test("preço zero e promoção inválida são recusados mesmo vindo do service_role", async () => {
    await fails(asService, `insert into public.products (store_id, name, slug, price_cents) values ('${S1}', 'x', 'gratis', 0)`, "23514");
    await fails(asService, `update public.products set price_cents = 0 where id = '${P1}'`, "23514");
    await fails(asService, `update public.products set promotional_price_cents = 6000 where id = '${P1}'`, "23514");
    await fails(asUser(A), `update public.products set promotional_price_cents = 0 where id = '${P1}' and store_id = '${S1}'`, "23514");
  });
});
