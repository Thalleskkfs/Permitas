/**
 * Páginas institucionais: cada página listada tem o que a rota precisa, e nenhum corpo
 * de seção traz texto que não seja marcador enquanto o conteúdo for provisório. Isso
 * protege a regra de não publicar texto jurídico que não veio da assessoria.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  getInstitutionalPage,
  INSTITUTIONAL_PAGES,
  PROVISIONAL,
} from "../src/modules/storefront/institutional.ts";

const SLUGS_ESPERADOS = [
  "privacidade",
  "termos",
  "trocas-e-devolucoes",
  "entrega",
  "cookies",
  "pagamento",
  "conteudo-adulto",
  "quem-somos",
  "contato",
  "perguntas-frequentes",
];

const MARCADOR = /^\[[^\[\]]+\]$/;

describe("páginas institucionais", () => {
  test("a lista tem exatamente os slugs esperados, sem repetição", () => {
    const slugs = INSTITUTIONAL_PAGES.map((page) => page.slug);
    assert.equal(new Set(slugs).size, slugs.length);
    assert.deepEqual([...slugs].sort(), [...SLUGS_ESPERADOS].sort());
  });

  for (const page of INSTITUTIONAL_PAGES) {
    test(`${page.slug}: título, descrição e ao menos uma seção`, () => {
      assert.ok(page.title.trim());
      assert.ok(page.description.trim());
      assert.ok(page.sections.length > 0);
      for (const section of page.sections) {
        assert.ok(section.heading.trim());
        assert.ok(section.body.length > 0);
      }
    });
  }

  test("enquanto provisório, todo corpo de seção é marcador", () => {
    assert.equal(PROVISIONAL, true);
    for (const page of INSTITUTIONAL_PAGES) {
      for (const section of page.sections) {
        for (const paragraph of section.body) {
          assert.match(paragraph, MARCADOR, `${page.slug} / ${section.heading}`);
        }
      }
    }
  });

  test("slug desconhecido não encontra página", () => {
    assert.equal(getInstitutionalPage("nao-existe"), null);
    assert.equal(getInstitutionalPage("contato")?.title, "Contato");
  });
});
