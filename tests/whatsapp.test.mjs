import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  normalizeWhatsAppNumber,
} from "../src/modules/storefront/whatsapp.ts";

const PHONE = "+5511999990001";
const DIGITS = "5511999990001";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// Intl usa espaço não separável depois de "R$": normalizamos para comparar.
const norm = (text) => text.replace(/ /g, " ");
const money = (cents) => norm(brl.format(cents / 100));

const OLEO = { name: "Óleo de massagem", quantity: 2, unitPriceCents: 1990 };
const VIBRADOR = {
  name: "Vibrador Lux",
  quantity: 1,
  unitPriceCents: 24900,
  variantLabel: "Rosa",
  url: "https://loja.exemplo.com/produto/vibrador-lux",
};
const ITENS = [OLEO, VIBRADOR];
const TOTAL_ITENS = 2 * 1990 + 1 * 24900; // 28880

function linhas(message) {
  return norm(message).split("\n");
}

function textoDaUrl(url) {
  return new URL(url).searchParams.get("text");
}

function parteCodificada(url) {
  return url.slice(url.indexOf("?text=") + "?text=".length);
}

describe("normalizeWhatsAppNumber", () => {
  test("aceita máscaras variadas e devolve só dígitos", () => {
    assert.equal(normalizeWhatsAppNumber("+55 11 99999-0001"), DIGITS);
    assert.equal(normalizeWhatsAppNumber("+55 (11) 99999.0001"), DIGITS);
    assert.equal(normalizeWhatsAppNumber("  +5511999990001  "), DIGITS);
  });

  test("número com + não ganha prefixo duplicado", () => {
    assert.equal(normalizeWhatsAppNumber(PHONE), DIGITS);
    assert.ok(!normalizeWhatsAppNumber(PHONE).startsWith("5555"));
  });

  test("celular brasileiro sem DDI ganha 55", () => {
    assert.equal(normalizeWhatsAppNumber("(11) 99999-0001"), DIGITS);
    assert.equal(normalizeWhatsAppNumber("11999990001"), DIGITS);
  });

  test("fixo brasileiro de 10 dígitos sem DDI ganha 55", () => {
    assert.equal(normalizeWhatsAppNumber("(11) 3333-4444"), "551133334444");
  });

  test("13 dígitos sem + já trazem DDI e não são reprefixados", () => {
    assert.equal(normalizeWhatsAppNumber("5511999990001"), DIGITS);
  });

  test("nunca inventa código de país para número estrangeiro", () => {
    assert.equal(normalizeWhatsAppNumber("+44 1632 960961"), "441632960961");
    assert.equal(normalizeWhatsAppNumber("+351 912 345 678"), "351912345678");
  });

  test("devolve null para entradas inválidas", () => {
    assert.equal(normalizeWhatsAppNumber(""), null);
    assert.equal(normalizeWhatsAppNumber("   "), null);
    assert.equal(normalizeWhatsAppNumber("fale comigo"), null);
    assert.equal(normalizeWhatsAppNumber("1234567"), null, "7 dígitos é curto demais");
    assert.equal(normalizeWhatsAppNumber("+1234567890123456"), null, "16 dígitos estoura E.164");
  });
});

