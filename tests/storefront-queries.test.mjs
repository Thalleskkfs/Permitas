import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { S1, S2, DENIED, asAnon, asService, setupDatabase } from "../supabase/tests/support/harness.mjs";
import * as reads from "../src/modules/storefront/reads.ts";
import { createClientFactory } from "./support/storefront-client.mjs";

/**
 * Camada de leitura da vitrine, exercitada contra o banco real.
 *
 * As funções de reads.ts recebem o cliente por parâmetro. Aqui esse cliente é um
 * tradutor: a mesma API encadeada do supabase-js (select/eq/order/range/maybeSingle),
 * compilada para SQL e executada no PGlite com as migrations de verdade, sob um papel
 * escolhido. Assim as consultas testadas são exatamente as que rodam em produção —
 * incluindo as colunas que elas pedem.
 *
 * Os dois papéis têm propósitos diferentes:
 *
 *   * `anon` é o visitante. Prova o que a vitrine enxerga e, principalmente, o que ela
 *     não alcança — e prova que nenhuma consulta pede coluna sem privilégio, porque
 *     bastaria uma para a leitura inteira falhar.
 *   * `service_role` IGNORA a RLS. É o papel que revela se o código filtra de verdade:
 *     se `status = 'published'` sumir da consulta, o rascunho aparece aqui. Nenhuma
 *     linha da vitrine usa service_role — ele existe neste arquivo para provar que a
 *     RLS é a segunda linha de defesa, não a primeira.
 */

const S3 = "10000000-0000-0000-0000-000000000003"; // loja DESATIVADA
const S4 = "10000000-0000-0000-0000-000000000004"; // ativa, sem linha em store_settings
const S5 = "10000000-0000-0000-0000-000000000005"; // ativa, com WhatsApp nulo
const CAT_A = "20000000-0000-0000-0000-00000000000a";
const CAT_B = "20000000-0000-0000-0000-00000000000b";
const CAT_OFF = "20000000-0000-0000-0000-00000000000f"; // categoria inativa
const CAT_S2 = "20000000-0000-0000-0000-000000000022";
const CAT_S3 = "20000000-0000-0000-0000-000000000033";

const P1 = "30000000-0000-0000-0000-000000000001"; // "p-01", o produto completo
const DRAFT = "30000000-0000-0000-0000-0000000000d1";
const ARCH = "30000000-0000-0000-0000-0000000000a1";
const HIDDEN_CAT = "30000000-0000-0000-0000-0000000000c1"; // publicado em categoria inativa
const P_S2 = "30000000-0000-0000-0000-000000000202"; // outra loja, MESMO slug
const P_S3 = "30000000-0000-0000-0000-000000000303"; // loja desativada

const EMPATE1 = "30000000-0000-0000-0000-0000000000e1"; // mesmo created_at,
const EMPATE2 = "30000000-0000-0000-0000-0000000000e2"; // inseridos fora
const EMPATE3 = "30000000-0000-0000-0000-0000000000e3"; // da ordem de id

// Nomes com os caracteres que quebram (ou viram curinga) numa busca mal escapada.
const BUSCA_PCT = "30000000-0000-0000-0000-0000000000b1"; // "Desconto 50% off"
const BUSCA_SUB = "30000000-0000-0000-0000-0000000000b2"; // "Kit_praia"
const BUSCA_PAR = "30000000-0000-0000-0000-0000000000b3"; // "Bolsa (couro), preta"
const BUSCA_BAR = "30000000-0000-0000-0000-0000000000b4"; // "Barra \ invertida"

const COL_ON = "50000000-0000-0000-0000-000000000001"; // ativa
const COL_OFF = "50000000-0000-0000-0000-000000000002"; // inativa
const COL_S2 = "50000000-0000-0000-0000-000000000022"; // outra loja, MESMO slug

const TAG1 = "40000000-0000-0000-0000-000000000001";
const TAG2 = "40000000-0000-0000-0000-000000000002";

