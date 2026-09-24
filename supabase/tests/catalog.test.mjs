import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  A, B, C, D, S1, S2, RLS, DENIED,
  asAnon, asService, asSuperuser, asUser, setupDatabase,
} from "./support/harness.mjs";

const CAT1 = "20000000-0000-0000-0000-000000000001"; // S1, raiz
const CAT1B = "20000000-0000-0000-0000-000000000002"; // S1, filha de CAT1
const CAT2 = "20000000-0000-0000-0000-000000000003"; // S2, raiz
const P1 = "30000000-0000-0000-0000-000000000001"; // S1, publicado
const P2 = "30000000-0000-0000-0000-000000000002"; // S2, publicado
const T1 = "40000000-0000-0000-0000-000000000001";
const T2 = "40000000-0000-0000-0000-000000000002";
const COL1 = "50000000-0000-0000-0000-000000000001";
const COL2 = "50000000-0000-0000-0000-000000000002";
const IMG1 = "60000000-0000-0000-0000-000000000001";
const IMG2 = "60000000-0000-0000-0000-000000000002";
const V1 = "70000000-0000-0000-0000-000000000001";
const V2 = "70000000-0000-0000-0000-000000000002";

const CHECK = "23514";
const UNIQUE = "23505";
const FK = "23503";

// Mesmos slugs e SKUs nas duas lojas: prova que a unicidade é por loja.
const catalogSeed = `
  insert into public.categories (id, store_id, parent_id, name, slug) values
    ('${CAT1}', '${S1}', null, 'Roupas', 'roupas'),
    ('${CAT1B}', '${S1}', '${CAT1}', 'Camisetas', 'camisetas'),
    ('${CAT2}', '${S2}', null, 'Roupas', 'roupas');
  insert into public.products (id, store_id, category_id, name, slug, sku, price_cents, promotional_price_cents, stock, status, featured) values
    ('${P1}', '${S1}', '${CAT1}', 'Camiseta', 'camiseta', 'CAM-1', 5000, 4000, 10, 'published', true),
    ('${P2}', '${S2}', '${CAT2}', 'Camiseta', 'camiseta', 'CAM-1', 5000, null, 10, 'published', false);
  insert into public.tags (id, store_id, name, slug) values
    ('${T1}', '${S1}', 'Novo', 'novo'), ('${T2}', '${S2}', 'Novo', 'novo');
  insert into public.collections (id, store_id, name, slug) values
    ('${COL1}', '${S1}', 'Destaques', 'destaques'), ('${COL2}', '${S2}', 'Destaques', 'destaques');
  insert into public.product_images (id, product_id, storage_path, alt_text, position) values
    ('${IMG1}', '${P1}', '${S1}/${P1}/frente.jpg', 'Frente', 0),
    ('${IMG2}', '${P2}', '${S2}/${P2}/frente.jpg', 'Frente', 0);
  insert into public.product_variants (id, store_id, product_id, name, sku, stock, options, position) values
    ('${V1}', '${S1}', '${P1}', 'Preta P', 'CAM-1-P', 3, '{"cor": "Preta", "tamanho": "P"}', 0),
    ('${V2}', '${S2}', '${P2}', 'Preta P', 'CAM-1-P', 3, '{"cor": "Preta", "tamanho": "P"}', 0);
  insert into public.product_tags (store_id, product_id, tag_id) values
    ('${S1}', '${P1}', '${T1}'), ('${S2}', '${P2}', '${T2}');
  insert into public.collection_products (store_id, collection_id, product_id, position) values
    ('${S1}', '${COL1}', '${P1}', 0), ('${S2}', '${COL2}', '${P2}', 0);
`;

const { run, rows, fails } = setupDatabase(catalogSeed);

const CATALOG_TABLES = [
  "categories", "products", "product_images", "product_variants",
  "tags", "product_tags", "collections", "collection_products",
];

const count = async (actor, table, where = "true") =>
  (await rows(actor, `select count(*)::int as n from public.${table} where ${where}`))[0].n;

const newProduct = async (actor, store, slug, extra = {}) => {
  const cols = { name: `Produto ${slug}`, price_cents: 1000, ...extra };
  const [row] = await rows(
    actor,
    `insert into public.products (store_id, slug, ${Object.keys(cols).join(", ")})
     values ('${store}', '${slug}', ${Object.values(cols).map((v) => (typeof v === "number" ? v : `'${v}'`)).join(", ")})
     returning id`,
  );
  return row.id;
};

