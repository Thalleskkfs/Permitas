import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  WISHLIST_MAX_ITEMS,
  WISHLIST_MAX_QUANTITY,
  addEntry,
  normalizeEntries,
  parseWishlist,
  readWishlist,
  removeEntries,
  serializeWishlist,
  setEntryQuantity,
  wishlistItemKey,
  wishlistStorageKey,
  writeWishlist,
} from "../src/modules/storefront/wishlist.ts";

/**
 * Lista de interesse no navegador: a lógica pura, sem React.
 *
 * O `localStorage` é tratado como entrada hostil — pode vir corrompido, editado à mão,
 * de uma versão antiga, ou simplesmente não existir (modo privado). Nada disso pode
 * derrubar a página nem colocar preço na lista.
 */

const entry = (product, quantity = 1, options = {}) => ({ product, options, quantity });

/** Storage em memória com a mesma interface mínima do navegador. */
function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

const throwingStorage = {
  getItem() {
    throw new Error("SecurityError: acesso negado");
  },
  setItem() {
    throw new Error("QuotaExceededError");
  },
};

describe("formato gravado", () => {
  test("guarda só identificadores, com versão, numa chave por loja", () => {
    const raw = serializeWishlist([entry("caneca", 2, { Cor: "Preto" })]);

    assert.deepEqual(JSON.parse(raw), {
      version: 1,
      items: [{ product: "caneca", options: { Cor: "Preto" }, quantity: 2 }],
    });
    assert.equal(wishlistStorageKey("demo"), "catalogo:lista:demo");
    assert.notEqual(wishlistStorageKey("demo"), wishlistStorageKey("outra"));
  });

  test("ida e volta preserva a lista", () => {
    const items = [entry("a-1", 3), entry("b-2", 1, { Tamanho: "M", Cor: "Azul" })];
    assert.deepEqual(parseWishlist(serializeWishlist(items)), items);
  });

  test("preço e nome no storage são descartados na leitura", () => {
    const raw = JSON.stringify({
      version: 1,
      items: [{ product: "caneca", options: {}, quantity: 1, unitPrice: 1, name: "Grátis" }],
    });

    assert.deepEqual(parseWishlist(raw), [entry("caneca", 1)]);
  });
});

describe("leitura tolerante", () => {
  test("JSON quebrado, vazio, formato estranho ou versão desconhecida viram lista vazia", () => {
    for (const raw of [
      null,
      "",
      "{",
      "null",
      "[]",
      '"texto"',
      "42",
      '{"version":2,"items":[{"product":"a","options":{},"quantity":1}]}',
      '{"version":1}',
      '{"version":1,"items":{}}',
    ]) {
      assert.deepEqual(parseWishlist(raw), [], `entrada: ${raw}`);
    }
  });

  test("um item inválido sai sozinho; os válidos ficam", () => {
    const raw = JSON.stringify({
      version: 1,
      items: [
        entry("valido", 1),
        entry("Maiúscula", 1),
        entry("../fora", 1),
        entry("a".repeat(121), 1),
        { product: "sem-quantidade", options: {} },
        { product: "qtd-texto", options: {}, quantity: "2" },
        { product: "opcao-numero", options: { Tamanho: 38 }, quantity: 1 },
        { product: "opcao-lista", options: ["M"], quantity: 1 },
        null,
        "caneca",
        entry("outro-valido", 2),
      ],
    });

    assert.deepEqual(parseWishlist(raw), [entry("valido", 1), entry("outro-valido", 2)]);
  });

  test("quantidade fora da faixa é trazida para dentro dela", () => {
    const raw = JSON.stringify({
      version: 1,
      items: [entry("muito", 5000), entry("zero", 0), entry("negativo", -3), entry("fracao", 2.7)],
    });

    assert.deepEqual(
      parseWishlist(raw).map((item) => item.quantity),
      [WISHLIST_MAX_QUANTITY, 1, 1, 2],
    );
  });

  test("repetidos no storage são fundidos, somando até o máximo", () => {
    const raw = JSON.stringify({
      version: 1,
      items: [
        entry("a", 60, { Cor: "Preto", Tamanho: "M" }),
        entry("b", 1),
        entry("a", 60, { Tamanho: "M", Cor: "Preto" }),
      ],
    });

    assert.deepEqual(parseWishlist(raw), [
      entry("a", WISHLIST_MAX_QUANTITY, { Cor: "Preto", Tamanho: "M" }),
      entry("b", 1),
    ]);
  });

  test("lista adulterada com itens demais é cortada no limite", () => {
    const items = Array.from({ length: WISHLIST_MAX_ITEMS + 20 }, (_, i) => entry(`p-${i}`, 1));
    const parsed = parseWishlist(JSON.stringify({ version: 1, items }));

    assert.equal(parsed.length, WISHLIST_MAX_ITEMS);
    assert.equal(parsed[0].product, "p-0");
  });

  test("storage inacessível: ler devolve vazio e gravar devolve false, sem lançar", () => {
    assert.deepEqual(readWishlist(throwingStorage, "demo"), []);
    assert.equal(writeWishlist(throwingStorage, "demo", [entry("a", 1)]), false);
    assert.deepEqual(readWishlist(null, "demo"), []);
    assert.equal(writeWishlist(undefined, "demo", [entry("a", 1)]), false);
  });

  test("storage corrompido na chave da loja devolve vazio", () => {
    const storage = memoryStorage({ [wishlistStorageKey("demo")]: "{nada disso" });
    assert.deepEqual(readWishlist(storage, "demo"), []);
  });

  test("lojas não se misturam", () => {
    const storage = memoryStorage();
    assert.equal(writeWishlist(storage, "loja-um", [entry("caneca", 1)]), true);

    assert.deepEqual(readWishlist(storage, "loja-um"), [entry("caneca", 1)]);
    assert.deepEqual(readWishlist(storage, "loja-dois"), []);
  });
});