const seed = `
  insert into public.stores (id, name, slug, active) values
    ('${S3}', 'Loja Off', 'loja-off', false),
    ('${S4}', 'Loja Sem Zap', 'loja-sem-zap', true),
    ('${S5}', 'Loja Zap Nulo', 'loja-zap-nulo', true);

  insert into public.store_settings (store_id, whatsapp_number) values ('${S3}', '+5511999990003');
  -- S4 não tem linha em store_settings; S5 tem a linha com número nulo.
  insert into public.store_settings (store_id, whatsapp_number, whatsapp_message_template)
    values ('${S5}', null, null);

  insert into public.categories (id, store_id, name, slug, active, sort_order) values
    ('${CAT_A}',   '${S1}', 'Acessórios', 'acessorios', true,  1),
    ('${CAT_B}',   '${S1}', 'Casa',       'casa',       true,  0),
    ('${CAT_OFF}', '${S1}', 'Oculta',     'oculta',     false, 2),
    ('${CAT_S2}',  '${S2}', 'Alheia',     'alheia',     true,  0),
    ('${CAT_S3}',  '${S3}', 'Off',        'off',        true,  0);

  -- 10 publicados, do mais novo (p-01) para o mais antigo (p-10).
  insert into public.products
    (id, store_id, category_id, name, slug, price_cents, promotional_price_cents, stock, status, featured, created_at)
  select
    ('30000000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid,
    '${S1}', '${CAT_A}',
    'Produto ' || lpad(i::text, 2, '0'),
    'p-' || lpad(i::text, 2, '0'),
    1000 * i,
    case when i % 2 = 0 then 500 * i end,
    case when i = 9 then 0 else 5 end,
    'published', i <= 2,
    now() - (i || ' minutes')::interval
  from generate_series(1, 10) as i;

  -- Rascunho e arquivado carregam tudo o que faria um produto aparecer: destaque,
  -- preço promocional e a mesma categoria dos publicados.
  insert into public.products
    (id, store_id, category_id, name, slug, price_cents, promotional_price_cents, stock, status, featured) values
    ('${DRAFT}',      '${S1}', '${CAT_A}',   'Rascunho',  'rascunho',  9000, 1000, 5, 'draft',     true),
    ('${ARCH}',       '${S1}', '${CAT_A}',   'Arquivado', 'arquivado', 9000, 1000, 5, 'archived',  true),
    ('${HIDDEN_CAT}', '${S1}', '${CAT_OFF}', 'Oculto',    'oculto',    9000, 1000, 5, 'published', true),
    ('${P_S2}',       '${S2}', '${CAT_S2}',  'Alheio',    'p-01',      9000, 1000, 5, 'published', true),
    ('${P_S3}',       '${S3}', '${CAT_S3}',  'Escondido', 'escondido', 9000, 1000, 5, 'published', true);

  -- Mesmo created_at, inseridos fora da ordem de id: é o que um import em lote produz,
  -- e é onde uma ordenação sem desempate embaralha as páginas.
  insert into public.products
    (id, store_id, category_id, name, slug, price_cents, stock, status, created_at) values
    ('${EMPATE3}', '${S1}', '${CAT_B}', 'Casa C', 'c-c', 1000, 5, 'published', '2026-01-01 10:00:00+00'),
    ('${EMPATE1}', '${S1}', '${CAT_B}', 'Casa A', 'c-a', 1000, 5, 'published', '2026-01-01 10:00:00+00'),
    ('${EMPATE2}', '${S1}', '${CAT_B}', 'Casa B', 'c-b', 1000, 5, 'published', '2026-01-01 10:00:00+00');

  -- Sem categoria, para não mexer nas contagens das categorias.
  insert into public.products (id, store_id, name, slug, price_cents, stock, status) values
    ('${BUSCA_PCT}', '${S1}', 'Desconto 50% off',      'desconto',  1000, 5, 'published'),
    ('${BUSCA_SUB}', '${S1}', 'Kit_praia',             'kit-praia', 1000, 5, 'published'),
    ('${BUSCA_PAR}', '${S1}', 'Bolsa (couro), preta',  'bolsa',     1000, 5, 'published'),
    ('${BUSCA_BAR}', '${S1}', 'Barra \\ invertida',    'barra',     1000, 5, 'published');

  insert into public.collections (id, store_id, name, slug, description, active) values
    ('${COL_ON}',  '${S1}', 'Verão',   'verao',   'Para o calor', true),
    ('${COL_OFF}', '${S1}', 'Inverno', 'inverno', null,           false),
    ('${COL_S2}',  '${S2}', 'Alheia',  'verao',   null,           true);

  -- Posições fora da ordem de inserção e de id; p-05 e p-07 empatam em 3. O rascunho e
  -- o arquivado estão NA coleção ativa: é o vínculo que os revelaria.
  insert into public.collection_products (store_id, collection_id, product_id, position) values
    ('${S1}', '${COL_ON}', '30000000-0000-0000-0000-000000000007', 3),
    ('${S1}', '${COL_ON}', '30000000-0000-0000-0000-000000000003', 2),
    ('${S1}', '${COL_ON}', '${DRAFT}',                              1),
    ('${S1}', '${COL_ON}', '30000000-0000-0000-0000-000000000005', 3),
    ('${S1}', '${COL_ON}', '${P1}',                                 0),
    ('${S1}', '${COL_ON}', '${ARCH}',                               4),
    ('${S1}', '${COL_OFF}', '30000000-0000-0000-0000-000000000002', 0),
    ('${S2}', '${COL_S2}', '${P_S2}',                               0);

  insert into public.product_images (product_id, storage_path, alt_text, position) values
    ('${P1}',    'a/segunda.webp', 'Foto dois',        1),
    ('${P1}',    'a/primeira.webp', 'Foto um',         0),
    ('${P1}',    'a/terceira.webp', null,              2),
    ('${DRAFT}', 'a/rascunho.webp', 'Foto do rascunho', 0);

  insert into public.product_variants
    (store_id, product_id, name, stock, options, active, position) values
    ('${S1}', '${P1}', 'Preto P',     3, '{"cor": "Preto", "tamanho": "P"}',     true,  0),
    ('${S1}', '${P1}', 'Branco M',    0, '{"cor": "Branco", "tamanho": "M"}',    true,  1),
    ('${S1}', '${P1}', 'Vermelho G',  4, '{"cor": "Vermelho", "tamanho": "G"}',  false, 2);

  insert into public.tags (id, store_id, name, slug) values
    ('${TAG1}', '${S1}', 'Novo', 'novo'),
    ('${TAG2}', '${S1}', 'Oferta', 'oferta');

  insert into public.product_tags (store_id, product_id, tag_id) values
    ('${S1}', '${P1}', '${TAG1}'),
    ('${S1}', '${P1}', '${TAG2}'),
    ('${S1}', '${DRAFT}', '${TAG1}');
`;