describe("privilégios e RLS das tabelas do catálogo", () => {
  test("anon não escreve em tabela alguma do catálogo nem lê coluna interna", async () => {
    // A leitura do catálogo PUBLICADO por anon passou a ser intencional — é o que faz a
    // vitrine existir — e está provada em detalhe em public-read.test.mjs, inclusive o
    // que não pode vazar. O que fica aqui é o que não muda em hipótese alguma: a
    // vitrine é estritamente de leitura, e colunas internas seguem fora de alcance.
    const privilege = async (sql) => (await rows(asSuperuser, sql))[0].ok;
    for (const table of CATALOG_TABLES) {
      for (const op of ["INSERT", "UPDATE", "DELETE"]) {
        assert.equal(
          await privilege(`select has_table_privilege('anon', 'public.${table}', '${op}') as ok`),
          false,
          `anon ${op} ${table}`,
        );
      }
    }
    await fails(asAnon, `insert into public.products (store_id, name, slug, price_cents) values ('${S1}', 'x', 'x', 1)`, DENIED);
    await fails(asAnon, `select sku from public.products`, DENIED);
  });

  test("usuário sem membership (C) não enxerga nada e não cria nada", async () => {
    for (const table of CATALOG_TABLES) {
      assert.equal(await count(asUser(C), table), 0, table);
    }
    await fails(asUser(C), `insert into public.products (store_id, name, slug, price_cents) values ('${S1}', 'x', 'x', 1)`, RLS);
    await fails(asUser(C), `insert into public.categories (store_id, name, slug) values ('${S1}', 'x', 'x')`, RLS);
  });

  test("clientes não podem mover linhas entre lojas ou produtos (colunas imutáveis)", async () => {
    const privilege = async (sql) => (await rows(asSuperuser, sql))[0].ok;
    for (const [table, column] of [
      ["categories", "store_id"], ["products", "store_id"], ["product_variants", "store_id"],
      ["product_variants", "product_id"], ["product_images", "product_id"], ["tags", "store_id"],
      ["collections", "store_id"], ["collection_products", "collection_id"], ["collection_products", "product_id"],
    ]) {
      assert.equal(await privilege(`select has_column_privilege('authenticated', 'public.${table}', '${column}', 'UPDATE') as ok`), false, `${table}.${column}`);
    }
    assert.equal(await privilege(`select has_table_privilege('authenticated', 'public.product_tags', 'UPDATE') as ok`), false);
    await fails(asUser(A), `update public.products set store_id = '${S2}' where id = '${P1}'`, DENIED);
  });
});

describe("isolamento: usuário A não acessa o catálogo da loja B", () => {
  test("A lê apenas o catálogo da própria loja", async () => {
    assert.deepEqual((await rows(asUser(A), `select id from public.products`)).map((r) => r.id), [P1]);
    for (const table of ["categories", "tags", "collections", "product_variants", "product_tags", "collection_products"]) {
      const data = await rows(asUser(A), `select store_id from public.${table}`);
      assert.ok(data.length > 0, table);
      assert.ok(data.every((r) => r.store_id === S1), `${table} vazou dados da loja B`);
    }
    assert.deepEqual((await rows(asUser(A), `select id from public.product_images`)).map((r) => r.id), [IMG1]);
    assert.equal((await rows(asUser(A), `select id from public.products where id = '${P2}'`)).length, 0);
  });

  test("A não cria registros do catálogo na loja B", async () => {
    await fails(asUser(A), `insert into public.products (store_id, name, slug, price_cents) values ('${S2}', 'x', 'invasor', 1)`, RLS);
    await fails(asUser(A), `insert into public.categories (store_id, name, slug) values ('${S2}', 'x', 'invasora')`, RLS);
    await fails(asUser(A), `insert into public.tags (store_id, name, slug) values ('${S2}', 'x', 'invasora')`, RLS);
    await fails(asUser(A), `insert into public.collections (store_id, name, slug) values ('${S2}', 'x', 'invasora')`, RLS);
    await fails(asUser(A), `insert into public.product_variants (store_id, product_id, name) values ('${S2}', '${P2}', 'x')`, RLS);
    await fails(asUser(A), `insert into public.product_images (product_id, storage_path) values ('${P2}', '${S2}/${P2}/invasor.jpg')`, RLS);
    await fails(asUser(A), `insert into public.product_tags (store_id, product_id, tag_id) values ('${S2}', '${P2}', '${T2}')`, RLS);
    await fails(asUser(A), `insert into public.collection_products (store_id, collection_id, product_id) values ('${S2}', '${COL2}', '${P2}')`, RLS);
  });

  test("A não altera registros do catálogo da loja B", async () => {
    const updates = {
      products: `set name = 'invadido' where id = '${P2}'`,
      categories: `set name = 'invadida' where id = '${CAT2}'`,
      tags: `set name = 'invadida' where id = '${T2}'`,
      collections: `set name = 'invadida' where id = '${COL2}'`,
      product_variants: `set name = 'invadida' where id = '${V2}'`,
      product_images: `set alt_text = 'invadida' where id = '${IMG2}'`,
      collection_products: `set position = 9 where collection_id = '${COL2}'`,
    };
    for (const [table, change] of Object.entries(updates)) {
      const changed = await rows(asUser(A), `update public.${table} ${change} returning 1`);
      assert.equal(changed.length, 0, table);
    }
    const [product] = await rows(asSuperuser, `select name from public.products where id = '${P2}'`);
    assert.equal(product.name, "Camiseta");
    const [image] = await rows(asSuperuser, `select alt_text from public.product_images where id = '${IMG2}'`);
    assert.equal(image.alt_text, "Frente");
  });

  test("A não exclui registros do catálogo da loja B", async () => {
    const deletes = {
      products: `id = '${P2}'`,
      categories: `id = '${CAT2}'`,
      tags: `id = '${T2}'`,
      collections: `id = '${COL2}'`,
      product_variants: `id = '${V2}'`,
      product_images: `id = '${IMG2}'`,
      product_tags: `product_id = '${P2}'`,
      collection_products: `collection_id = '${COL2}'`,
    };
    for (const [table, where] of Object.entries(deletes)) {
      assert.equal((await rows(asUser(A), `delete from public.${table} where ${where} returning 1`)).length, 0, table);
    }
    for (const table of CATALOG_TABLES) {
      assert.ok((await count(asSuperuser, table, table === "product_images" ? `id = '${IMG2}'` : "true")) > 0, table);
    }
    assert.equal(await count(asSuperuser, "products", `id = '${P2}'`), 1);
  });
});

