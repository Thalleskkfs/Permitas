import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { A, C, D, S1, asAnon, asService, asSuperuser, asUser, setupDatabase } from "./support/harness.mjs";

const BUCKET = "catalog-images";
const P1 = "30000000-0000-0000-0000-000000000001";
const OBJ = `${S1}/${P1}/0d6f3c1a-7e5b-4a52-9c1d-2b8e6f4a7c10.webp`;

// Um objeto pré-existente (inserido como superusuário, fora das regras) serve para
// provar que ninguém além do service_role consegue enxergá-lo ou apagá-lo.
const storageSeed = `
  insert into public.products (id, store_id, name, slug, price_cents)
    values ('${P1}', '${S1}', 'Produto 1', 'produto-1', 1000);
  insert into storage.objects (bucket_id, name) values ('${BUCKET}', '${OBJ}');
`;

const { run, rows } = setupDatabase(storageSeed);

const ACTORS = [
  ["anon", asAnon],
  ["owner A", asUser(A)],
  ["editor D", asUser(D)],
  ["sem vínculo C", asUser(C)],
];

describe("configuração do bucket", () => {
  test("bucket existe e é privado", async () => {
    const [bucket] = await rows(asSuperuser, `select id, public from storage.buckets where id = '${BUCKET}'`);
    assert.equal(bucket.id, BUCKET);
    assert.equal(bucket.public, false);
  });

  test("nenhum bucket público existe", async () => {
    assert.deepEqual(await rows(asSuperuser, `select id from storage.buckets where public is true`), []);
  });

  test("limite de 5 MiB por arquivo", async () => {
    const [bucket] = await rows(asSuperuser, `select file_size_limit from storage.buckets where id = '${BUCKET}'`);
    assert.equal(Number(bucket.file_size_limit), 5 * 1024 * 1024);
  });

  test("somente os 4 MIME types de imagem são aceitos na configuração", async () => {
    const [bucket] = await rows(asSuperuser, `select allowed_mime_types from storage.buckets where id = '${BUCKET}'`);
    assert.deepEqual([...bucket.allowed_mime_types].sort(), ["image/avif", "image/jpeg", "image/png", "image/webp"]);
    for (const forbidden of ["image/svg+xml", "image/gif", "application/pdf", "text/html", "*/*"]) {
      assert.ok(!bucket.allowed_mime_types.includes(forbidden), forbidden);
    }
  });

  test("reaplicar a configuração mantém o bucket privado (on conflict do update)", async () => {
    await run(
      asSuperuser,
      `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
       values ('${BUCKET}', '${BUCKET}', false, 5242880, array['image/jpeg','image/png','image/webp','image/avif'])
       on conflict (id) do update set public = excluded.public`,
    );
    const [bucket] = await rows(asSuperuser, `select public from storage.buckets where id = '${BUCKET}'`);
    assert.equal(bucket.public, false);
  });
});

describe("nenhuma policy nossa em storage", () => {
  test("o schema storage não tem policy alguma", async () => {
    assert.deepEqual(await rows(asSuperuser, `select policyname from pg_policies where schemaname = 'storage'`), []);
  });

  test("RLS continua ativo em storage.objects e storage.buckets", async () => {
    const tables = await rows(
      asSuperuser,
      `select relname, relrowsecurity from pg_class
       where oid in ('storage.objects'::regclass, 'storage.buckets'::regclass) order by relname`,
    );
    assert.deepEqual(tables, [
      { relname: "buckets", relrowsecurity: true },
      { relname: "objects", relrowsecurity: true },
    ]);
  });

  test("a função private.can_access_catalog_image não existe mais", async () => {
    const found = await rows(
      asSuperuser,
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'private' and p.proname = 'can_access_catalog_image'`,
    );
    assert.deepEqual(found, []);
  });

  test("as demais funções private.* das etapas anteriores continuam existindo", async () => {
    const found = await rows(
      asSuperuser,
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'private' order by p.proname`,
    );
    assert.deepEqual(found.map((r) => r.proname), [
      "is_store_member",
      "is_store_owner",
      "prevent_category_cycle",
      "protect_last_store_owner",
      "set_updated_at",
    ]);
  });
});

describe("acesso direto ao Storage é negado (bucket sem policy)", () => {
  for (const [label, actor] of ACTORS) {
    test(`${label}: não lê nenhum objeto`, async () => {
      assert.deepEqual(await rows(actor, `select name from storage.objects`), []);
      assert.deepEqual(await rows(actor, `select name from storage.objects where name = $1`, [OBJ]), []);
    });

    test(`${label}: não grava, altera nem exclui`, async () => {
      await assert.rejects(
        run(actor, `insert into storage.objects (bucket_id, name) values ($1, $2)`, [BUCKET, `${S1}/${P1}/nova.webp`]),
        { message: /row-level security/ },
      );
      assert.deepEqual(await rows(actor, `update storage.objects set name = 'x' where name = $1 returning 1`, [OBJ]), []);
      assert.deepEqual(await rows(actor, `delete from storage.objects where name = $1 returning 1`, [OBJ]), []);
    });

    test(`${label}: não enxerga o bucket`, async () => {
      assert.deepEqual(await rows(actor, `select id from storage.buckets`), []);
    });
  }

  test("nem o owner da loja dona do objeto tem acesso", async () => {
    const [product] = await rows(asUser(A), `select store_id from public.products where id = '${P1}'`);
    assert.equal(product.store_id, S1, "A enxerga o produto, logo é membro da loja dona do objeto");
    assert.deepEqual(await rows(asUser(A), `select name from storage.objects`), []);
  });
});

describe("service_role: única via de acesso, usada apenas no servidor", () => {
  test("lê, grava e exclui objetos", async () => {
    assert.deepEqual((await rows(asService, `select name from storage.objects`)).map((r) => r.name), [OBJ]);
    await run(asService, `insert into storage.objects (bucket_id, name) values ($1, $2)`, [BUCKET, `${S1}/${P1}/nova.webp`]);
    assert.equal((await rows(asService, `delete from storage.objects where name = $1 returning 1`, [OBJ])).length, 1);
  });

  test("enxerga o bucket", async () => {
    assert.deepEqual((await rows(asService, `select id from storage.buckets`)).map((r) => r.id), [BUCKET]);
  });
});

describe("limitações do ambiente local", () => {
  test.todo("enforcement real de allowed_mime_types e file_size_limit pela API do Storage (só no remoto/staging)");
  test.todo("upload, signed URL e listagem reais via API do Storage com service_role (só no remoto/staging)");
  test.todo("confirmar no remoto que a migration cria o bucket sem erro de permissão");
});
