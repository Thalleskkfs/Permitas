import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { imageSrc } from "../src/modules/storefront/mappers.ts";

/**
 * Endereço público das imagens do catálogo.
 *
 * O `src` que a vitrine renderiza aponta para a rota /imagens do próprio site. Um
 * caminho fora da convenção nunca vira endereço: ele poderia ser uma tentativa de
 * alcançar outro arquivo do bucket, ou dado corrompido vindo do banco.
 */

const LOJA = "d0000000-0000-0000-0000-000000000001";
const DONO = "e0000000-0000-0000-0000-000000000001";

describe("imageSrc", () => {
  test("caminho na convenção vira endereço da rota de imagens", () => {
    assert.equal(imageSrc(`${LOJA}/${DONO}/foto.webp`), `/imagens/${LOJA}/${DONO}/foto.webp`);
  });

  test("ausência de caminho não vira endereço", () => {
    assert.equal(imageSrc(null), undefined);
    assert.equal(imageSrc(undefined), undefined);
    assert.equal(imageSrc(""), undefined);
  });

  for (const [nome, caminho] of [
    ["subida de diretório", `${LOJA}/../${DONO}/foto.webp`],
    ["barra inicial", `/${LOJA}/${DONO}/foto.webp`],
    ["nível a mais", `${LOJA}/${DONO}/extra/foto.webp`],
    ["nível a menos", `${LOJA}/foto.webp`],
    ["loja que não é UUID", `loja/${DONO}/foto.webp`],
    ["extensão não permitida", `${LOJA}/${DONO}/foto.svg`],
    ["maiúsculas no arquivo", `${LOJA}/${DONO}/Foto.webp`],
    ["URL externa", "https://outro-site.com/foto.webp"],
  ]) {
    test(`caminho recusado: ${nome}`, () => {
      assert.equal(imageSrc(caminho), undefined, caminho);
    });
  }
});