describe("owner (A) administra o catálogo", () => {
  test("cria, atualiza, reorganiza e exclui", async () => {
    const [cat] = await rows(asUser(A), `insert into public.categories (store_id, parent_id, name, slug, sort_order) values ('${S1}', '${CAT1}', 'Regatas', 'regatas', 5) returning id`);
    const product = await newProduct(asUser(A), S1, "regata", { category_id: cat.id, status: "published" });
    const [tag] = await rows(asUser(A), `insert into public.tags (store_id, name, slug) values ('${S1}', 'Verão', 'verao') returning id`);
    const [col] = await rows(asUser(A), `insert into public.collections (store_id, name, slug) values ('${S1}', 'Verão', 'verao') returning id`);
    await run(asUser(A), `insert into public.product_tags (store_id, product_id, tag_id) values ('${S1}', '${product}', '${tag.id}')`);
    await run(asUser(A), `insert into public.collection_products (store_id, collection_id, product_id, position) values ('${S1}', '${col.id}', '${product}', 3)`);
    await run(asUser(A), `insert into public.product_variants (store_id, product_id, name, stock) values ('${S1}', '${product}', 'Única', 4)`);
    await run(asUser(A), `insert into public.product_images (product_id, storage_path) values ('${product}', '${S1}/${product}/a.jpg')`);

    const [updated] = await rows(asUser(A), `update public.products set name = 'Regata nova', price_cents = 2500, featured = true where id = '${product}' returning name, price_cents, featured, updated_at > created_at as touched`);
    assert.deepEqual([updated.name, updated.price_cents, updated.featured, updated.touched], ["Regata nova", 2500, true, true]);
    assert.equal((await rows(asUser(A), `update public.categories set sort_order = 1 where id = '${cat.id}' returning 1`)).length, 1);
    assert.equal((await rows(asUser(A), `update public.collection_products set position = 0 where collection_id = '${col.id}' returning 1`)).length, 1);

    for (const [table, where] of [
      ["product_tags", `product_id = '${product}'`],
      ["collection_products", `product_id = '${product}'`],
      ["product_variants", `product_id = '${product}'`],
      ["product_images", `product_id = '${product}'`],
      ["products", `id = '${product}'`],
      ["tags", `id = '${tag.id}'`],
      ["collections", `id = '${col.id}'`],
      ["categories", `id = '${cat.id}'`],
    ]) {
      assert.equal((await rows(asUser(A), `delete from public.${table} where ${where} returning 1`)).length, 1, table);
    }
  });

  test("excluir o produto remove imagens, variantes e vínculos; excluir a loja remove todo o catálogo", async () => {
    await run(asUser(A), `delete from public.products where id = '${P1}'`);
    for (const table of ["product_images", "product_variants", "product_tags", "collection_products"]) {
      assert.equal(await count(asSuperuser, table, table === "product_images" ? `id = '${IMG1}'` : `store_id = '${S1}'`), 0, table);
    }
    await run(asService, `delete from public.stores where id = '${S2}'`);
    for (const table of CATALOG_TABLES) {
      assert.equal(await count(asSuperuser, table, table === "product_images" ? `id = '${IMG2}'` : `store_id = '${S2}'`), 0, table);
    }
    assert.equal(await count(asSuperuser, "products", `store_id = '${S1}'`), 0);
  });

  test("excluir categoria não apaga produtos nem subcategorias: apenas desvincula", async () => {
    await run(asUser(A), `delete from public.categories where id = '${CAT1}'`);
    const [product] = await rows(asSuperuser, `select category_id from public.products where id = '${P1}'`);
    const [child] = await rows(asSuperuser, `select parent_id from public.categories where id = '${CAT1B}'`);
    assert.equal(product.category_id, null);
    assert.equal(child.parent_id, null);
    assert.equal(await count(asSuperuser, "products", `id = '${P1}'`), 1);
  });
});

