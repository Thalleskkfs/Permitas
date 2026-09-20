import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { describe, test } from "node:test";
import {
  STORE_CONTEXT_REDIRECTS,
  isAuthorizedStore,
  resolveStoreContext,
} from "../src/lib/auth/store-context.ts";
import { canDeleteStructures, roleAllows } from "../src/modules/catalog/authorization.ts";
import { CATALOG_MESSAGES, toCatalogErrorMessage, toFieldErrors } from "../src/modules/catalog/errors.ts";
import {
  PRODUCTS_PER_PAGE,
  categoryInputSchema,
  collectionInputSchema,
  productInputSchema,
  productQuerySchema,
  tagInputSchema,
  toSearchPattern,
  variantInputSchema,
} from "../src/modules/catalog/schemas.ts";

const ROOT = new URL("../", import.meta.url);
const SRC = new URL("src/", ROOT);
const STORE_A = "11111111-1111-4111-8111-111111111111";
const STORE_B = "22222222-2222-4222-8222-222222222222";
const CAT_A = "33333333-3333-4333-8333-333333333333";

const baseProduct = { name: "Camiseta Básica", price: "49.90", stock: "10", status: "draft" };
const parseProduct = (patch = {}) => productInputSchema.safeParse({ ...baseProduct, ...patch });

async function listSources() {
  const entries = await readdir(SRC, { withFileTypes: true, recursive: true });
  const files = entries
    .filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
    .map((entry) => `${entry.parentPath}/${entry.name}`.replaceAll("\\", "/"));
  return new Map(await Promise.all(files.map(async (file) => [file, await readFile(file, "utf8")])));
}

const rootPath = decodeURIComponent(ROOT.pathname).replace(/^\/+/, "");
const relative = (file) => file.replace(rootPath, "");

describe("contexto de loja vem da membership, nunca do cliente", () => {
  test("um único vínculo define a loja ativa", () => {
    assert.deepEqual(resolveStoreContext([{ storeId: STORE_A, role: "owner" }]), {
      status: "ok",
      storeId: STORE_A,
      role: "owner",
    });
  });

  test("sem vínculo não há loja", () => {
    assert.deepEqual(resolveStoreContext([]), { status: "no-store" });
    assert.equal(STORE_CONTEXT_REDIRECTS["no-store"], "/admin/sem-loja");
  });

  test("com vários vínculos o painel para e pede seleção, sem escolher sozinho", () => {
    const memberships = [
      { storeId: STORE_A, role: "owner" },
      { storeId: STORE_B, role: "editor" },
    ];
    const context = resolveStoreContext(memberships);

    assert.equal(context.status, "selection-required");
    assert.equal(context.storeId, undefined, "nenhuma loja pode ser escolhida automaticamente");
    assert.deepEqual(context.memberships, memberships);
    assert.equal(STORE_CONTEXT_REDIRECTS["selection-required"], "/admin/selecionar-loja");
  });

  test("um store_id arbitrário não é autorizado", () => {
    const context = resolveStoreContext([{ storeId: STORE_A, role: "owner" }]);
    assert.equal(isAuthorizedStore(context, STORE_A), true);
    assert.equal(isAuthorizedStore(context, STORE_B), false);
    assert.equal(isAuthorizedStore(resolveStoreContext([]), STORE_A), false);
    assert.equal(
      isAuthorizedStore(resolveStoreContext([
        { storeId: STORE_A, role: "owner" },
        { storeId: STORE_B, role: "owner" },
      ]), STORE_A),
      false,
      "com seleção pendente nenhuma loja é autorizada",
    );
  });
});

describe("papéis do catálogo", () => {
  test("owner e editor criam, leem e editam", () => {
    for (const role of ["owner", "editor"]) {
      for (const action of ["catalog:read", "catalog:create", "catalog:update"]) {
        assert.equal(roleAllows(role, action), true, `${role} ${action}`);
      }
    }
  });

  test("somente owner exclui estruturas; editor remove apenas vínculos", () => {
    assert.equal(canDeleteStructures("owner"), true);
    assert.equal(canDeleteStructures("editor"), false);
    assert.equal(roleAllows("editor", "catalog:delete-structure"), false);
    assert.equal(roleAllows("editor", "catalog:delete-link"), true);
  });
});