const { rows } = setupDatabase(seed);

// O tradutor da API do supabase-js para SQL é compartilhado com os demais testes da
// vitrine: uma cópia só, para as imitações do PostgREST não divergirem entre arquivos.
const clientAs = createClientFactory(rows);

const anon = () => clientAs(asAnon);
const service = () => clientAs(asService);

const slugsOf = (cards) => cards.map((card) => card.href.split("/").pop());

// ---------------------------------------------------------------------------
// A vitrine, pelos olhos do visitante
// ---------------------------------------------------------------------------

describe("loja", () => {
  test("loja ativa vem com hero e WhatsApp", async () => {
    const store = await reads.getStore(anon(), "loja-um");

    assert.equal(store?.slug, "loja-um");
    assert.equal(store?.name, "Loja Um");
    assert.deepEqual(store?.hero?.slides, [{ id: S1, title: "Loja Um", subtitle: undefined }]);
    assert.equal(store?.hero?.contactHref, "https://wa.me/5511999990001");
    assert.equal(store?.hero?.contactLabel, "Falar no WhatsApp");
  });

  test("o número e o modelo de mensagem vêm crus, para o carrinho montar a sua", async () => {
    const store = await reads.getStore(anon(), "loja-um");

    assert.equal(store?.whatsappNumber, "+5511999990001", "sem normalizar: é o do banco");
    assert.equal(store?.whatsappMessageTemplate, "Olá, loja 1");
  });

  test("loja sem store_settings ou com número nulo não quebra", async () => {
    const semLinha = await reads.getStore(anon(), "loja-sem-zap");
    assert.equal(semLinha?.whatsappNumber, null);
    assert.equal(semLinha?.whatsappMessageTemplate, null);
    assert.equal(semLinha?.hero?.contactHref, undefined, "sem número, a hero não tem botão");
    assert.equal(semLinha?.name, "Loja Sem Zap");

    const nulo = await reads.getStore(anon(), "loja-zap-nulo");
    assert.equal(nulo?.whatsappNumber, null);
    assert.equal(nulo?.whatsappMessageTemplate, null);
    assert.equal(nulo?.hero?.contactHref, undefined);
  });

  test("loja desativada e slug inexistente devolvem null", async () => {
    assert.equal(await reads.getStore(anon(), "loja-off"), null);
    assert.equal(await reads.getStore(anon(), "nao-existe"), null);
  });
});

describe("categorias", () => {
  test("só as ativas, na ordem de sort_order", async () => {
    const categories = await reads.getCategories(anon(), "loja-um");
    assert.deepEqual(categories, [
      { slug: "casa", name: "Casa" },
      { slug: "acessorios", name: "Acessórios" },
    ]);
  });

  test("categoria inativa, de outra loja ou de loja desativada não resolve", async () => {
    assert.equal(await reads.getCategory(anon(), "loja-um", "oculta"), null);
    assert.equal(await reads.getCategory(anon(), "loja-um", "alheia"), null);
    assert.equal(await reads.getCategory(anon(), "loja-off", "off"), null);
    assert.deepEqual(await reads.getCategories(anon(), "loja-off"), []);
  });

  test("categoria ativa resolve pelo slug", async () => {
    assert.deepEqual(await reads.getCategory(anon(), "loja-um", "acessorios"), {
      slug: "acessorios",
      name: "Acessórios",
    });
  });
});