describe("editor (D) trabalha no catálogo sem excluir estruturas", () => {
  test("cria, altera e reorganiza o catálogo da própria loja", async () => {
    const [cat] = await rows(asUser(D), `insert into public.categories (store_id, name, slug) values ('${S1}', 'Calças', 'calcas') returning id`);
    const product = await newProduct(asUser(D), S1, "calca", { category_id: cat.id });
    const [tag] = await rows(asUser(D), `insert into public.tags (store_id, name, slug) values ('${S1}', 'Inverno', 'inverno') returning id`);
    const [col] = await rows(asUser(D), `insert into public.collections (store_id, name, slug) values ('${S1}', 'Inverno', 'inverno') returning id`);
    await run(asUser(D), `insert into public.product_variants (store_id, product_id, name, stock) values ('${S1}', '${product}', 'M', 2)`);
    await run(asUser(D), `insert into public.product_images (product_id, storage_path) values ('${product}', '${S1}/${product}/a.jpg')`);
    await run(asUser(D), `insert into public.product_tags (store_id, product_id, tag_id) values ('${S1}', '${product}', '${tag.id}')`);
    await run(asUser(D), `insert into public.collection_products (store_id, collection_id, product_id, position) values ('${S1}', '${col.id}', '${product}', 1)`);

    assert.equal((await rows(asUser(D), `update public.products set price_cents = 9900, status = 'published' where id = '${product}' returning 1`)).length, 1);
    assert.equal((await rows(asUser(D), `update public.categories set sort_order = 7 where id = '${cat.id}' returning 1`)).length, 1);
    assert.equal((await rows(asUser(D), `update public.collection_products set position = 0 where collection_id = '${col.id}' returning 1`)).length, 1);
    assert.equal((await rows(asUser(D), `update public.product_variants set active = false where product_id = '${product}' returning 1`)).length, 1);
    assert.equal((await rows(asUser(D), `update public.collections set active = false where id = '${col.id}' returning 1`)).length, 1);
  });

  test("não exclui categorias, produtos, variantes, tags nem coleções", async () => {
    for (const [table, where] of [
      ["products", `id = '${P1}'`],
      ["categories", `id = '${CAT1B}'`],
      ["product_variants", `id = '${V1}'`],
      ["tags", `id = '${T1}'`],
      ["collections", `id = '${COL1}'`],
    ]) {
      assert.equal((await rows(asUser(D), `delete from public.${table} where ${where} returning 1`)).length, 0, table);
      assert.equal(await count(asSuperuser, table, where), 1, `${table} foi excluído pelo editor`);
    }
  });

  test("pode remover mídia e vínculos, e arquivar em vez de excluir", async () => {
    assert.equal((await rows(asUser(D), `delete from public.product_images where id = '${IMG1}' returning 1`)).length, 1);
    assert.equal((await rows(asUser(D), `delete from public.product_tags where product_id = '${P1}' returning 1`)).length, 1);
    assert.equal((await rows(asUser(D), `delete from public.collection_products where product_id = '${P1}' returning 1`)).length, 1);
    const [archived] = await rows(asUser(D), `update public.products set status = 'archived' where id = '${P1}' returning status`);
    assert.equal(archived.status, "archived");
  });

  test("não age na loja B", async () => {
    await fails(asUser(D), `insert into public.products (store_id, name, slug, price_cents) values ('${S2}', 'x', 'x', 1)`, RLS);
    assert.equal((await rows(asUser(D), `update public.products set name = 'x' where id = '${P2}' returning 1`)).length, 0);
  });
});

