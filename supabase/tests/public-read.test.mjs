import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { A, C, D, S1, DENIED, RLS, asAnon, asService, asSuperuser, asUser, setupDatabase } from "./support/harness.mjs";

/**
 * Leitura pública do catálogo.
 *
 * A vitrine não tem login: quem consulta é o papel `anon`. Estes testes provam os dois
 * lados da regra — o que o visitante PRECISA enxergar e, principalmente, o que ele nunca
 * pode alcançar: rascunho, arquivado, loja desativada, dados administrativos e escrita.
 */

const S3 = "10000000-0000-0000-0000-000000000003"; // loja DESATIVADA
const CAT_PUB = "20000000-0000-0000-0000-000000000001";
const CAT_OFF = "20000000-0000-0000-0000-000000000002"; // categoria inativa
const COL_PUB = "50000000-0000-0000-0000-000000000001";
const COL_OFF = "50000000-0000-0000-0000-000000000002"; // coleção inativa
const TAG1 = "40000000-0000-0000-0000-000000000001";

const PUB = "30000000-0000-0000-0000-000000000001"; // publicado, loja ativa
const DRAFT = "30000000-0000-0000-0000-000000000002"; // rascunho
const ARCH = "30000000-0000-0000-0000-000000000003"; // arquivado
const HIDDEN = "30000000-0000-0000-0000-000000000004"; // publicado, mas loja desativada

const seed = `
  insert into public.stores (id, name, slug, active) values ('${S3}', 'Loja Off', 'loja-off', false);
  insert into public.store_settings (store_id, whatsapp_number) values ('${S3}', '+5511999990003');

  insert into public.categories (id, store_id, name, slug, active) values
    ('${CAT_PUB}', '${S1}', 'Visivel', 'visivel', true),
    ('${CAT_OFF}', '${S1}', 'Oculta', 'oculta', false);

  insert into public.collections (id, store_id, name, slug, active) values
    ('${COL_PUB}', '${S1}', 'Destaques', 'destaques', true),
    ('${COL_OFF}', '${S1}', 'Guardada', 'guardada', false);

  insert into public.tags (id, store_id, name, slug) values ('${TAG1}', '${S1}', 'Novo', 'novo');

  insert into public.products (id, store_id, category_id, name, slug, sku, price_cents, stock, status) values
    ('${PUB}',    '${S1}', '${CAT_PUB}', 'Publicado', 'publicado', 'SKU-PUB', 5000, 3, 'published'),
    ('${DRAFT}',  '${S1}', '${CAT_PUB}', 'Rascunho',  'rascunho',  'SKU-DRA', 5000, 3, 'draft'),
    ('${ARCH}',   '${S1}', '${CAT_PUB}', 'Arquivado', 'arquivado', 'SKU-ARC', 5000, 3, 'archived'),
    ('${HIDDEN}', '${S3}', null,         'Escondido', 'escondido', 'SKU-HID', 5000, 3, 'published');

  insert into public.product_images (product_id, storage_path, alt_text, position) values
    ('${PUB}',   '${S1}/${PUB}/a.webp',    'Foto publicada', 0),
    ('${DRAFT}', '${S1}/${DRAFT}/a.webp',  'Foto rascunho',  0);

  insert into public.product_variants (store_id, product_id, name, stock, active) values
    ('${S1}', '${PUB}', 'Variante ativa', 2, true),
    ('${S1}', '${PUB}', 'Variante inativa', 2, false),
    ('${S1}', '${DRAFT}', 'Variante de rascunho', 2, true);

  insert into public.product_tags (store_id, product_id, tag_id) values
    ('${S1}', '${PUB}', '${TAG1}'), ('${S1}', '${DRAFT}', '${TAG1}');

  insert into public.collection_products (store_id, collection_id, product_id, position) values
    ('${S1}', '${COL_PUB}', '${PUB}', 0),
    ('${S1}', '${COL_PUB}', '${DRAFT}', 1),
    ('${S1}', '${COL_OFF}', '${PUB}', 0);
`;

const { run, rows, fails } = setupDatabase(seed);

const slugs = async (actor, table, columns = "slug") =>
  (await rows(actor, `select ${columns} from public.${table} order by 1`)).map((r) => r.slug);

