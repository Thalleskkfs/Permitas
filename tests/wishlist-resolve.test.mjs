import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { S1, S2, asAnon, asService, setupDatabase } from "../supabase/tests/support/harness.mjs";
import { createClientFactory } from "./support/storefront-client.mjs";
import { wishlistItemKey } from "../src/modules/storefront/wishlist.ts";
import { resolveWishlistWith } from "../src/modules/storefront/wishlist-resolve.ts";

/**
 * Resolução da lista de interesse contra o banco real (PGlite + migrations).
 *
 * A Server Action `resolveWishlist` é só `resolveWishlistWith(createPublicClient(), …)`;
 * aqui o cliente é o tradutor de testes, sob o papel escolhido. Os casos rodam com
 * `anon` (o visitante) e com `service_role`, que IGNORA a RLS: é ele que prova que os
 * filtros de loja e de publicado estão no código, e não só na policy.
 */

const S3 = "10000000-0000-0000-0000-000000000003"; // loja desativada

const CAMISETA = "30000000-0000-0000-0000-000000000001";
const CANECA = "30000000-0000-0000-0000-000000000002";
const ESGOTADO = "30000000-0000-0000-0000-000000000003";
const DRAFT = "30000000-0000-0000-0000-0000000000d1";
const ARCH = "30000000-0000-0000-0000-0000000000a1";
const CANECA_S2 = "30000000-0000-0000-0000-000000000202";
const ALHEIO = "30000000-0000-0000-0000-000000000203";
const OFF = "30000000-0000-0000-0000-000000000303";

const seed = `
  insert into public.stores (id, name, slug, active) values ('${S3}', 'Loja Off', 'loja-off', false);

  insert into public.products
    (id, store_id, name, slug, price_cents, promotional_price_cents, stock, status) values
    ('${CAMISETA}',  '${S1}', 'Camiseta',  'camiseta',  5000, 4000, 5, 'published'),
    ('${CANECA}',    '${S1}', 'Caneca',    'caneca',    2500, null, 5, 'published'),
    ('${ESGOTADO}',  '${S1}', 'Esgotado',  'esgotado',  1000, null, 0, 'published'),
    ('${DRAFT}',     '${S1}', 'Rascunho',  'rascunho',   100, null, 5, 'draft'),
    ('${ARCH}',      '${S1}', 'Arquivado', 'arquivado',  100, null, 5, 'archived'),
    ('${CANECA_S2}', '${S2}', 'Caneca 2',  'caneca',       1, null, 5, 'published'),
    ('${ALHEIO}',    '${S2}', 'Alheio',    'alheio',     100, null, 5, 'published'),
    ('${OFF}',       '${S3}', 'Escondido', 'escondido',  100, null, 5, 'published');

  insert into public.product_images (product_id, storage_path, alt_text, position) values
    ('${CAMISETA}', 'a/2.webp', 'Costas', 1),
    ('${CAMISETA}', 'a/1.webp', 'Frente', 0);

  -- Tamanho G só existe numa variante INATIVA; Branco M está sem estoque.
  insert into public.product_variants
    (store_id, product_id, name, stock, options, active, position) values
    ('${S1}', '${CAMISETA}', 'Preto P',  3, '{"cor": "Preto", "tamanho": "P"}',  true,  0),
    ('${S1}', '${CAMISETA}', 'Branco M', 0, '{"cor": "Branco", "tamanho": "M"}', true,  1),
    ('${S1}', '${CAMISETA}', 'Preto G',  4, '{"cor": "Preto", "tamanho": "G"}',  false, 2);
`;

const { rows } = setupDatabase(seed);
const clientAs = createClientFactory(rows);
const anon = () => clientAs(asAnon);
const service = () => clientAs(asService);

const entry = (product, quantity = 1, options = {}) => ({ product, options, quantity });
const resolve = (client, storeSlug, items) => resolveWishlistWith(client, { storeSlug, items });

const ACTORS = [
  ["anon", anon],
  ["service_role", service],
];