describe("integridade entre lojas (garantida por FK composta, mesmo para service_role)", () => {
  test("produto não aponta para categoria de outra loja", async () => {
    await fails(asService, `insert into public.products (store_id, category_id, name, slug, price_cents) values ('${S1}', '${CAT2}', 'x', 'x', 1)`, FK);
    await fails(asService, `update public.products set category_id = '${CAT2}' where id = '${P1}'`, FK);
    await fails(asUser(A), `insert into public.products (store_id, category_id, name, slug, price_cents) values ('${S1}', '${CAT2}', 'x', 'x', 1)`, FK);
    await fails(asUser(A), `update public.products set category_id = '${CAT2}' where id = '${P1}'`, FK);
  });

  test("categoria não tem parent de outra loja", async () => {
    await fails(asService, `insert into public.categories (store_id, parent_id, name, slug) values ('${S1}', '${CAT2}', 'x', 'x')`, FK);
    await fails(asService, `update public.categories set parent_id = '${CAT2}' where id = '${CAT1B}'`, FK);
    await fails(asUser(A), `update public.categories set parent_id = '${CAT2}' where id = '${CAT1B}'`, FK);
  });

  test("tag não vincula a produto de outra loja", async () => {
    await fails(asService, `insert into public.product_tags (store_id, product_id, tag_id) values ('${S1}', '${P1}', '${T2}')`, FK);
    await fails(asService, `insert into public.product_tags (store_id, product_id, tag_id) values ('${S2}', '${P1}', '${T2}')`, FK);
    await fails(asService, `insert into public.product_tags (store_id, product_id, tag_id) values ('${S1}', '${P2}', '${T1}')`, FK);
    await fails(asUser(A), `insert into public.product_tags (store_id, product_id, tag_id) values ('${S1}', '${P1}', '${T2}')`, FK);
  });

  test("coleção não recebe produto de outra loja", async () => {
    const other = await newProduct(asService, S1, "avulso");
    await fails(asService, `insert into public.collection_products (store_id, collection_id, product_id) values ('${S1}', '${COL1}', '${P2}')`, FK);
    await fails(asService, `insert into public.collection_products (store_id, collection_id, product_id) values ('${S1}', '${COL2}', '${other}')`, FK);
    await fails(asService, `insert into public.collection_products (store_id, collection_id, product_id) values ('${S2}', '${COL1}', '${other}')`, FK);
    await fails(asUser(A), `insert into public.collection_products (store_id, collection_id, product_id) values ('${S1}', '${COL1}', '${P2}')`, FK);
  });

  test("variante não usa produto de outra loja", async () => {
    await fails(asService, `insert into public.product_variants (store_id, product_id, name) values ('${S1}', '${P2}', 'x')`, FK);
    await fails(asService, `insert into public.product_variants (store_id, product_id, name) values ('${S2}', '${P1}', 'x')`, FK);
  });

  test("produtos, tags e coleções da mesma loja se relacionam normalmente", async () => {
    const product = await newProduct(asUser(A), S1, "outro");
    await run(asUser(A), `insert into public.product_tags (store_id, product_id, tag_id) values ('${S1}', '${product}', '${T1}')`);
    await run(asUser(A), `insert into public.collection_products (store_id, collection_id, product_id, position) values ('${S1}', '${COL1}', '${product}', 1)`);
    await fails(asUser(A), `insert into public.product_tags (store_id, product_id, tag_id) values ('${S1}', '${product}', '${T1}')`, UNIQUE);
  });
});

describe("hierarquia de categorias", () => {
  const cycle = /ciclos/;

  test("categorias raiz (parent NULL) e filhas funcionam", async () => {
    const [root] = await rows(asUser(A), `select parent_id from public.categories where id = '${CAT1}'`);
    const [child] = await rows(asUser(A), `select parent_id from public.categories where id = '${CAT1B}'`);
    assert.equal(root.parent_id, null);
    assert.equal(child.parent_id, CAT1);
  });

  test("uma categoria não pode ser pai de si mesma", async () => {
    await fails(asUser(A), `update public.categories set parent_id = id where id = '${CAT1}'`, CHECK);
  });

  test("bloqueia ciclos diretos e profundos", async () => {
    await fails(asUser(A), `update public.categories set parent_id = '${CAT1B}' where id = '${CAT1}'`, cycle);
    const [c] = await rows(asUser(A), `insert into public.categories (store_id, parent_id, name, slug) values ('${S1}', '${CAT1B}', 'Neta', 'neta') returning id`);
    await fails(asUser(A), `update public.categories set parent_id = '${c.id}' where id = '${CAT1}'`, cycle);
    await fails(asService, `update public.categories set parent_id = '${c.id}' where id = '${CAT1}'`, CHECK);
  });

  test("bloqueia ciclo criado por um único UPDATE em lote", async () => {
    await fails(
      asUser(A),
      `update public.categories
         set parent_id = case id when '${CAT1}' then '${CAT1B}'::uuid when '${CAT1B}' then '${CAT1}'::uuid end
       where id in ('${CAT1}', '${CAT1B}')`,
      cycle,
    );
    const [root] = await rows(asSuperuser, `select parent_id from public.categories where id = '${CAT1}'`);
    assert.equal(root.parent_id, null);
  });

  test("reorganizar a hierarquia sem ciclo é permitido", async () => {
    await run(asUser(D), `update public.categories set parent_id = null where id = '${CAT1B}'`);
    await run(asUser(D), `update public.categories set parent_id = '${CAT1B}' where id = '${CAT1}'`);
    const [row] = await rows(asSuperuser, `select parent_id from public.categories where id = '${CAT1}'`);
    assert.equal(row.parent_id, CAT1B);
  });
});