describe("a vitrine enxerga o que está publicado", () => {
  test("produto publicado de loja ativa aparece", async () => {
    assert.deepEqual(await slugs(asAnon, "products"), ["publicado"]);
  });

  test("loja ativa aparece; loja desativada não", async () => {
    assert.deepEqual(await slugs(asAnon, "stores"), ["loja-dois", "loja-um"]);
  });

  test("o canal de WhatsApp da loja ativa é alcançável", async () => {
    const found = await rows(
      asAnon,
      `select whatsapp_number, whatsapp_message_template from public.store_settings where store_id = '${S1}'`,
    );
    assert.equal(found.length, 1);
    assert.equal(found[0].whatsapp_number, "+5511999990001");
    assert.equal(found[0].whatsapp_message_template, "Olá, loja 1");
  });

  test("categorias e coleções ativas aparecem; inativas não", async () => {
    assert.deepEqual(await slugs(asAnon, "categories"), ["visivel"]);
    assert.deepEqual(await slugs(asAnon, "collections"), ["destaques"]);
  });

  test("imagens, variantes ativas e tags do produto publicado aparecem", async () => {
    const images = await rows(asAnon, `select alt_text from public.product_images`);
    assert.deepEqual(images.map((r) => r.alt_text), ["Foto publicada"]);

    const variants = await rows(asAnon, `select name from public.product_variants`);
    assert.deepEqual(variants.map((r) => r.name), ["Variante ativa"]);

    const links = await rows(asAnon, `select product_id from public.product_tags`);
    assert.deepEqual(links.map((r) => r.product_id), [PUB]);
  });

  test("a coleção ativa lista só o produto publicado", async () => {
    const links = await rows(asAnon, `select collection_id, product_id from public.collection_products`);
    assert.deepEqual(links, [{ collection_id: COL_PUB, product_id: PUB }]);
  });
});

describe("nada de rascunho, arquivado ou loja desativada vaza", () => {
  test("rascunho e arquivado são invisíveis, mesmo consultados pelo id", async () => {
    for (const id of [DRAFT, ARCH]) {
      assert.deepEqual(await rows(asAnon, `select id from public.products where id = '${id}'`), []);
    }
  });

  test("produto publicado de loja desativada é invisível", async () => {
    assert.deepEqual(await rows(asAnon, `select id from public.products where id = '${HIDDEN}'`), []);
    assert.deepEqual(await rows(asAnon, `select id from public.stores where id = '${S3}'`), []);
    assert.deepEqual(await rows(asAnon, `select store_id from public.store_settings where store_id = '${S3}'`), []);
  });

  test("os satélites do rascunho também somem", async () => {
    assert.deepEqual(await rows(asAnon, `select id from public.product_images where product_id = '${DRAFT}'`), []);
    assert.deepEqual(await rows(asAnon, `select id from public.product_variants where product_id = '${DRAFT}'`), []);
    assert.deepEqual(await rows(asAnon, `select tag_id from public.product_tags where product_id = '${DRAFT}'`), []);
    assert.deepEqual(
      await rows(asAnon, `select product_id from public.collection_products where product_id = '${DRAFT}'`),
      [],
      "o vínculo revelaria a existência do rascunho",
    );
  });

  test("variante inativa não aparece", async () => {
    const names = await rows(asAnon, `select name from public.product_variants where active = false`);
    assert.deepEqual(names, []);
  });

  test("despublicar um produto o remove da vitrine na hora", async () => {
    assert.equal((await rows(asAnon, `select id from public.products`)).length, 1);
    await run(asService, `update public.products set status = 'draft' where id = '${PUB}'`);
    assert.deepEqual(await rows(asAnon, `select id from public.products`), []);
  });

  test("desativar a loja apaga a vitrine inteira", async () => {
    await run(asService, `update public.stores set active = false where id = '${S1}'`);
    for (const table of ["products", "categories", "collections", "tags", "product_variants", "product_images"]) {
      assert.deepEqual(await rows(asAnon, `select 1 from public.${table}`), [], table);
    }
  });
});