describe("dados atuais do banco", () => {
  test("preço, nome, link e imagem vêm do banco", async () => {
    const result = await resolve(anon(), "loja-um", [entry("caneca", 2)]);

    assert.deepEqual(result, {
      ok: true,
      items: [
        {
          key: wishlistItemKey(entry("caneca")),
          name: "Caneca",
          href: "/produto/caneca",
          unitPrice: 2500,
          originalPrice: undefined,
          available: true,
          variantLabel: undefined,
          image: undefined,
        },
      ],
      removed: [],
    });
  });

  test("promoção: o preço vigente é o promocional, com o cheio ao lado", async () => {
    const options = { cor: "Preto", tamanho: "P" };
    const result = await resolve(anon(), "loja-um", [entry("camiseta", 1, options)]);

    assert.equal(result.ok, true);
    const [item] = result.items;
    assert.equal(item.unitPrice, 4000);
    assert.equal(item.originalPrice, 5000);
    assert.equal(item.variantLabel, "cor Preto · tamanho P");
    assert.deepEqual(item.image, { alt: "Frente" });
    assert.equal(item.available, true);
  });

  test("preço enviado pelo navegador é recusado, não aproveitado", async () => {
    const tampered = [{ ...entry("caneca", 1), unitPrice: 1 }];
    assert.deepEqual(await resolve(anon(), "loja-um", tampered), {
      ok: false,
      error: "invalid-input",
    });
  });

  test("mesmo slug em outra loja não vaza preço", async () => {
    const um = await resolve(anon(), "loja-um", [entry("caneca")]);
    const dois = await resolve(anon(), "loja-dois", [entry("caneca")]);

    assert.equal(um.items[0].unitPrice, 2500);
    assert.equal(dois.items[0].unitPrice, 1);
    assert.equal(dois.items[0].href, "/produto/caneca");
  });

  test("sem estoque continua na lista, marcado como indisponível", async () => {
    const result = await resolve(anon(), "loja-um", [
      entry("esgotado"),
      entry("camiseta", 1, { cor: "Branco", tamanho: "M" }),
    ]);

    assert.deepEqual(
      result.items.map((item) => [item.name, item.available]),
      [
        ["Esgotado", false],
        ["Camiseta", false],
      ],
    );
    assert.deepEqual(result.removed, []);
  });

  test("a ordem da lista é preservada e repetidos contam uma vez", async () => {
    const result = await resolve(anon(), "loja-um", [
      entry("esgotado"),
      entry("caneca", 2),
      entry("esgotado", 3),
    ]);

    assert.deepEqual(
      result.items.map((item) => item.name),
      ["Esgotado", "Caneca"],
    );
  });
});

describe("só o que está publicado, desta loja", () => {
  for (const [role, client] of ACTORS) {
    test(`rascunho, arquivado, outra loja e inexistente saem da lista (${role})`, async () => {
      const items = [
        entry("caneca"),
        entry("rascunho"),
        entry("arquivado"),
        entry("alheio"),
        entry("nao-existe"),
      ];
      const result = await resolve(client(), "loja-um", items);

      assert.equal(result.ok, true);
      assert.deepEqual(
        result.items.map((item) => item.name),
        ["Caneca"],
      );
      assert.deepEqual(result.removed, [
        { key: wishlistItemKey(entry("rascunho")), reason: "unavailable" },
        { key: wishlistItemKey(entry("arquivado")), reason: "unavailable" },
        { key: wishlistItemKey(entry("alheio")), reason: "unavailable" },
        { key: wishlistItemKey(entry("nao-existe")), reason: "unavailable" },
      ]);
      const names = JSON.stringify(result);
      assert.doesNotMatch(names, /Rascunho|Arquivado|Alheio/);
    });

    test(`loja desativada ou inexistente não resolve nada (${role})`, async () => {
      assert.deepEqual(await resolve(client(), "loja-off", [entry("escondido")]), {
        ok: false,
        error: "store-not-found",
      });
      assert.deepEqual(await resolve(client(), "nao-existe", [entry("caneca")]), {
        ok: false,
        error: "store-not-found",
      });
    });
  }
});