describe("preços e estoque", () => {
  const priceRule = /products_price_positive/;
  const promoRule = /products_promotional_price_valid/;
  const variantPriceRule = /product_variants_price_positive/;
  const insertProduct = (actor, price, promo = "null") =>
    run(actor, `insert into public.products (store_id, name, slug, price_cents, promotional_price_cents) values ('${S1}', 'x', 'preco-${Math.random().toString(36).slice(2, 8)}', ${price}, ${promo})`);
  const insertVariant = (actor, price) =>
    run(actor, `insert into public.product_variants (store_id, product_id, name, price_cents) values ('${S1}', '${P1}', 'x', ${price})`);

  test("produto com preço 0 ou negativo é bloqueado (insert e update)", async () => {
    await fails(asUser(A), `insert into public.products (store_id, name, slug, price_cents) values ('${S1}', 'x', 'gratis', 0)`, priceRule);
    await fails(asUser(A), `insert into public.products (store_id, name, slug, price_cents) values ('${S1}', 'x', 'neg', -1)`, priceRule);
    await fails(asUser(A), `update public.products set price_cents = 0 where id = '${P1}'`, priceRule);
    await fails(asUser(D), `update public.products set price_cents = -100 where id = '${P1}'`, priceRule);
    await fails(asService, `insert into public.products (store_id, name, slug, price_cents) values ('${S1}', 'x', 'gratis-svc', 0)`, priceRule);
  });

  test("preço promocional 0 ou negativo é bloqueado quando informado", async () => {
    await fails(asUser(A), `insert into public.products (store_id, name, slug, price_cents, promotional_price_cents) values ('${S1}', 'x', 'promo-zero', 1000, 0)`, promoRule);
    await fails(asUser(A), `insert into public.products (store_id, name, slug, price_cents, promotional_price_cents) values ('${S1}', 'x', 'promo-neg', 1000, -1)`, promoRule);
    await fails(asUser(A), `update public.products set promotional_price_cents = 0 where id = '${P1}'`, promoRule);
    await fails(asUser(D), `update public.products set promotional_price_cents = -5 where id = '${P1}'`, promoRule);
  });

  test("preço promocional maior que o preço normal é bloqueado", async () => {
    await fails(asUser(A), `insert into public.products (store_id, name, slug, price_cents, promotional_price_cents) values ('${S1}', 'x', 'promo-alto', 1000, 1001)`, promoRule);
    await fails(asUser(D), `update public.products set promotional_price_cents = 5001 where id = '${P1}'`, promoRule);
    await fails(asUser(A), `update public.products set price_cents = 3999 where id = '${P1}'`, promoRule);
  });

  test("preço promocional igual ao preço normal continua permitido", async () => {
    await insertProduct(asUser(A), "1000", "1000");
    await run(asUser(A), `update public.products set price_cents = 4000 where id = '${P1}'`);
    await run(asUser(A), `update public.products set promotional_price_cents = 4000 where id = '${P1}'`);
  });

  test("preços positivos normais continuam funcionando", async () => {
    await insertProduct(asUser(A), "1");
    await insertProduct(asUser(A), "1000");
    await insertProduct(asUser(A), "1000", "1");
    await insertProduct(asUser(A), "1000", "999");
    await insertProduct(asUser(D), "2599", "1999");
    await run(asUser(A), `update public.products set price_cents = 6000, promotional_price_cents = 5500 where id = '${P1}'`);
    await run(asUser(A), `update public.products set promotional_price_cents = null where id = '${P1}'`);
    const [row] = await rows(asUser(A), `select price_cents, promotional_price_cents from public.products where id = '${P1}'`);
    assert.deepEqual([row.price_cents, row.promotional_price_cents], [6000, null]);
  });

  test("variante: preço 0 ou negativo é bloqueado; ausente ou positivo é aceito", async () => {
    await fails(asUser(A), `insert into public.product_variants (store_id, product_id, name, price_cents) values ('${S1}', '${P1}', 'x', 0)`, variantPriceRule);
    await fails(asUser(A), `insert into public.product_variants (store_id, product_id, name, price_cents) values ('${S1}', '${P1}', 'x', -1)`, variantPriceRule);
    await fails(asUser(A), `update public.product_variants set price_cents = 0 where id = '${V1}'`, variantPriceRule);
    await fails(asUser(D), `update public.product_variants set price_cents = -10 where id = '${V1}'`, variantPriceRule);
    await fails(asService, `insert into public.product_variants (store_id, product_id, name, price_cents) values ('${S1}', '${P1}', 'x', 0)`, variantPriceRule);

    await insertVariant(asUser(A), "4500");
    await insertVariant(asUser(A), "1");
    await run(asUser(A), `insert into public.product_variants (store_id, product_id, name) values ('${S1}', '${P1}', 'sem preço')`);
    await run(asUser(A), `update public.product_variants set price_cents = null where id = '${V1}'`);
  });

  test("nenhuma constraint monetária do banco admite zero", async () => {
    const defs = await rows(
      asSuperuser,
      `select conrelid::regclass::text as tbl, conname, pg_get_constraintdef(oid) as def
       from pg_constraint
       where contype = 'c' and conrelid in ('public.products'::regclass, 'public.product_variants'::regclass)
         and pg_get_constraintdef(oid) ~ 'price_cents'`,
    );
    assert.deepEqual(defs.map((d) => d.conname).sort(), [
      "product_variants_price_positive",
      "products_price_positive",
      "products_promotional_price_valid",
    ]);
    for (const { conname, def } of defs) {
      assert.doesNotMatch(def, />=\s*0(?!\d)/, `${conname} ainda admite zero: ${def}`);
    }
  });

  test("estoque não pode ser negativo (produto e variante), mas pode ser zero", async () => {
    await fails(asUser(A), `insert into public.products (store_id, name, slug, price_cents, stock) values ('${S1}', 'x', 'estoque-neg', 1, -1)`, CHECK);
    await fails(asUser(A), `update public.products set stock = -5 where id = '${P1}'`, CHECK);
    await fails(asUser(A), `insert into public.product_variants (store_id, product_id, name, stock) values ('${S1}', '${P1}', 'x', -1)`, CHECK);
    await fails(asUser(A), `update public.product_variants set stock = -1 where id = '${V1}'`, CHECK);
    await run(asUser(A), `update public.products set stock = 0 where id = '${P1}'`);
    await run(asUser(A), `update public.product_variants set stock = 0 where id = '${V1}'`);
  });
});