describe("buildWhatsAppMessage", () => {
  test("template preenche {itens} e {total}", () => {
    const message = norm(
      buildWhatsAppMessage({
        items: ITENS,
        template: "Oi! Quero:\n{itens}\nTotal a pagar: {total}",
      }),
    );

    assert.ok(message.startsWith("Oi! Quero:\n"));
    assert.ok(message.includes("2x Óleo de massagem"));
    assert.ok(message.includes(`Total a pagar: ${money(TOTAL_ITENS)}`));
    assert.ok(!message.includes("{itens}"));
    assert.ok(!message.includes("{total}"));
  });

  test("substitui todas as ocorrências dos marcadores", () => {
    const message = norm(
      buildWhatsAppMessage({ items: ITENS, template: "{total} | {itens} | {total}" }),
    );
    const ocorrencias = message.split(money(TOTAL_ITENS)).length - 1;

    assert.equal(ocorrencias, 2);
  });

  test("template sem marcadores é usado como está", () => {
    const template = "Oi, tudo bem? Quero falar sobre a loja.";
    const message = buildWhatsAppMessage({ items: ITENS, template });

    assert.equal(message, template);
    assert.ok(!message.includes("Óleo"));
  });

  test("conteúdo do item não é interpretado como padrão de substituição", () => {
    const message = buildWhatsAppMessage({
      items: [{ name: "Kit $& $1 $`", quantity: 1, unitPriceCents: 1000 }],
      template: "[{itens}]",
    });

    assert.ok(message.includes("Kit $& $1 $`"));
    assert.ok(!message.includes("{itens}"));
  });

  test("sem template usa o padrão em português com lista e total", () => {
    const message = norm(buildWhatsAppMessage({ items: ITENS }));

    assert.ok(message.startsWith("Olá! Tenho interesse"));
    assert.ok(message.includes("1x Vibrador Lux"));
    assert.ok(message.includes(money(TOTAL_ITENS)));
  });

  test("template vazio ou só espaços cai no padrão", () => {
    const padrao = buildWhatsAppMessage({ items: ITENS });

    assert.equal(buildWhatsAppMessage({ items: ITENS, template: "" }), padrao);
    assert.equal(buildWhatsAppMessage({ items: ITENS, template: "   \n " }), padrao);
    assert.equal(buildWhatsAppMessage({ items: ITENS, template: null }), padrao);
  });

  test("storeName aparece na saudação padrão", () => {
    const message = norm(buildWhatsAppMessage({ items: ITENS, storeName: "Permitase Prazer" }));

    assert.ok(message.startsWith("Olá, Permitase Prazer! Tenho interesse"));
  });

  test("total é a soma de quantity * unitPriceCents formatada em BRL", () => {
    const message = norm(
      buildWhatsAppMessage({
        items: [
          { name: "A", quantity: 3, unitPriceCents: 50000 },
          { name: "B", quantity: 2, unitPriceCents: 50000 },
        ],
        template: "{total}",
      }),
    );

    // 5 x R$ 500,00 — pega inversão de centavos/reais e erro de agrupamento.
    assert.equal(message, money(250000));
    assert.ok(message.includes("2.500,00"));
  });

  test("linha do item sem variante não ganha parênteses", () => {
    const linha = linhas(buildWhatsAppMessage({ items: [OLEO], template: "{itens}" }))[0];

    assert.equal(linha, `2x Óleo de massagem — ${money(3980)}`);
  });

  test("variantLabel nula não vira texto", () => {
    const linha = linhas(
      buildWhatsAppMessage({
        items: [{ ...OLEO, variantLabel: null }],
        template: "{itens}",
      }),
    )[0];

    assert.equal(linha, `2x Óleo de massagem — ${money(3980)}`);
    assert.ok(!linha.includes("null"));
  });

  test("variante aparece quando existe", () => {
    const linha = linhas(buildWhatsAppMessage({ items: [VIBRADOR], template: "{itens}" }))[0];

    assert.equal(linha, `1x Vibrador Lux (Rosa) — ${money(24900)}`);
  });

  test("link do produto entra logo abaixo do item e só para quem tem url", () => {
    const corpo = linhas(buildWhatsAppMessage({ items: ITENS, template: "{itens}" }));

    assert.equal(corpo.length, 3, "só o segundo item tem url");
    assert.equal(corpo[1], `1x Vibrador Lux (Rosa) — ${money(24900)}`);
    assert.equal(corpo[2], VIBRADOR.url);
  });

  test("lista vazia não quebra e devolve mensagem coerente", () => {
    const message = norm(buildWhatsAppMessage({ items: [] }));

    assert.ok(message.includes("nenhum item selecionado"));
    assert.ok(message.includes(money(0)));
    assert.ok(!message.includes("NaN"));
    assert.ok(!message.includes("undefined"));
  });
});