describe("produtos da categoria, paginados", () => {
  const page = (offset, limit) =>
    reads.getCategoryProducts(anon(), "loja-um", "acessorios", { offset, limit });

  test("o total é o da consulta inteira, não o da página", async () => {
    const first = await page(0, 4);
    assert.equal(first.total, 10, "rascunho e arquivado não entram na conta");
    assert.equal(first.products.length, 4);
  });

  test("as páginas não repetem nem pulam produto", async () => {
    const [first, second, third] = await Promise.all([page(0, 4), page(4, 4), page(8, 4)]);

    assert.deepEqual(slugsOf(first.products), ["p-01", "p-02", "p-03", "p-04"]);
    assert.deepEqual(slugsOf(second.products), ["p-05", "p-06", "p-07", "p-08"]);
    assert.deepEqual(slugsOf(third.products), ["p-09", "p-10"]);

    const all = [...first.products, ...second.products, ...third.products].map((card) => card.href);
    assert.equal(new Set(all).size, 10);
    assert.equal(all.length, first.total);
  });

  test("empate no created_at é desempatado pelo id, e a página não embaralha", async () => {
    const primeira = await reads.getCategoryProducts(anon(), "loja-um", "casa", { offset: 0, limit: 2 });
    const segunda = await reads.getCategoryProducts(anon(), "loja-um", "casa", { offset: 2, limit: 2 });

    assert.equal(primeira.total, 3);
    assert.deepEqual(slugsOf(primeira.products), ["c-a", "c-b"]);
    assert.deepEqual(slugsOf(segunda.products), ["c-c"]);
  });

  test("rascunho e arquivado nunca aparecem", async () => {
    const { products } = await page(0, 50);
    const slugs = slugsOf(products);
    assert.ok(!slugs.includes("rascunho"));
    assert.ok(!slugs.includes("arquivado"));
  });

  test("categoria inativa devolve página vazia, não a loja inteira", async () => {
    assert.deepEqual(await reads.getCategoryProducts(anon(), "loja-um", "oculta", { offset: 0, limit: 8 }), {
      products: [],
      total: 0,
    });
  });

  test("loja desativada devolve página vazia", async () => {
    assert.deepEqual(await reads.getCategoryProducts(anon(), "loja-off", "off", { offset: 0, limit: 8 }), {
      products: [],
      total: 0,
    });
  });

  test("o cartão leva href, preço em centavos e disponibilidade", async () => {
    const { products } = await page(0, 10);
    const [primeiro] = products;

    assert.equal(primeiro.href, "/produto/p-01");
    assert.equal(primeiro.name, "Produto 01");
    assert.equal(primeiro.price, 1000);
    assert.equal(Number.isInteger(primeiro.price), true);
    assert.equal(primeiro.promotionalPrice, undefined);
    assert.equal(primeiro.available, true);
    assert.deepEqual(primeiro.image, { alt: "Foto um" }, "a primeira imagem é a de menor position");

    const segundo = products[1];
    assert.equal(segundo.promotionalPrice, 1000);
    assert.equal(segundo.badge, "Promoção");

    const semEstoque = products.find((card) => card.href.endsWith("p-09"));
    assert.equal(semEstoque.available, false);
  });
});

describe("produto", () => {
  test("traz imagens ordenadas, variantes ativas e tags", async () => {
    const product = await reads.getProduct(anon(), "loja-um", "p-01");

    assert.equal(product?.name, "Produto 01");
    assert.equal(product?.price, 1000);
    assert.equal(product?.featured, true);
    assert.deepEqual(product?.categorySlugs, ["acessorios"]);

    assert.deepEqual(
      product?.images.map((image) => image.alt),
      ["Foto um", "Foto dois", "Produto 01"],
      "sem alt_text, o nome do produto responde pela imagem",
    );

    assert.deepEqual(product?.variants, [
      {
        name: "cor",
        options: [
          { value: "Preto", available: true },
          { value: "Branco", available: false },
        ],
      },
      {
        name: "tamanho",
        options: [
          { value: "P", available: true },
          { value: "M", available: false },
        ],
      },
    ]);

    assert.deepEqual([...(product?.tags ?? [])].sort(), ["Novo", "Oferta"]);
  });

  test("a variante inativa não aparece em opção nenhuma", async () => {
    const product = await reads.getProduct(anon(), "loja-um", "p-01");
    const values = (product?.variants ?? []).flatMap((group) => group.options.map((o) => o.value));

    assert.ok(!values.includes("Vermelho"), "variante inativa vazou");
    assert.ok(!values.includes("G"), "variante inativa vazou");
  });

  test("rascunho, arquivado e produto de loja desativada não existem", async () => {
    assert.equal(await reads.getProduct(anon(), "loja-um", "rascunho"), null);
    assert.equal(await reads.getProduct(anon(), "loja-um", "arquivado"), null);
    assert.equal(await reads.getProduct(anon(), "loja-off", "escondido"), null);
    assert.equal(await reads.getProduct(anon(), "loja-um", "escondido"), null);
  });

  test("o mesmo slug em lojas diferentes devolve o produto da loja pedida", async () => {
    const um = await reads.getProduct(anon(), "loja-um", "p-01");
    const dois = await reads.getProduct(anon(), "loja-dois", "p-01");

    assert.equal(um?.name, "Produto 01");
    assert.equal(dois?.name, "Alheio");
  });
});

