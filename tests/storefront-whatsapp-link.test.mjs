/**
 * Contrato entre os botões da vitrine e o módulo de mensagem.
 *
 * O módulo já é coberto por `whatsapp.test.mjs`. O que se verifica aqui é o formato do
 * item que cada botão monta — página de produto e carrinho —, porque é esse formato que
 * decide se a vendedora recebe nome, variante, quantidade, preço e link, ou uma
 * mensagem pela metade.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildWhatsAppUrl } from "../src/modules/storefront/whatsapp.ts";

const PHONE = "+55 11 99999-0001";
const SITE = "https://loja.exemplo.com";

const norm = (text) => text.replace(/ /g, " ");
const textoDaUrl = (url) => norm(new URL(url).searchParams.get("text"));

// Item como a página de produto o monta: um só, com a variante escolhida na tela.
const ITEM_PRODUTO = {
  name: "Produto exemplo 01",
  quantity: 2,
  unitPriceCents: 5192,
  variantLabel: "Tamanho M · Cor Preto",
  url: `${SITE}/produto/produto-exemplo`,
};

// Itens como o carrinho os monta: a lista inteira, cada um com o próprio link.
const ITENS_CARRINHO = [
  ITEM_PRODUTO,
  {
    name: "Produto exemplo 02",
    quantity: 1,
    unitPriceCents: 7990,
    variantLabel: "Tamanho G · Cor Branco",
    url: `${SITE}/produto/produto-exemplo-2`,
  },
];

describe("link do botão na página de produto", () => {
  test("leva nome, variante, quantidade, preço e o link absoluto do produto", () => {
    const url = buildWhatsAppUrl({ phone: PHONE, items: [ITEM_PRODUTO] });
    const texto = textoDaUrl(url);

    assert.ok(url.startsWith("https://wa.me/5511999990001?text="));
    assert.ok(texto.includes("2x Produto exemplo 01 (Tamanho M · Cor Preto)"));
    assert.ok(texto.includes("R$ 103,84"), "2 x R$ 51,92");
    assert.ok(texto.includes(ITEM_PRODUTO.url), "sem o link não existe cartão de prévia");
  });

  test("produto sem variante escolhida não manda rótulo vazio", () => {
    const texto = textoDaUrl(
      buildWhatsAppUrl({ phone: PHONE, items: [{ ...ITEM_PRODUTO, variantLabel: null }] }),
    );

    assert.ok(texto.includes("2x Produto exemplo 01 —"));
    assert.ok(!texto.includes("()"));
    assert.ok(!texto.includes("null"));
  });
});

describe("link do botão no carrinho", () => {
  test("leva todos os itens e o total da lista", () => {
    const texto = textoDaUrl(buildWhatsAppUrl({ phone: PHONE, items: ITENS_CARRINHO }));

    assert.ok(texto.includes("2x Produto exemplo 01"));
    assert.ok(texto.includes("1x Produto exemplo 02"));
    assert.ok(texto.includes("Total: R$ 183,74"), "R$ 103,84 + R$ 79,90");
  });

  test("modelo da loja substitui a mensagem padrão", () => {
    const texto = textoDaUrl(
      buildWhatsAppUrl({
        phone: PHONE,
        items: ITENS_CARRINHO,
        template: "Oi! Quero estes itens:\n{itens}\nDá quanto? {total}",
      }),
    );

    assert.ok(texto.startsWith("Oi! Quero estes itens:"));
    assert.ok(texto.includes("Dá quanto? R$ 183,74"));
  });
});

describe("número ausente ou inválido", () => {
  test("não gera link, e o botão fica sem para onde ir", () => {
    assert.equal(buildWhatsAppUrl({ phone: "", items: ITENS_CARRINHO }), null);
    assert.equal(buildWhatsAppUrl({ phone: "a combinar", items: ITENS_CARRINHO }), null);
  });
});