describe("slugs e SKUs", () => {
  test("slug duplicado na mesma loja é bloqueado em todas as entidades", async () => {
    await fails(asUser(A), `insert into public.products (store_id, name, slug, price_cents) values ('${S1}', 'x', 'camiseta', 1)`, UNIQUE);
    await fails(asUser(A), `insert into public.categories (store_id, name, slug) values ('${S1}', 'x', 'roupas')`, UNIQUE);
    await fails(asUser(A), `insert into public.tags (store_id, name, slug) values ('${S1}', 'x', 'novo')`, UNIQUE);
    await fails(asUser(A), `insert into public.collections (store_id, name, slug) values ('${S1}', 'x', 'destaques')`, UNIQUE);
    await fails(asUser(A), `update public.categories set slug = 'roupas' where id = '${CAT1B}'`, UNIQUE);
  });

  test("slugs e SKUs iguais em lojas diferentes são permitidos", async () => {
    for (const [table, slug] of [["products", "camiseta"], ["categories", "roupas"], ["tags", "novo"], ["collections", "destaques"]]) {
      const stores = await rows(asSuperuser, `select store_id from public.${table} where slug = '${slug}' order by store_id`);
      assert.deepEqual(stores.map((r) => r.store_id), [S1, S2], table);
    }
    const skus = await rows(asSuperuser, `select store_id from public.products where sku = 'CAM-1' order by store_id`);
    assert.equal(skus.length, 2);
    await run(asUser(B), `insert into public.categories (store_id, name, slug) values ('${S2}', 'Novo', 'camisetas')`);
    await run(asUser(A), `insert into public.categories (store_id, name, slug) values ('${S1}', 'Outro', 'sapatos')`);
  });

  test("SKU é único por loja (produto e variante); opcional e múltiplos NULL são aceitos", async () => {
    await fails(asUser(A), `insert into public.products (store_id, name, slug, sku, price_cents) values ('${S1}', 'x', 'sku-dup', 'CAM-1', 1)`, UNIQUE);
    await fails(asUser(A), `insert into public.product_variants (store_id, product_id, name, sku) values ('${S1}', '${P1}', 'x', 'CAM-1-P')`, UNIQUE);
    await run(asUser(A), `insert into public.products (store_id, name, slug, price_cents) values ('${S1}', 'x', 'sem-sku-1', 1), ('${S1}', 'y', 'sem-sku-2', 1)`);
    await run(asUser(A), `insert into public.product_variants (store_id, product_id, name) values ('${S1}', '${P1}', 'a'), ('${S1}', '${P1}', 'b')`);
    await fails(asUser(A), `insert into public.products (store_id, name, slug, sku, price_cents) values ('${S1}', 'x', 'sku-vazio', '  ', 1)`, CHECK);
  });

  test("formato do slug é validado", async () => {
    for (const slug of ["Camiseta", "com espaço", "-inicio", "fim-", "dupla--barra", "acentuação"]) {
      await fails(asUser(A), `insert into public.products (store_id, name, slug, price_cents) values ('${S1}', 'x', '${slug}', 1)`, CHECK);
    }
  });
});