describe("destaques e promoções", () => {
  // "oculto" é publicado e está numa categoria inativa. Ele aparece: desativar a
  // categoria tira a navegação, não a publicação do produto — é o mesmo recorte que a
  // policy do banco faz. Quem quer sumir com o produto o despublica.
  test("destaque é só o publicado da própria loja", async () => {
    const cards = await reads.getFeaturedProducts(anon(), "loja-um", 10);
    assert.deepEqual(slugsOf(cards), ["oculto", "p-01", "p-02"], "rascunho e loja alheia ficam de fora");
  });

  test("promoção é o que tem preço promocional, e o rascunho tem um", async () => {
    const cards = await reads.getPromotionalProducts(anon(), "loja-um", 10);
    assert.deepEqual(slugsOf(cards), ["oculto", "p-02", "p-04", "p-06", "p-08", "p-10"]);
    assert.ok(cards.every((card) => Number.isInteger(card.promotionalPrice)));
  });

  test("o limite é respeitado", async () => {
    assert.equal((await reads.getFeaturedProducts(anon(), "loja-um", 1)).length, 1);
    assert.equal((await reads.getPromotionalProducts(anon(), "loja-um", 2)).length, 2);
  });

  test("loja desativada não tem destaque nem promoção", async () => {
    assert.deepEqual(await reads.getFeaturedProducts(anon(), "loja-off", 10), []);
    assert.deepEqual(await reads.getPromotionalProducts(anon(), "loja-off", 10), []);
  });
});

describe("relacionados", () => {
  test("mesma categoria, menos o próprio produto", async () => {
    const product = await reads.getProduct(anon(), "loja-um", "p-01");
    const cards = await reads.getRelatedProducts(anon(), "loja-um", product, 3);

    assert.deepEqual(slugsOf(cards), ["p-02", "p-03", "p-04"]);
  });

  test("produto sem categoria não tem relacionados", async () => {
    const product = await reads.getProduct(anon(), "loja-um", "p-01");
    const cards = await reads.getRelatedProducts(anon(), "loja-um", { ...product, categorySlugs: [] }, 3);

    assert.deepEqual(cards, []);
  });
});

describe("todos os produtos, paginados", () => {
  const page = (offset, limit) => reads.getAllProducts(anon(), "loja-um", { offset, limit });

  test("o total é o de publicados da loja: nem rascunho, nem arquivado, nem outra loja", async () => {
    const { total } = await page(0, 5);
    assert.equal(total, 18, "10 + 3 da casa + 4 da busca + o da categoria inativa");
  });

  test("as páginas não repetem nem pulam produto", async () => {
    const tamanho = 5;
    const { total } = await page(0, tamanho);
    const paginas = await Promise.all(
      Array.from({ length: Math.ceil(total / tamanho) }, (_, i) => page(i * tamanho, tamanho)),
    );

    const slugs = paginas.flatMap((p) => slugsOf(p.products));
    assert.equal(slugs.length, total, "a soma das páginas é o total");
    assert.equal(new Set(slugs).size, total, "nenhum produto aparece duas vezes");
    assert.ok(paginas.slice(0, -1).every((p) => p.products.length === tamanho));

    const todos = slugsOf((await page(0, 100)).products);
    assert.deepEqual(slugs, todos, "paginar dá a mesma sequência que ler tudo de uma vez");
    for (const fora of ["rascunho", "arquivado", "escondido"]) assert.ok(!todos.includes(fora));
  });

  test("página além da última volta vazia, com o total certo", async () => {
    assert.deepEqual(await page(100, 5), { products: [], total: 18 });
  });

  test("loja desativada devolve página vazia", async () => {
    assert.deepEqual(await reads.getAllProducts(anon(), "loja-off", { offset: 0, limit: 8 }), {
      products: [],
      total: 0,
    });
  });
});