describe("buildWhatsAppUrl", () => {
  test("monta wa.me com os dígitos normalizados e o texto codificado", () => {
    const url = buildWhatsAppUrl({ phone: "(11) 99999-0001", items: ITENS });

    assert.ok(url.startsWith(`https://wa.me/${DIGITS}?text=`));

    const codificado = parteCodificada(url);
    assert.ok(!codificado.includes(" "), "nenhum espaço cru na querystring");
    assert.ok(!codificado.includes("\n"), "nenhuma quebra de linha crua");
    assert.ok(codificado.includes("%20") && codificado.includes("%0A"));
    assert.equal(textoDaUrl(url), buildWhatsAppMessage({ items: ITENS }));
  });

  test("telefone inválido devolve null", () => {
    assert.equal(buildWhatsAppUrl({ phone: "abc", items: ITENS }), null);
    assert.equal(buildWhatsAppUrl({ phone: "", items: ITENS }), null);
    assert.equal(buildWhatsAppUrl({ phone: "+1234567890123456", items: ITENS }), null);
  });

  test("lista vazia ainda gera URL válida", () => {
    const url = buildWhatsAppUrl({ phone: PHONE, items: [] });

    assert.ok(url.startsWith(`https://wa.me/${DIGITS}?text=`));
    assert.ok(norm(textoDaUrl(url)).includes(money(0)));
  });

  test("mensagem longa é truncada, cabe no limite e mantém o total correto", () => {
    const items = Array.from({ length: 90 }, (_, i) => ({
      name: `Produto ${String(i + 1).padStart(3, "0")} edição limitada com nome comprido`,
      quantity: 2,
      unitPriceCents: 1990 + i,
      url: `https://loja.exemplo.com/produto/produto-${String(i + 1).padStart(3, "0")}`,
    }));
    const total = items.reduce((acc, item) => acc + item.quantity * item.unitPriceCents, 0);

    const url = buildWhatsAppUrl({ phone: PHONE, items });
    const codificado = parteCodificada(url);
    const texto = norm(textoDaUrl(url));

    assert.ok(codificado.length <= 1800, `texto codificado tem ${codificado.length}`);
    assert.ok(texto.includes("Produto 001"), "mantém o começo da lista");
    assert.ok(!texto.includes("Produto 090"), "descarta o fim da lista");
    assert.match(texto, /e mais \d+ itens não listados/);
    assert.ok(texto.includes(money(total)), "total continua sendo o de todos os itens");

    // A quantidade omitida tem de bater com o que sumiu da lista.
    const listados = items.filter((item) => texto.includes(item.name)).length;
    const omitidos = Number(texto.match(/e mais (\d+) itens/)[1]);
    assert.equal(listados + omitidos, items.length);

    // Sem truncamento a mensagem completa continua trazendo tudo.
    assert.ok(norm(buildWhatsAppMessage({ items })).includes("Produto 090"));
  });

  test("truncamento não parte emoji ao meio", () => {
    const items = Array.from({ length: 60 }, (_, i) => ({
      name: `Presente 🎁🎀💝 número ${String(i + 1).padStart(3, "0")} com nome bem comprido`,
      quantity: 1,
      unitPriceCents: 9990,
      url: `https://loja.exemplo.com/p/${String(i + 1).padStart(3, "0")}`,
    }));

    const url = buildWhatsAppUrl({ phone: PHONE, items });
    const texto = textoDaUrl(url);

    assert.ok(parteCodificada(url).length <= 1800);
    assert.ok(!texto.includes("�"), "nenhum caractere de substituição");
    assert.ok(texto.includes("🎁🎀💝"), "emojis preservados inteiros");

    // Cada item listado carrega exatamente os três emojis: nenhum sobrou pela metade.
    const presentes = texto.match(/🎁/gu).length;
    assert.equal(texto.match(/[🎁🎀💝]/gu).length, presentes * 3);
    assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(texto), "nenhum surrogate solto");
  });

  test("caracteres especiais não escapam da querystring", () => {
    const items = [
      {
        name: "Kit A&B #1 ?promo 50% +brinde 🎁\nsegunda linha",
        quantity: 1,
        unitPriceCents: 12345,
        variantLabel: "P&G",
        url: "https://loja.exemplo.com/p?ref=a&b=2#ancora",
      },
    ];
    const template = "Oi! +1 pedido =>\n{itens}\n#Total: {total}";

    const url = buildWhatsAppUrl({ phone: PHONE, items, template });
    const codificado = parteCodificada(url);

    assert.equal(url.split("?").length, 2, "um único ? em toda a URL");
    assert.ok(!url.includes("#"), "nenhum fragmento cru");
    assert.ok(!codificado.includes("&"), "nenhum parâmetro extra injetado");
    assert.ok(!codificado.includes("+"), "+ vai codificado para não virar espaço");
    assert.ok(codificado.includes("%F0%9F%8E%81"), "emoji em UTF-8 percent-encoded");

    const parsed = new URL(url);
    assert.equal(parsed.host, "wa.me");
    assert.equal(parsed.pathname, `/${DIGITS}`);
    assert.equal([...parsed.searchParams.keys()].length, 1);
    assert.equal(parsed.searchParams.get("text"), buildWhatsAppMessage({ items, template }));
  });
});