describe("dados administrativos continuam fora do alcance", () => {
  test("anon não lê profiles, store_members nem store_domains", async () => {
    for (const table of ["profiles", "store_members", "store_domains"]) {
      await fails(asAnon, `select * from public.${table}`, DENIED);
    }
  });

  test("colunas internas não foram concedidas", async () => {
    await fails(asAnon, `select sku from public.products`, DENIED);
    await fails(asAnon, `select sku from public.product_variants`, DENIED);
    await fails(asAnon, `select updated_at from public.products`, DENIED);
  });

  test("a vitrine é estritamente de leitura", async () => {
    await fails(
      asAnon,
      `insert into public.products (store_id, name, slug, price_cents) values ('${S1}', 'x', 'x', 100)`,
      DENIED,
    );
    await fails(asAnon, `update public.products set name = 'x' where id = '${PUB}'`, DENIED);
    await fails(asAnon, `delete from public.products where id = '${PUB}'`, DENIED);
    await fails(asAnon, `update public.stores set active = true where id = '${S3}'`, DENIED);
  });

  test("anon não executa as funções auxiliares diretamente", async () => {
    await fails(asAnon, `select private.is_public_store('${S1}')`, DENIED);
    await fails(asAnon, `select private.is_store_member('${S1}')`, DENIED);
  });

  test("anon não enxerga objeto algum do Storage", async () => {
    // O bucket é privado e não tem policy: a RLS devolve vazio em vez de erro.
    await run(asService, `insert into storage.objects (bucket_id, name) values ('catalog-images', '${S1}/${PUB}/a.webp')`);
    assert.deepEqual(await rows(asAnon, `select name from storage.objects`), []);
    assert.deepEqual(await rows(asAnon, `select id from storage.buckets`), []);
  });
});

describe("o painel não foi afetado", () => {
  test("membro continua vendo o rascunho da própria loja", async () => {
    const seen = await rows(asUser(A), `select slug from public.products order by slug`);
    assert.deepEqual(seen.map((r) => r.slug), ["arquivado", "publicado", "rascunho"]);
    assert.deepEqual(await slugs(asUser(D), "categories"), ["oculta", "visivel"]);
  });

  test("membro de uma loja não passa a ver nada de outra", async () => {
    // B é membro da loja 2; todo o catálogo do seed está na loja 1. Antes de restringir
    // as policies públicas a anon, ele enxergava o produto publicado da loja alheia.
    const seen = await rows(
      asUser("00000000-0000-0000-0000-00000000000b"),
      `select slug from public.products order by slug`,
    );
    assert.deepEqual(seen, [], "nem o publicado da loja alheia");
  });

  test("a leitura pública não vaza para quem está logado", async () => {
    // As policies públicas valem só para anon. Se um dia alguém as estender a
    // authenticated, o isolamento de leitura entre lojas cai para todo o painel: este
    // teste é o que impede isso de passar despercebido.
    //
    // A vitrine não depende disso porque lê com um cliente sem sessão, ou seja, como anon.
    for (const table of ["stores", "products", "categories", "collections", "store_settings"]) {
      assert.deepEqual(await rows(asUser(C), `select 1 from public.${table}`), [], table);
    }
  });

  test("escrita continua exigindo vínculo", async () => {
    await fails(
      asUser(C),
      `insert into public.products (store_id, name, slug, price_cents) values ('${S1}', 'x', 'invasor', 100)`,
      RLS,
    );
  });

  test("todas as tabelas de public seguem com RLS ativo", async () => {
    const unprotected = await rows(
      asSuperuser,
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    );
    assert.deepEqual(unprotected, []);
  });

  test("nenhuma tabela dá SELECT de tabela inteira ao anon, só por coluna", async () => {
    // Tabela nova em `public` nasce, no Supabase, com privilégio total para anon. Quem
    // esquece o `revoke all` logo após o `create table` expõe todas as colunas, mesmo
    // concedendo depois coluna por coluna. Isto pega esse esquecimento em qualquer
    // tabela futura.
    const inteiras = await rows(
      asSuperuser,
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'
         and has_table_privilege('anon', c.oid, 'SELECT')`,
    );
    assert.deepEqual(inteiras, []);
  });

  test("anon não tem privilégio de escrita em nenhuma tabela", async () => {
    // Pelo oid, e não montando o nome como texto: o planejador pode avaliar a função
    // antes do filtro de schema e tentar resolver uma tabela de outro schema.
    const writable = await rows(
      asSuperuser,
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'
         and (has_table_privilege('anon', c.oid, 'INSERT')
           or has_table_privilege('anon', c.oid, 'UPDATE')
           or has_table_privilege('anon', c.oid, 'DELETE'))`,
    );
    assert.deepEqual(writable, []);
  });
});
