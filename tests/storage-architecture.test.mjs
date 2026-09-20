import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { describe, test } from "node:test";
import {
  CATALOG_IMAGES_BUCKET,
  CATALOG_IMAGE_MIME_TYPES,
  buildCatalogImagePath,
  generateCatalogImageFilename,
  isCatalogImageMimeType,
  isValidCatalogImageFilename,
  parseCatalogImagePath,
} from "../src/lib/storage/catalog-image-path.ts";

const ROOT = new URL("../", import.meta.url);
const SRC = new URL("src/", ROOT);
const SERVER_ONLY_MODULES = ["src/lib/supabase/admin.ts", "src/lib/storage/catalog-images.ts"];

const STORE = "4f0c1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b";
const PRODUCT = "9b1e2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d";
const FILE = "0d6f3c1a-7e5b-4a52-9c1d-2b8e6f4a7c10.webp";

async function listFiles(dir, filter) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile() && filter(entry.name))
    .map((entry) => `${entry.parentPath}/${entry.name}`.replaceAll("\\", "/"));
}

const isSource = (name) => /\.(ts|tsx)$/.test(name);
const read = (file) => readFile(file, "utf8");

/** Resolve um import para um caminho dentro de src; retorna null para pacotes externos. */
function resolveImport(specifier, fromFile) {
  let base;
  if (specifier.startsWith("@/")) base = new URL(specifier.slice(2), SRC);
  else if (specifier.startsWith(".")) base = new URL(specifier, `file:///${fromFile}`);
  else return null;

  const path = decodeURIComponent(base.pathname).replace(/^\/+/, "");
  const candidates = /\.(ts|tsx)$/.test(path)
    ? [path]
    : [`${path}.ts`, `${path}.tsx`, `${path}/index.ts`, `${path}/index.tsx`];
  return candidates;
}

function extractImports(source) {
  return [...source.matchAll(/(?:from\s*|import\s*)["']([^"']+)["']/g)].map((match) => match[1]);
}

describe("convenção de path do catálogo", () => {
  test("monta o path a partir das partes", () => {
    assert.equal(buildCatalogImagePath({ storeId: STORE, productId: PRODUCT, filename: FILE }), `${STORE}/${PRODUCT}/${FILE}`);
  });

  test("recusa store e product que não sejam UUID canônico minúsculo", () => {
    for (const bad of ["", "nao-e-uuid", STORE.toUpperCase(), `${STORE} `, `${STORE}/x`, STORE.replace(/-/g, "")]) {
      assert.throws(() => buildCatalogImagePath({ storeId: bad, productId: PRODUCT, filename: FILE }), /storeId inválido/);
      assert.throws(() => buildCatalogImagePath({ storeId: STORE, productId: bad, filename: FILE }), /productId inválido/);
    }
  });

  test("recusa nomes de arquivo perigosos ou fora do padrão", () => {
    const bad = [
      "../fora.webp", "a/b.webp", "/abs.webp", "..%2Ffora.webp", "Maiuscula.webp", "com espaço.webp",
      "ação.webp", "-inicio.webp", ".oculto.webp", "semextensao", "duas.pontos.webp", "arquivo.webp.exe",
      "arquivo.gif", "arquivo.svg", "arquivo.pdf", "arquivo.php", "", `${"x".repeat(101)}.webp`,
    ];
    for (const filename of bad) {
      assert.equal(isValidCatalogImageFilename(filename), false, filename);
      assert.throws(() => buildCatalogImagePath({ storeId: STORE, productId: PRODUCT, filename }), /filename inválido/, filename);
    }
  });

  test("aceita as extensões de imagem permitidas", () => {
    for (const ext of ["jpg", "jpeg", "png", "webp", "avif"]) {
      assert.equal(isValidCatalogImageFilename(`imagem-01_a.${ext}`), true, ext);
    }
  });

  test("interpreta um path válido e rejeita os demais", () => {
    assert.deepEqual(parseCatalogImagePath(`${STORE}/${PRODUCT}/${FILE}`), {
      storeId: STORE, productId: PRODUCT, filename: FILE,
    });
    const bad = [
      `${STORE}/${FILE}`, `${STORE}/${PRODUCT}/sub/${FILE}`, `/${STORE}/${PRODUCT}/${FILE}`,
      `${STORE}//${FILE}`, `${STORE}/${PRODUCT}/../${FILE}`, `${STORE.toUpperCase()}/${PRODUCT}/${FILE}`,
      `${STORE}/${PRODUCT}/`, "", `${STORE}/${PRODUCT}/x.gif`,
    ];
    for (const path of bad) assert.equal(parseCatalogImagePath(path), null, path);
  });

  test("o nome gerado pelo servidor é sempre válido e ignora o nome do usuário", () => {
    for (const mime of Object.keys(CATALOG_IMAGE_MIME_TYPES)) {
      const filename = generateCatalogImageFilename(mime);
      assert.equal(isValidCatalogImageFilename(filename), true, filename);
      assert.match(filename, /^[0-9a-f-]{36}\.(jpg|png|webp|avif)$/);
      assert.doesNotThrow(() => buildCatalogImagePath({ storeId: STORE, productId: PRODUCT, filename }));
    }
    assert.notEqual(generateCatalogImageFilename("image/webp"), generateCatalogImageFilename("image/webp"));
  });

  test("os MIME types do código batem com os do bucket na migration", async () => {
    const migration = await read(new URL("supabase/migrations/20260918220509_create_catalog_images_storage.sql", ROOT));
    for (const mime of Object.keys(CATALOG_IMAGE_MIME_TYPES)) {
      assert.ok(isCatalogImageMimeType(mime));
      assert.ok(migration.includes(`'${mime}'`), `${mime} ausente na migration`);
    }
    assert.equal(isCatalogImageMimeType("image/gif"), false);
    assert.ok(migration.includes(`'${CATALOG_IMAGES_BUCKET}'`));
  });
});