describe("validação de produto no servidor", () => {
  test("produto válido é aceito e o slug é gerado", () => {
    const result = parseProduct();
    assert.equal(result.success, true);
    assert.equal(result.data.slug, "camiseta-basica");
    assert.equal(result.data.price, 4990);
    assert.equal(result.data.promotionalPrice, null);
  });

  test("preço zero ou negativo é rejeitado antes de chegar ao banco", () => {
    for (const price of ["0", "0.00", "-1", "-0.01"]) {
      const result = parseProduct({ price });
      assert.equal(result.success, false, price);
      assert.match(result.error.issues[0].message, /maior que zero/);
    }
  });

  test("preço promocional inválido é rejeitado", () => {
    assert.equal(parseProduct({ promotionalPrice: "0" }).success, false);
    assert.equal(parseProduct({ promotionalPrice: "-5" }).success, false);

    const higher = parseProduct({ promotionalPrice: "99.90" });
    assert.equal(higher.success, false);
    assert.match(higher.error.issues[0].message, /não pode ser maior que o preço/);

    assert.equal(parseProduct({ promotionalPrice: "49.90" }).success, true, "igual ao preço é válido");
    assert.equal(parseProduct({ promotionalPrice: "39.90" }).success, true);
  });

  test("estoque negativo e status inválido são rejeitados", () => {
    assert.equal(parseProduct({ stock: "-1" }).success, false);
    assert.equal(parseProduct({ status: "ativo" }).success, false);
    assert.equal(parseProduct({ name: "   " }).success, false);
  });

  test("o formulário não carrega store_id: o schema nem o conhece", () => {
    const result = productInputSchema.safeParse({ ...baseProduct, store_id: STORE_B, storeId: STORE_B });
    assert.equal(result.success, true);
    assert.equal("store_id" in result.data, false);
    assert.equal("storeId" in result.data, false);
  });

  test("identificadores de categoria, tag e coleção precisam ser UUID", () => {
    assert.equal(parseProduct({ categoryId: "não-é-uuid" }).success, false);
    assert.equal(parseProduct({ categoryId: CAT_A }).success, true);
    assert.equal(parseProduct({ categoryId: "" }).success, true, "vazio vira sem categoria");
    assert.equal(parseProduct({ tagIds: ["abc"] }).success, false);
    assert.equal(parseProduct({ collectionIds: ["abc"] }).success, false);
  });
});

describe("validação das demais entidades", () => {
  test("categoria, tag e coleção exigem nome e geram slug", () => {
    for (const schema of [categoryInputSchema, tagInputSchema, collectionInputSchema]) {
      const ok = schema.safeParse({ name: "Roupas de Verão" });
      assert.equal(ok.success, true);
      assert.equal(ok.data.slug, "roupas-de-verao");
      assert.equal(schema.safeParse({ name: "  " }).success, false);
    }
  });

  test("variante aceita preço vazio e options genéricas", () => {
    const ok = variantInputSchema.safeParse({
      name: "Tamanho M",
      stock: "5",
      price: "",
      options: "Tamanho: M\nCor: Preto",
    });
    assert.equal(ok.success, true);
    assert.equal(ok.data.price, null, "sem preço a variante usa o do produto");
    assert.deepEqual(ok.data.options, { Tamanho: "M", Cor: "Preto" });

    assert.equal(variantInputSchema.safeParse({ name: "x", stock: "0", price: "0" }).success, false);
    assert.equal(variantInputSchema.safeParse({ name: "x", stock: "-1" }).success, false);
    assert.equal(
      variantInputSchema.safeParse({ name: "x", stock: "1", options: "sem separador" }).success,
      false,
    );
  });
});

describe("listagem: paginação e filtros", () => {
  test("a página padrão é 1 e o tamanho é 24", () => {
    assert.equal(PRODUCTS_PER_PAGE, 24);
    assert.deepEqual(productQuerySchema.parse({}), {
      q: "",
      status: "all",
      categoryId: null,
      sort: "recent",
      page: 1,
    });
  });

  test("valores inválidos na URL caem no padrão em vez de quebrar a tela", () => {
    const parsed = productQuerySchema.parse({
      page: "-3",
      status: "inexistente",
      sort: "qualquer",
      categoryId: "não-é-uuid",
    });
    assert.deepEqual(parsed, { q: "", status: "all", categoryId: null, sort: "recent", page: 1 });
  });

  test("filtros válidos são preservados", () => {
    const parsed = productQuerySchema.parse({
      q: " camiseta ",
      status: "published",
      sort: "price",
      categoryId: CAT_A,
      page: "3",
    });
    assert.deepEqual(parsed, {
      q: "camiseta",
      status: "published",
      categoryId: CAT_A,
      sort: "price",
      page: 3,
    });
  });

  test("o termo de busca não consegue alterar o filtro do PostgREST", () => {
    assert.equal(toSearchPattern(""), null);
    assert.equal(toSearchPattern("   "), null);
    assert.equal(toSearchPattern("camiseta"), "%camiseta%");

    for (const term of ['a,status.eq.published', "a)or(b", 'a"b', "a%b", "a*b", "a'b", "a\\b"]) {
      const pattern = toSearchPattern(term);
      const inner = pattern.slice(1, -1);
      for (const dangerous of [",", "(", ")", '"', "%", "*", "'", "\\"]) {
        assert.ok(!inner.includes(dangerous), `"${term}" manteve ${dangerous}`);
      }
    }
  });
});