describe("produtos simples, variantes, imagens e coleções", () => {
  test("produto sem variantes funciona", async () => {
    const id = await newProduct(asUser(A), S1, "simples", { status: "published" });
    const [row] = await rows(asUser(A), `select p.status, (select count(*)::int from public.product_variants v where v.product_id = p.id) as variants from public.products p where p.id = '${id}'`);
    assert.deepEqual([row.status, row.variants], ["published", 0]);
  });

  test("produto com múltiplas variantes funciona e guarda options em JSONB", async () => {
    const id = await newProduct(asUser(A), S1, "multi");
    for (const [position, name, options] of [[2, "Branca G", { cor: "Branca", tamanho: "G" }], [0, "Preta M", { cor: "Preta", tamanho: "M" }], [1, "Preta G", { cor: "Preta", tamanho: "G" }]]) {
      await run(asUser(A), `insert into public.product_variants (store_id, product_id, name, sku, stock, options, position) values ('${S1}', '${id}', $1, $2, 5, $3::jsonb, $4)`, [name, `SKU-${position}`, JSON.stringify(options), position]);
    }
    const variants = await rows(asUser(A), `select name, options->>'cor' as cor, options->>'tamanho' as tamanho from public.product_variants where product_id = '${id}' order by position`);
    assert.deepEqual(variants.map((v) => `${v.name}|${v.cor}|${v.tamanho}`), ["Preta M|Preta|M", "Preta G|Preta|G", "Branca G|Branca|G"]);
  });

  test("options precisa ser um objeto JSON com valores em texto e tamanho limitado", async () => {
    const insert = (options) => run(asUser(A), `insert into public.product_variants (store_id, product_id, name, options) values ('${S1}', '${P1}', 'x', $1::jsonb)`, [JSON.stringify(options)]);
    await insert({});
    await insert({ cor: "Preto" });
    await assert.rejects(insert(["Preto"]), { code: CHECK });
    await assert.rejects(insert({ tamanho: 42 }), { code: CHECK });
    await assert.rejects(insert({ cor: { nome: "Preto" } }), { code: CHECK });
    await assert.rejects(insert({ cor: "x".repeat(2100) }), { code: CHECK });
  });

  test("coleção mantém a ordem manual (position) e permite reorganizar", async () => {
    const ids = [];
    for (const slug of ["c-um", "c-dois", "c-tres"]) ids.push(await newProduct(asUser(A), S1, slug));
    const positions = [2, 0, 1];
    for (const [i, id] of ids.entries()) {
      await run(asUser(A), `insert into public.collection_products (store_id, collection_id, product_id, position) values ('${S1}', '${COL1}', '${id}', ${positions[i]})`);
    }
    const order = async () => (await rows(asUser(A), `select product_id from public.collection_products where collection_id = '${COL1}' and product_id <> '${P1}' order by position`)).map((r) => r.product_id);
    assert.deepEqual(await order(), [ids[1], ids[2], ids[0]]);

    await run(asUser(D), `update public.collection_products set position = 10 where collection_id = '${COL1}' and product_id = '${ids[1]}'`);
    assert.deepEqual(await order(), [ids[2], ids[0], ids[1]]);
    await fails(asUser(A), `update public.collection_products set position = -1 where collection_id = '${COL1}' and product_id = '${ids[0]}'`, CHECK);
  });

  test("imagens mantêm a ordem (position), aceitam reordenação e validam o caminho", async () => {
    const id = await newProduct(asUser(A), S1, "galeria");
    for (const [position, file] of [[2, "c.jpg"], [0, "a.jpg"], [1, "b.jpg"]]) {
      await run(asUser(A), `insert into public.product_images (product_id, storage_path, alt_text, position) values ('${id}', '${S1}/${id}/${file}', '${file}', ${position})`);
    }
    const order = async () => (await rows(asUser(A), `select alt_text from public.product_images where product_id = '${id}' order by position`)).map((r) => r.alt_text);
    assert.deepEqual(await order(), ["a.jpg", "b.jpg", "c.jpg"]);
    await run(asUser(D), `update public.product_images set position = 5 where product_id = '${id}' and alt_text = 'a.jpg'`);
    assert.deepEqual(await order(), ["b.jpg", "c.jpg", "a.jpg"]);

    await fails(asUser(A), `insert into public.product_images (product_id, storage_path) values ('${id}', '/absoluto.jpg')`, CHECK);
    await fails(asUser(A), `insert into public.product_images (product_id, storage_path) values ('${id}', '${S1}/../${S2}/x.jpg')`, CHECK);
    await fails(asUser(A), `insert into public.product_images (product_id, storage_path) values ('${id}', '')`, CHECK);
    await fails(asUser(A), `insert into public.product_images (product_id, storage_path, position) values ('${id}', '${S1}/x.jpg', -1)`, CHECK);
  });

  test("produto arquivado permanece no banco e continua administrável", async () => {
    const [archived] = await rows(asUser(A), `update public.products set status = 'archived' where id = '${P1}' returning status`);
    assert.equal(archived.status, "archived");
    assert.equal(await count(asUser(A), "products", `id = '${P1}' and status = 'archived'`), 1);
    assert.equal(await count(asUser(D), "products", `id = '${P1}'`), 1);

    assert.equal((await rows(asUser(D), `update public.products set name = 'Camiseta (arquivada)', featured = false where id = '${P1}' returning 1`)).length, 1);
    assert.equal((await rows(asUser(A), `update public.products set status = 'draft' where id = '${P1}' returning 1`)).length, 1);
    assert.equal((await rows(asSuperuser, `select status from public.products where id = '${P1}'`))[0].status, "draft");
  });

  test("status usa enum (draft por padrão) e rejeita valores inválidos", async () => {
    const id = await newProduct(asUser(A), S1, "padrao");
    assert.equal((await rows(asUser(A), `select status from public.products where id = '${id}'`))[0].status, "draft");
    await fails(asUser(A), `update public.products set status = 'ativo' where id = '${id}'`, "22P02");
  });
});