describe("busca", () => {
  const busca = (termo, loja = "loja-um") =>
    reads.searchProducts(anon(), loja, termo, { offset: 0, limit: 50 });

  test("encontra pelo nome, sem diferenciar maiúsculas", async () => {
    const { products, total } = await busca("produto 0");
    assert.equal(total, 9);
    assert.deepEqual(slugsOf(products).slice(0, 2), ["p-01", "p-02"]);

    assert.deepEqual(slugsOf((await busca("CASA B")).products), ["c-b"]);
  });

  test("não traz rascunho, arquivado, produto de outra loja nem de loja desativada", async () => {
    assert.deepEqual(await busca("rascunho"), { products: [], total: 0 });
    assert.deepEqual(await busca("arquivado"), { products: [], total: 0 });
    assert.deepEqual(await busca("alheio"), { products: [], total: 0 }, "é da loja dois");
    assert.deepEqual(await busca("escondido", "loja-off"), { products: [], total: 0 });

    const daLojaDois = await busca("alheio", "loja-dois");
    assert.deepEqual(slugsOf(daLojaDois.products), ["p-01"]);
  });

  test("`%` e `_` são literais, não curingas", async () => {
    assert.deepEqual(slugsOf((await busca("%")).products), ["desconto"], "`%` não devolve tudo");
    assert.deepEqual(slugsOf((await busca("50%")).products), ["desconto"]);
    assert.deepEqual(slugsOf((await busca("_")).products), ["kit-praia"], "`_` não casa qualquer letra");
    assert.deepEqual(await busca("produto_01"), { products: [], total: 0 });
  });

  test("a barra invertida é literal", async () => {
    assert.deepEqual(slugsOf((await busca("\\")).products), ["barra"]);
  });

  test("vírgula e parêntese não quebram o filtro", async () => {
    assert.deepEqual(slugsOf((await busca("(couro),")).products), ["bolsa"]);
    assert.deepEqual(slugsOf((await busca("bolsa (couro), preta")).products), ["bolsa"]);
    assert.deepEqual(await busca("name.eq.x),or(id.neq.0"), { products: [], total: 0 });
  });

  test("`*` não vira curinga", async () => {
    assert.deepEqual(await busca("*"), { products: [], total: 0 });
    assert.deepEqual(slugsOf((await busca("kit*")).products), ["kit-praia"]);
  });

  test("termo vazio ou só com espaços não consulta o banco", async () => {
    const semBanco = {
      from() {
        throw new Error("não deveria consultar");
      },
    };
    for (const termo of ["", "   ", "\n\t"]) {
      assert.deepEqual(
        await reads.searchProducts(semBanco, "loja-um", termo, { offset: 0, limit: 8 }),
        { products: [], total: 0 },
      );
    }
  });

  test("o termo é aparado, colapsado e limitado a 100 caracteres", () => {
    assert.equal(reads.normalizeSearchTerm("  kit   praia "), "kit praia");
    assert.equal(reads.normalizeSearchTerm("a".repeat(500)).length, reads.SEARCH_TERM_MAX_LENGTH);
    assert.equal(reads.SEARCH_TERM_MAX_LENGTH, 100);
    assert.equal(reads.escapeLikePattern("50%_\\"), "50\\%\\_\\\\");
  });

  test("a busca pagina com o total da consulta inteira", async () => {
    const primeira = await reads.searchProducts(anon(), "loja-um", "produto", { offset: 0, limit: 4 });
    const terceira = await reads.searchProducts(anon(), "loja-um", "produto", { offset: 8, limit: 4 });
    assert.equal(primeira.total, 10);
    assert.deepEqual(slugsOf(terceira.products), ["p-09", "p-10"]);
  });
});

describe("coleções", () => {
  const produtos = (slug, offset = 0, limit = 50, loja = "loja-um") =>
    reads.getCollectionProducts(anon(), loja, slug, { offset, limit });

  test("coleção ativa resolve pelo slug, com descrição", async () => {
    assert.deepEqual(await reads.getCollection(anon(), "loja-um", "verao"), {
      slug: "verao",
      name: "Verão",
      description: "Para o calor",
    });
  });

  test("coleção inativa não aparece, nem os produtos dela", async () => {
    assert.equal(await reads.getCollection(anon(), "loja-um", "inverno"), null);
    assert.deepEqual(await produtos("inverno"), { products: [], total: 0 });
  });

  test("o mesmo slug em outra loja devolve a coleção da loja pedida", async () => {
    assert.equal((await reads.getCollection(anon(), "loja-dois", "verao"))?.name, "Alheia");
    assert.deepEqual(slugsOf((await produtos("verao", 0, 50, "loja-dois")).products), ["p-01"]);
    assert.equal(await reads.getCollection(anon(), "loja-off", "verao"), null);
  });

  test("segue a position, desempata pelo id e deixa de fora o não publicado", async () => {
    const { products, total } = await produtos("verao");

    assert.deepEqual(slugsOf(products), ["p-01", "p-03", "p-05", "p-07"]);
    assert.equal(total, 4, "rascunho e arquivado vinculados não contam");
  });

  test("pagina sem repetir nem pular", async () => {
    const [a, b, c] = await Promise.all([
      produtos("verao", 0, 2),
      produtos("verao", 2, 2),
      produtos("verao", 4, 2),
    ]);

    assert.deepEqual(slugsOf(a.products), ["p-01", "p-03"]);
    assert.deepEqual(slugsOf(b.products), ["p-05", "p-07"]);
    assert.deepEqual(c, { products: [], total: 4 });
  });

  test("o cartão da coleção é o mesmo da listagem", async () => {
    const [primeiro] = (await produtos("verao")).products;
    assert.equal(primeiro.href, "/produto/p-01");
    assert.deepEqual(primeiro.image, { alt: "Foto um" });
  });
});

