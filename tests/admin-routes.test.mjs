import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { describe, test } from "node:test";

const ROOT = new URL("../", import.meta.url);
const SRC = new URL("src/", ROOT);
const APP = new URL("src/app/", ROOT);

const AUTH_MODULES = [
  "src/lib/auth/admin-guard.ts",
  "src/lib/auth/admin-access.ts",
  "src/lib/auth/admin-auth.ts",
  "src/modules/auth/actions.ts",
];

const PURE_AUTH_CORES = ["src/lib/auth/admin-access.ts", "src/lib/auth/admin-auth.ts"];

async function listFiles(dir, filter) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile() && filter(entry.name))
    .map((entry) => `${entry.parentPath}/${entry.name}`.replaceAll("\\", "/"));
}

const isSource = (name) => /\.(ts|tsx)$/.test(name);
const read = (file) => readFile(file, "utf8");
const readRelative = (relative) => readFile(new URL(relative, ROOT), "utf8");
const rootPath = decodeURIComponent(ROOT.pathname).replace(/^\/+/, "");
const relative = (file) => file.replace(rootPath, "");

const extractImports = (source) =>
  [...source.matchAll(/(?:from\s*|import\s*)["']([^"']+)["']/g)].map((match) => match[1]);

function resolveImport(specifier, fromFile) {
  let base;
  if (specifier.startsWith("@/")) base = new URL(specifier.slice(2), SRC);
  else if (specifier.startsWith(".")) base = new URL(specifier, `file:///${fromFile}`);
  else return [];

  const path = decodeURIComponent(base.pathname).replace(/^\/+/, "");
  return /\.(ts|tsx)$/.test(path)
    ? [path]
    : [`${path}.ts`, `${path}.tsx`, `${path}/index.ts`, `${path}/index.tsx`];
}

const allSources = async () => {
  const files = await listFiles(SRC, isSource);
  return new Map(await Promise.all(files.map(async (file) => [file, await read(file)])));
};