describe("edição", () => {
  test("item novo entra no fim", () => {
    const result = addEntry([entry("a", 1)], entry("b", 2));
    assert.equal(result.status, "added");
    assert.equal(result.quantity, 2);
    assert.deepEqual(result.items, [entry("a", 1), entry("b", 2)]);
  });

  test("mesmo produto e mesma variante somam, na posição original", () => {
    const items = [entry("a", 2, { Cor: "Preto", Tamanho: "M" }), entry("b", 1)];
    const result = addEntry(items, entry("a", 3, { Tamanho: "M", Cor: "Preto" }));

    assert.equal(result.status, "merged");
    assert.equal(result.quantity, 5);
    assert.deepEqual(result.items, [entry("a", 5, { Cor: "Preto", Tamanho: "M" }), entry("b", 1)]);
  });

  test("mesmo produto com outra variante é outro item", () => {
    const result = addEntry([entry("a", 1, { Tamanho: "M" })], entry("a", 1, { Tamanho: "G" }));
    assert.equal(result.status, "added");
    assert.equal(result.items.length, 2);
  });

  test("a soma para no máximo por item", () => {
    const result = addEntry([entry("a", 90)], entry("a", 50));
    assert.equal(result.quantity, WISHLIST_MAX_QUANTITY);
  });

  test("lista cheia recusa item novo, mas ainda soma nos existentes", () => {
    const full = Array.from({ length: WISHLIST_MAX_ITEMS }, (_, i) => entry(`p-${i}`, 1));

    const refused = addEntry(full, entry("novo", 1));
    assert.equal(refused.status, "full");
    assert.equal(refused.items, full, "a lista não muda");

    assert.equal(addEntry(full, entry("p-3", 1)).status, "merged");
  });

  test("não altera a lista recebida", () => {
    const items = [entry("a", 1)];
    const snapshot = structuredClone(items);
    addEntry(items, entry("a", 1));
    addEntry(items, entry("b", 1));
    setEntryQuantity(items, wishlistItemKey(items[0]), 7);
    removeEntries(items, [wishlistItemKey(items[0])]);
    assert.deepEqual(items, snapshot);
  });

  test("quantidade e remoção agem pela chave do item", () => {
    const items = [entry("a", 1, { Tamanho: "M" }), entry("a", 1, { Tamanho: "G" })];
    const key = wishlistItemKey(items[1]);

    assert.deepEqual(setEntryQuantity(items, key, 500), [items[0], entry("a", 99, { Tamanho: "G" })]);
    assert.deepEqual(removeEntries(items, [key]), [items[0]]);
  });

  test("a chave ignora a ordem das opções", () => {
    assert.equal(
      wishlistItemKey(entry("a", 1, { Cor: "Preto", Tamanho: "M" })),
      wishlistItemKey(entry("a", 9, { Tamanho: "M", Cor: "Preto" })),
    );
  });

  test("normalizar é idempotente", () => {
    const items = [entry("a", 2), entry("a", 3), entry("b", 1)];
    const once = normalizeEntries(items);
    assert.deepEqual(normalizeEntries(once), once);
  });
});