describe("página além da última (PGRST103 do PostgREST)", () => {
  const erro = (code, message) => ({ data: null, count: null, error: { code, message } });

  test("o range fora do fim vira página vazia com o total real, vindo da contagem", async () => {
    let contou = 0;
    const page = await reads.readPage(
      async () => erro("PGRST103", "Requested range not satisfiable"),
      async () => {
        contou += 1;
        return { data: null, count: 7, error: null };
      },
      "Falha",
    );

    assert.deepEqual(page, { rows: [], total: 7 });
    assert.equal(contou, 1);
  });

  test("qualquer outro erro continua lançando, sem contar", async () => {
    let contou = 0;
    await assert.rejects(
      reads.readPage(
        async () => erro("42501", "permission denied for table products"),
        async () => {
          contou += 1;
          return { data: null, count: 7, error: null };
        },
        "Falha ao listar",
      ),
      /Falha ao listar: permission denied/,
    );
    assert.equal(contou, 0);
  });

  test("erro na contagem também lança", async () => {
    await assert.rejects(
      reads.readPage(
        async () => erro("PGRST103", "Requested range not satisfiable"),
        async () => erro("57014", "canceling statement"),
        "Falha",
      ),
      /canceling statement/,
    );
  });

  test("todas as listagens paginadas devolvem página vazia com o total, sem lançar", async () => {
    const longe = { offset: 800, limit: 8 };

    assert.deepEqual(await reads.getCategoryProducts(anon(), "loja-um", "acessorios", longe), {
      products: [],
      total: 10,
    });
    assert.deepEqual(await reads.getAllProducts(anon(), "loja-um", longe), { products: [], total: 18 });
    assert.deepEqual(await reads.searchProducts(anon(), "loja-um", "produto", longe), {
      products: [],
      total: 10,
    });
    assert.deepEqual(await reads.getCollectionProducts(anon(), "loja-um", "verao", longe), {
      products: [],
      total: 4,
    });
  });
});

// ---------------------------------------------------------------------------
// Os limites do papel anon
// ---------------------------------------------------------------------------

describe("privilégios de coluna", () => {
  test("toda leitura da vitrine roda inteira com o papel anon", async () => {
    // Bastaria UMA coluna sem privilégio para a consulta inteira falhar, e as funções
    // lançam quando isso acontece. Que nenhuma lance é a prova do respeito ao grant.
    const product = await reads.getProduct(anon(), "loja-um", "p-01");

    await reads.getStore(anon(), "loja-um");
    await reads.getCategories(anon(), "loja-um");
    await reads.getCategory(anon(), "loja-um", "acessorios");
    await reads.getCategoryProducts(anon(), "loja-um", "acessorios", { offset: 0, limit: 4 });
    await reads.getFeaturedProducts(anon(), "loja-um", 4);
    await reads.getPromotionalProducts(anon(), "loja-um", 4);
    await reads.getRelatedProducts(anon(), "loja-um", product, 4);
    await reads.getAllProducts(anon(), "loja-um", { offset: 0, limit: 4 });
    await reads.searchProducts(anon(), "loja-um", "produto", { offset: 0, limit: 4 });
    await reads.getCollection(anon(), "loja-um", "verao");
    await reads.getCollectionProducts(anon(), "loja-um", "verao", { offset: 0, limit: 4 });
  });

  test("pedir `sku` derruba a consulta com erro de permissão", async () => {
    const { data, error } = await anon()
      .from("products")
      .select("id, slug, sku")
      .eq("store_id", S1)
      .eq("status", "published");

    assert.equal(data, null);
    assert.match(error.message, DENIED, "sku não é concedido a anon: é o limite da vitrine");
  });

  test("`updated_at` também está fora do alcance", async () => {
    const { error } = await anon().from("products").select("id, updated_at").eq("store_id", S1);
    assert.match(error.message, DENIED);
  });

  test("uma coluna negada dentro de um embutido derruba a mesma consulta", async () => {
    const { error } = await anon()
      .from("products")
      .select("id, product_variants(name, sku)")
      .eq("store_id", S1);

    assert.match(error.message, DENIED);
  });
});