describe("variantes", () => {
  test("variante que só existe inativa sai da lista, com o nome do produto", async () => {
    const options = { cor: "Preto", tamanho: "G" };
    const result = await resolve(anon(), "loja-um", [entry("camiseta", 1, options)]);

    assert.deepEqual(result.items, []);
    assert.deepEqual(result.removed, [
      { key: wishlistItemKey(entry("camiseta", 1, options)), reason: "variant", name: "Camiseta" },
    ]);
  });

  test("escolha incompleta, grupo desconhecido ou opção em produto sem variante saem", async () => {
    const result = await resolve(anon(), "loja-um", [
      entry("camiseta", 1, { cor: "Preto" }),
      entry("camiseta", 1, { cor: "Preto", tamanho: "P", estampa: "Lisa" }),
      entry("camiseta", 1, {}),
      entry("caneca", 1, { cor: "Azul" }),
    ]);

    assert.deepEqual(result.items, []);
    assert.deepEqual(
      result.removed.map((item) => item.reason),
      ["variant", "variant", "variant", "variant"],
    );
  });
});

describe("entrada inválida é recusada antes do banco", () => {
  const invalid = [
    ["slug da loja fora do formato", "Loja Um", [entry("caneca")]],
    ["slug de produto fora do formato", "loja-um", [entry("../caneca")]],
    ["slug de produto longo demais", "loja-um", [entry("a".repeat(121))]],
    ["quantidade zero", "loja-um", [entry("caneca", 0)]],
    ["quantidade acima do máximo", "loja-um", [entry("caneca", 100)]],
    ["quantidade fracionária", "loja-um", [entry("caneca", 1.5)]],
    ["quantidade em texto", "loja-um", [{ product: "caneca", options: {}, quantity: "1" }]],
    ["opção não textual", "loja-um", [entry("camiseta", 1, { tamanho: 38 })]],
    ["opção longa demais", "loja-um", [entry("camiseta", 1, { tamanho: "x".repeat(101) })]],
    ["itens que não são lista", "loja-um", { 0: entry("caneca") }],
    ["itens acima do limite", "loja-um", Array.from({ length: 51 }, (_, i) => entry(`p-${i}`))],
  ];

  for (const [label, storeSlug, items] of invalid) {
    test(label, async () => {
      let touched = false;
      const spy = { from: () => ((touched = true), anon().from("stores")) };

      assert.deepEqual(await resolve(spy, storeSlug, items), {
        ok: false,
        error: "invalid-input",
      });
      assert.equal(touched, false, "não consulta o banco com entrada inválida");
    });
  }

  test("50 itens é o limite aceito", async () => {
    const items = Array.from({ length: 50 }, (_, i) => entry(`p-${i}`));
    const result = await resolve(anon(), "loja-um", items);
    assert.equal(result.ok, true);
    assert.equal(result.removed.length, 50);
  });

  test("entrada que nem é objeto", async () => {
    assert.deepEqual(await resolveWishlistWith(anon(), null), {
      ok: false,
      error: "invalid-input",
    });
  });
});

describe("falhas de leitura", () => {
  test("erro do banco vira read-failed, sem lançar", async () => {
    const failing = {
      from: () => {
        const chain = {
          select: () => chain,
          eq: () => chain,
          in: () => chain,
          maybeSingle: () => chain,
          then: (resolve) => resolve({ data: null, error: { message: "fora do ar" } }),
        };
        return chain;
      },
    };

    assert.deepEqual(await resolve(failing, "loja-um", [entry("caneca")]), {
      ok: false,
      error: "read-failed",
    });
  });

  test("exceção no cliente também vira read-failed", async () => {
    const exploding = {
      from: () => {
        throw new Error("rede");
      },
    };

    assert.deepEqual(await resolve(exploding, "loja-um", [entry("caneca")]), {
      ok: false,
      error: "read-failed",
    });
  });
});