describe("erros do banco viram mensagens, nunca contornos", () => {
  test("cada código conhecido tem mensagem própria", () => {
    assert.equal(toCatalogErrorMessage({ code: "23505", message: "products_store_id_slug_key" }), CATALOG_MESSAGES.duplicateSlug);
    assert.equal(toCatalogErrorMessage({ code: "23505", message: "products_store_id_sku_key" }), CATALOG_MESSAGES.duplicateSku);
    assert.equal(toCatalogErrorMessage({ code: "23503", message: "fk" }), CATALOG_MESSAGES.crossStore);
    assert.equal(toCatalogErrorMessage({ code: "23514", message: "check" }), CATALOG_MESSAGES.checkViolation);
    assert.equal(toCatalogErrorMessage({ code: "42501" }), CATALOG_MESSAGES.notAllowed);
    assert.equal(
      toCatalogErrorMessage({ message: "new row violates row-level security policy" }),
      CATALOG_MESSAGES.notAllowed,
    );
    assert.equal(toCatalogErrorMessage({ message: "A hierarquia não pode conter ciclos." }), CATALOG_MESSAGES.cycle);
    assert.equal(toCatalogErrorMessage(null), CATALOG_MESSAGES.generic);
  });

  test("erros de campo preservam o primeiro problema de cada campo", () => {
    const result = productInputSchema.safeParse({ ...baseProduct, price: "0", stock: "-1" });
    const fieldErrors = toFieldErrors(result.error.issues);
    assert.ok(fieldErrors.price);
    assert.ok(fieldErrors.stock);
  });
});

describe("o catálogo não usa service_role", () => {
  test("nenhum módulo de catálogo importa o admin client", async () => {
    for (const [file, source] of await listSources()) {
      const path = relative(file);
      if (!path.startsWith("src/modules/catalog/")) continue;

      // Identificadores reais, não a palavra em comentário.
      for (const forbidden of [/createAdminClient/, /process\.env\.[A-Z_]*SERVICE_ROLE/, /supabase\/admin/]) {
        assert.doesNotMatch(source, forbidden, `${path} usa service_role`);
      }
    }
  });

  test("os módulos que falam com o banco usam o cliente de sessão", async () => {
    for (const file of ["src/modules/catalog/queries.ts", "src/modules/catalog/actions.ts"]) {
      const source = await readFile(new URL(file, ROOT), "utf8");
      assert.match(source, /from "@\/lib\/supabase\/server"/, `${file} deveria usar o cliente de sessão`);
    }
  });

  test("as páginas do painel não importam o admin client", async () => {
    for (const [file, source] of await listSources()) {
      const path = relative(file);
      if (!path.includes("(admin)")) continue;
      assert.doesNotMatch(source, /createAdminClient/, `${path} usa service_role`);
    }
  });

  test("o admin client segue restrito ao Storage", async () => {
    const users = [];
    for (const [file, source] of await listSources()) {
      if (/createAdminClient/.test(source)) users.push(relative(file));
    }
    assert.deepEqual(users.sort(), [
      "src/lib/storage/catalog-images.ts",
      "src/lib/supabase/admin.ts",
    ]);
  });
});

describe("as Server Actions validam sessão, loja e papel", () => {
  test("toda ação exportada resolve a loja autorizada antes de gravar", async () => {
    const source = await readFile(new URL("src/modules/catalog/actions.ts", ROOT), "utf8");
    assert.match(source, /^"use server";/m);

    const exported = [...source.matchAll(/export async function (\w+)\(/g)].map((match) => match[1]);
    assert.ok(exported.length >= 10, `esperava as ações do catálogo, achei ${exported.length}`);

    for (const name of exported) {
      const start = source.indexOf(`export async function ${name}(`);
      const next = exported
        .map((other) => source.indexOf(`export async function ${other}(`))
        .filter((index) => index > start)
        .sort((a, b) => a - b)[0] ?? source.length;
      const body = source.slice(start, next);

      assert.match(body, /await requireCurrentStore\(\)/, `${name} não resolve a loja`);
      assert.match(body, /store\.storeId/, `${name} não usa a loja autorizada`);
      assert.doesNotMatch(body, /store_id:\s*(input|formData|text\()/, `${name} aceita store_id do cliente`);
    }
  });

  test("as exclusões de estrutura checam o papel", async () => {
    const source = await readFile(new URL("src/modules/catalog/actions.ts", ROOT), "utf8");
    for (const name of [
      "deleteProductAction",
      "deleteCategoryAction",
      "deleteTagAction",
      "deleteCollectionAction",
      "deleteVariantAction",
    ]) {
      const start = source.indexOf(`export async function ${name}(`);
      assert.ok(start >= 0, `${name} não existe`);
      const body = source.slice(start, start + 1200);
      assert.match(body, /canDeleteStructures\(store\.role\)/, `${name} não checa o papel`);
    }
  });

  test("as consultas restringem pela loja autorizada", async () => {
    const source = await readFile(new URL("src/modules/catalog/queries.ts", ROOT), "utf8");
    const selects = source.match(/\.from\("(\w+)"\)/g) ?? [];
    assert.ok(selects.length >= 6);

    const eqStore = source.match(/\.eq\("store_id", storeId\)/g) ?? [];
    assert.equal(eqStore.length, selects.length, "toda consulta precisa filtrar por store_id");
  });
});