// ---------------------------------------------------------------------------
// Sem a RLS por baixo: o que sobra é o filtro do código
// ---------------------------------------------------------------------------

describe("os filtros do código se sustentam sem a RLS", () => {
  test("service_role enxerga tudo no banco — é a premissa deste bloco", async () => {
    const todos = await rows(asService, `select count(*)::int as total from public.products`);
    assert.equal(
      todos[0].total,
      22,
      "10 publicados + 3 empatados + 4 da busca + rascunho + arquivado + oculto + 2 de outras lojas",
    );
  });

  test("rascunho e arquivado continuam fora da categoria", async () => {
    const { products, total } = await reads.getCategoryProducts(service(), "loja-um", "acessorios", {
      offset: 0,
      limit: 50,
    });

    assert.equal(total, 10, "sem o filtro de status, rascunho e arquivado entrariam");
    const slugs = slugsOf(products);
    assert.ok(!slugs.includes("rascunho"));
    assert.ok(!slugs.includes("arquivado"));
  });

  test("rascunho e arquivado continuam sem página de produto", async () => {
    assert.equal(await reads.getProduct(service(), "loja-um", "rascunho"), null);
    assert.equal(await reads.getProduct(service(), "loja-um", "arquivado"), null);
  });

  test("a loja desativada continua invisível", async () => {
    assert.equal(await reads.getStore(service(), "loja-off"), null);
    assert.equal(await reads.getProduct(service(), "loja-off", "escondido"), null);
    assert.deepEqual(await reads.getFeaturedProducts(service(), "loja-off", 10), []);
  });

  test("a categoria inativa continua fora da navegação e da listagem", async () => {
    const categories = await reads.getCategories(service(), "loja-um");
    assert.deepEqual(
      categories.map((category) => category.slug),
      ["casa", "acessorios"],
    );

    assert.equal(await reads.getCategory(service(), "loja-um", "oculta"), null);
    assert.equal(
      (await reads.getCategoryProducts(service(), "loja-um", "oculta", { offset: 0, limit: 8 })).total,
      0,
    );
  });

  test("a variante inativa continua fora das opções", async () => {
    const product = await reads.getProduct(service(), "loja-um", "p-01");
    const values = (product?.variants ?? []).flatMap((group) => group.options.map((o) => o.value));

    assert.ok(!values.includes("Vermelho"), "sem o filtro de active, a variante desligada apareceria");
  });

  test("uma loja não lê o catálogo da outra", async () => {
    const destaques = await reads.getFeaturedProducts(service(), "loja-um", 10);
    assert.deepEqual(
      slugsOf(destaques),
      ["oculto", "p-01", "p-02"],
      "o 'p-01' em destaque da loja dois não entra",
    );

    const produto = await reads.getProduct(service(), "loja-dois", "p-01");
    assert.equal(produto?.name, "Alheio");
  });

  test("o produto publicado em categoria inativa não vira relacionado", async () => {
    const product = await reads.getProduct(service(), "loja-um", "p-01");
    const cards = await reads.getRelatedProducts(service(), "loja-um", product, 50);

    assert.ok(!slugsOf(cards).includes("oculto"));
    assert.ok(!slugsOf(cards).includes("p-01"), "o próprio produto nunca é relacionado dele mesmo");
  });

  test("a busca não sai da loja nem traz rascunho", async () => {
    const busca = (termo) => reads.searchProducts(service(), "loja-um", termo, { offset: 0, limit: 50 });

    assert.deepEqual(await busca("alheio"), { products: [], total: 0 }, "sem o filtro de loja, viria");
    assert.deepEqual(await busca("rascunho"), { products: [], total: 0 });
    assert.deepEqual(await busca("arquivado"), { products: [], total: 0 });
  });

  test("todos os produtos continua só com os publicados da loja", async () => {
    const { total } = await reads.getAllProducts(service(), "loja-um", { offset: 0, limit: 50 });
    assert.equal(total, 18);
  });

  test("a coleção inativa continua fora", async () => {
    assert.equal(await reads.getCollection(service(), "loja-um", "inverno"), null);
    assert.deepEqual(
      await reads.getCollectionProducts(service(), "loja-um", "inverno", { offset: 0, limit: 50 }),
      { products: [], total: 0 },
    );
  });

  test("o rascunho vinculado à coleção ativa continua fora", async () => {
    const { products, total } = await reads.getCollectionProducts(service(), "loja-um", "verao", {
      offset: 0,
      limit: 50,
    });

    assert.deepEqual(slugsOf(products), ["p-01", "p-03", "p-05", "p-07"]);
    assert.equal(total, 4);
  });
});