describe("não existe autenticação pública", () => {
  test("nenhuma rota pública de login, cadastro ou conta de cliente", async () => {
    const routeFiles = await listFiles(APP, (name) => /^(page|route|layout)\.(ts|tsx)$/.test(name));
    const publicRoutes = routeFiles.map(relative).filter((file) => !file.includes("/admin/"));

    for (const file of publicRoutes) {
      assert.doesNotMatch(
        file,
        /(^|\/)\(?(login|entrar|cadastro|signup|sign-up|registrar|conta|minha-conta|account|auth)\)?\//i,
        `rota pública de autenticação: ${file}`,
      );
    }

    // O storefront tem apenas catálogo, produto e carrinho.
    const storefront = routeFiles.map(relative).filter((file) => file.includes("(storefront)"));
    assert.ok(storefront.length > 0, "esperava rotas de storefront");
    for (const file of storefront) {
      assert.doesNotMatch(file, /login|cadastro|senha|mfa|conta/i, file);
    }
  });

  test("as telas de acesso existem somente sob /admin", async () => {
    for (const page of [
      "src/app/(admin)/admin/(auth)/login/page.tsx",
      "src/app/(admin)/admin/(auth)/recuperar-senha/page.tsx",
      "src/app/(admin)/admin/(auth)/redefinir-senha/page.tsx",
      "src/app/(admin)/admin/(auth)/mfa/page.tsx",
      "src/app/(admin)/admin/(auth)/sem-loja/page.tsx",
    ]) {
      await assert.doesNotReject(readRelative(page), `faltando: ${page}`);
    }
  });

  test("nenhum fluxo cria conta: não há signUp em lugar nenhum", async () => {
    for (const [file, source] of await allSources()) {
      assert.doesNotMatch(source, /\.signUp\s*\(/, `${relative(file)} cria usuário`);
      assert.doesNotMatch(source, /admin\.createUser\s*\(/, `${relative(file)} cria usuário`);
    }
  });

  test("não há magic link, OTP, OAuth nem login por telefone", async () => {
    for (const [file, source] of await allSources()) {
      for (const forbidden of [
        /signInWithOtp\s*\(/,
        /signInWithOAuth\s*\(/,
        /signInWithIdToken\s*\(/,
        /verifyOtp\s*\(/,
        /signInAnonymously\s*\(/,
      ]) {
        assert.doesNotMatch(source, forbidden, `${relative(file)} usa método proibido`);
      }
    }
  });

  test("não existe endpoint próprio de autenticação", async () => {
    const handlers = await listFiles(SRC, (name) =>
      /^(route|middleware|proxy)\.(ts|tsx|js|mjs)$/.test(name),
    );
    // Única exceção: serve as fotos do bucket privado (next.config.ts documenta o porquê).
    // Não tem nada de autenticação — qualquer OUTRO route handler ainda derruba o teste.
    const ROTAS_CONHECIDAS = ["src/app/imagens/[...path]/route.ts"];
    const inesperadas = handlers.map(relative).filter((file) => !ROTAS_CONHECIDAS.includes(file));
    assert.deepEqual(inesperadas, [], "nenhum route handler além dos já revisados deve existir");
  });
});

describe("toda rota administrativa passa pelo guarda", () => {
  test("as páginas do painel ficam sob o layout protegido", async () => {
    const pages = (await listFiles(APP, (name) => name === "page.tsx"))
      .map(relative)
      .filter((file) => file.includes("/admin/"));

    const panel = pages.filter((file) => file.includes("(panel)"));
    const auth = pages.filter((file) => file.includes("(auth)"));

    assert.equal(panel.length + auth.length, pages.length, "toda página de /admin está em um dos grupos");
    // Eram 12; "Clientes" e "Pedidos" saíram (a loja não tem conta de cliente nem pedido
    // registrado — tudo se resolve no WhatsApp) e "Banners" entrou, resultando em 11.
    assert.equal(panel.length, 11, "as 11 telas do painel continuam existindo");
    assert.ok(auth.length >= 5);
  });

  test("o layout do painel exige acesso antes de renderizar", async () => {
    const source = await readRelative("src/app/(admin)/admin/(panel)/layout.tsx");

    // indexOf devolve -1 quando some: comparar direto deixaria a ausência passar.
    const guardCall = source.indexOf("await requireAdminAccess()");
    const content = source.indexOf("<DashboardShell");
    assert.ok(guardCall >= 0, "o layout precisa chamar await requireAdminAccess()");
    assert.ok(content >= 0, "o layout precisa renderizar o painel");
    assert.ok(guardCall < content, "o guarda precisa rodar antes do conteúdo");

    assert.match(source, /force-dynamic/, "a área autenticada não pode ser pré-renderizada");
  });

  test("o guarda valida identidade com getUser, não com getSession", async () => {
    const source = await readRelative("src/lib/auth/admin-guard.ts");
    assert.match(source, /auth\.getUser\(\)/);
    assert.doesNotMatch(source, /auth\.getSession\s*\(/);
    assert.match(source, /mfa\.getAuthenticatorAssuranceLevel/);
    assert.match(source, /store_members/);
  });

  test("nenhuma página pública importa módulos de autenticação administrativa", async () => {
    const sources = await allSources();
    const forbidden = AUTH_MODULES.map((file) =>
      decodeURIComponent(new URL(file, ROOT).pathname).replace(/^\/+/, ""),
    );

    const publicEntries = [...sources.keys()].filter(
      (file) => relative(file).includes("(storefront)") || relative(file).endsWith("src/app/page.tsx"),
    );
    assert.ok(publicEntries.length > 0);

    const seen = new Set();
    const queue = [...publicEntries];
    while (queue.length > 0) {
      const file = queue.pop();
      if (seen.has(file)) continue;
      seen.add(file);

      assert.ok(!forbidden.includes(file), `página pública alcança ${relative(file)}`);
      for (const specifier of extractImports(sources.get(file) ?? "")) {
        for (const candidate of resolveImport(specifier, file)) {
          if (sources.has(candidate)) queue.push(candidate);
        }
      }
    }
  });
});

describe("higiene de segredos e de limites", () => {
  test("o service_role não participa do login", async () => {
    for (const file of AUTH_MODULES) {
      const source = await readRelative(file);
      assert.doesNotMatch(source, /createAdminClient|SERVICE_ROLE/, `${file} usa service_role`);
    }
  });

  test("nada de senha, token ou código vai para log", async () => {
    for (const file of AUTH_MODULES) {
      const source = await readRelative(file);
      assert.doesNotMatch(source, /console\.(log|info|warn|error|debug)/, `${file} registra em log`);
    }
  });

  test("não há contador de tentativas nem bloqueio por IP na aplicação", async () => {
    for (const [file, source] of await allSources()) {
      for (const forbidden of [/x-forwarded-for/i, /\brequest\.ip\b/, /rateLimitStore|attemptCount|blockedIps/i]) {
        assert.doesNotMatch(source, forbidden, `${relative(file)} implementa limite próprio`);
      }
    }
  });

  test("apenas a site key pública do captcha aparece no repositório", async () => {
    const example = await readRelative(".env.example");
    assert.match(example, /NEXT_PUBLIC_TURNSTILE_SITE_KEY=$/m);
    assert.doesNotMatch(example, /TURNSTILE_SECRET|HCAPTCHA_SECRET/);

    for (const line of example.split("\n").filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))) {
      assert.match(line, /^[A-Z0-9_]+=$/, `valor presente em .env.example: ${line}`);
    }

    // A config só lê a chave pública; nenhuma secret é lida do ambiente da aplicação.
    const config = await readRelative("src/config/auth.ts");
    assert.match(config, /process\.env\.NEXT_PUBLIC_TURNSTILE_SITE_KEY/);
    assert.doesNotMatch(config, /process\.env\.[A-Z_]*SECRET/);

    for (const [file, source] of await allSources()) {
      assert.doesNotMatch(
        source,
        /process\.env\.[A-Z_]*(TURNSTILE|HCAPTCHA)[A-Z_]*SECRET/,
        `${relative(file)} lê a secret do captcha`,
      );
    }
  });

  test("os núcleos de autenticação continuam puros e testáveis", async () => {
    for (const file of PURE_AUTH_CORES) {
      const source = await readRelative(file);
      assert.deepEqual(extractImports(source), [], `${file} não deve ter imports`);
      assert.doesNotMatch(source, /process\.env/, `${file} não deve ler ambiente`);
    }
  });

  test("as ações de autenticação passam pelo Supabase Auth", async () => {
    const source = await readRelative("src/modules/auth/actions.ts");
    assert.match(source, /^"use server";/m);
    for (const expected of [
      /auth\.signInWithPassword/,
      /auth\.resetPasswordForEmail/,
      /auth\.updateUser/,
      /auth\.mfa\.enroll/,
      /auth\.mfa\.verify/,
      /auth\.signOut/,
    ]) {
      assert.match(source, expected);
    }
    assert.match(source, /captchaToken/, "o token do captcha é repassado ao Supabase");
  });
});