describe("barreira server-only", () => {
  test("admin client e helper de Storage declaram import \"server-only\"", async () => {
    for (const file of SERVER_ONLY_MODULES) {
      const source = await read(new URL(file, ROOT));
      assert.match(source, /^import "server-only";/m, file);
    }
  });

  test("nenhum Client Component alcança o admin client ou o helper de Storage", async () => {
    const files = await listFiles(SRC, isSource);
    const sources = new Map(await Promise.all(files.map(async (file) => [file, await read(file)])));
    const clientEntries = files.filter((file) => /^\s*["']use client["']/.test(sources.get(file)));
    assert.ok(clientEntries.length > 0, "esperava encontrar Client Components no projeto");

    const forbidden = SERVER_ONLY_MODULES.map((file) => decodeURIComponent(new URL(file, ROOT).pathname).replace(/^\/+/, ""));
    const seen = new Set();
    const queue = [...clientEntries];

    while (queue.length > 0) {
      const file = queue.pop();
      if (seen.has(file)) continue;
      seen.add(file);

      assert.ok(!forbidden.includes(file), `um Client Component alcança ${file}`);

      const source = sources.get(file) ?? "";

      // Um módulo "use server" é fronteira, como a rede: o Next troca os imports por
      // referências de Server Action e nada do servidor entra no bundle do cliente.
      // A travessia para aqui, igual ao que o bundler faz.
      if (/^\s*["']use server["']/.test(source)) continue;

      for (const specifier of extractImports(source)) {
        assert.notEqual(specifier, "server-only", `${file} é client e importa server-only`);
        for (const candidate of resolveImport(specifier, file) ?? []) {
          if (sources.has(candidate)) queue.push(candidate);
        }
      }
    }
  });

  test("a service_role só aparece no admin client, nunca com prefixo NEXT_PUBLIC", async () => {
    const files = await listFiles(SRC, isSource);
    for (const file of files) {
      const source = await read(file);
      assert.ok(!source.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE"), file);
      if (source.includes("SUPABASE_SERVICE_ROLE_KEY")) {
        assert.equal(file.endsWith("src/lib/supabase/admin.ts"), true, `service_role citada em ${file}`);
      }
    }
  });

  test("os clientes sujeitos à RLS continuam separados do admin", async () => {
    for (const file of ["src/lib/supabase/client.ts", "src/lib/supabase/server.ts"]) {
      const source = await read(new URL(file, ROOT));
      assert.ok(!source.includes("SERVICE_ROLE"), file);
      assert.match(source, /NEXT_PUBLIC_SUPABASE_ANON_KEY|getSupabaseEnv/, file);
    }
  });
});

describe("nenhuma exposição pública do Storage", () => {
  test("não existe route handler nem middleware no projeto", async () => {
    const handlers = await listFiles(SRC, (name) => /^(route|middleware|proxy)\.(ts|tsx|js|mjs)$/.test(name));
    assert.deepEqual(handlers, []);
  });

  test("nada importa o helper de Storage ainda (não está ligado a página ou endpoint)", async () => {
    const files = await listFiles(SRC, isSource);
    for (const file of files) {
      if (file.endsWith("src/lib/storage/catalog-images.ts")) continue;
      for (const specifier of extractImports(await read(file))) {
        assert.ok(!/storage\/catalog-images$/.test(specifier), `${file} importa o helper`);
      }
    }
  });

  test(".env.example lista apenas nomes, sem valores", async () => {
    const example = await read(new URL(".env.example", ROOT));
    const assignments = example.split("\n").filter((line) => line.includes("=") && !line.trimStart().startsWith("#"));
    assert.ok(assignments.length > 0);
    for (const line of assignments) {
      assert.match(line, /^[A-Z0-9_]+=$/, `valor presente em .env.example: ${line}`);
    }
    assert.ok(example.includes("SUPABASE_SERVICE_ROLE_KEY"));
  });
});

describe("porta única: nenhum caminho paralelo ao admin client", () => {
  const COMPOSITION_ROOT = "src/lib/storage/catalog-images.ts";
  const PURE_CORES = [
    "src/lib/auth/store-access.ts",
    "src/lib/storage/catalog-images-core.ts",
    "src/lib/storage/catalog-image-path.ts",
  ];

  /** Arquivos de src (caminho relativo à raiz) que contêm cada termo. */
  async function filesContaining(...terms) {
    const files = await listFiles(SRC, isSource);
    const rootPath = decodeURIComponent(ROOT.pathname).replace(/^\/+/, "");
    const found = new Map(terms.map((term) => [term, []]));

    for (const file of files) {
      const source = await read(file);
      for (const term of terms) {
        if (source.includes(term)) found.get(term).push(file.replace(rootPath, ""));
      }
    }
    return found;
  }

  test("service_role, createAdminClient e o bucket só aparecem na porta única", async () => {
    const found = await filesContaining(
      "SUPABASE_SERVICE_ROLE_KEY",
      "createAdminClient",
      ".storage.from(",
      "CATALOG_IMAGES_BUCKET",
    );

    const sorted = (term) => found.get(term).sort();
    assert.deepEqual(sorted("SUPABASE_SERVICE_ROLE_KEY"), ["src/lib/supabase/admin.ts"]);
    assert.deepEqual(sorted("createAdminClient"), [COMPOSITION_ROOT, "src/lib/supabase/admin.ts"].sort());
    assert.deepEqual(sorted(".storage.from("), [COMPOSITION_ROOT]);
    assert.deepEqual(
      sorted("CATALOG_IMAGES_BUCKET"),
      [COMPOSITION_ROOT, "src/lib/storage/catalog-image-path.ts"].sort(),
    );
  });

  test("as fábricas de autorização e de operações têm um único ponto de composição", async () => {
    const found = await filesContaining("createStoreAccess", "createCatalogImageOperations");
    assert.deepEqual(
      found.get("createStoreAccess").sort(),
      [COMPOSITION_ROOT, "src/lib/auth/store-access.ts"].sort(),
    );
    assert.deepEqual(
      found.get("createCatalogImageOperations").sort(),
      [COMPOSITION_ROOT, "src/lib/storage/catalog-images-core.ts"].sort(),
    );
  });

  test("os núcleos puros não importam Supabase, admin nem server-only, e não leem env", async () => {
    for (const file of PURE_CORES) {
      const source = await read(new URL(file, ROOT));
      for (const specifier of extractImports(source)) {
        assert.ok(
          !/supabase|server-only/.test(specifier),
          `${file} importa ${specifier}`,
        );
      }
      assert.ok(!source.includes("process.env"), `${file} lê variável de ambiente`);
    }
  });

  test("a porta única autoriza com o cliente de sessão, não com o admin", async () => {
    const source = await read(new URL(COMPOSITION_ROOT, ROOT));
    // Identidade e vínculo são lidos com o cliente de sessão (sob RLS), uma vez cada.
    assert.equal(source.match(/createSessionClient\(\)/g)?.length, 2);
    assert.match(source, /getAuthenticatedUserId/);
    assert.match(source, /getMembershipRole/);

    // Todo uso do cliente de sessão precede todo uso do admin: a autorização é montada
    // antes de qualquer coisa privilegiada.
    assert.ok(
      source.lastIndexOf("createSessionClient()") < source.indexOf("createAdminClient()"),
      "uso do admin client aparece antes da autorização de sessão",
    );
  });
});

describe("limitações", () => {
  test.todo("upload/remove/signedUrl reais contra o Storage do Supabase (dependem do remoto/staging)");
  test.todo("verificar em runtime que o bundle do cliente não contém a service_role (depende de build com env real)");
});
