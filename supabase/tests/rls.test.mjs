import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  A, B, C, D, S1, S2, RLS, DENIED,
  asAnon, asService, asSuperuser, asUser, setupDatabase,
} from "./support/harness.mjs";

const { run, rows, fails } = setupDatabase();

describe("estrutura e privilégios", () => {
  test("todas as tabelas de public têm RLS ativo", async () => {
    const unprotected = await rows(
      asSuperuser,
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    );
    assert.deepEqual(unprotected, []);
  });

  test("anon não tem privilégio algum; authenticated não tem os proibidos", async () => {
    const privilege = async (sql) => (await rows(asSuperuser, sql))[0].ok;
    for (const table of ["profiles", "stores", "store_members", "store_domains", "store_settings"]) {
      for (const op of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
        assert.equal(
          await privilege(`select has_table_privilege('anon', 'public.${table}', '${op}') as ok`),
          false,
          `anon ${op} ${table}`,
        );
      }
    }
    assert.equal(await privilege(`select has_table_privilege('authenticated', 'public.stores', 'INSERT') as ok`), false);
    assert.equal(await privilege(`select has_table_privilege('authenticated', 'public.stores', 'DELETE') as ok`), false);
    assert.equal(await privilege(`select has_column_privilege('authenticated', 'public.stores', 'slug', 'UPDATE') as ok`), false);
    assert.equal(await privilege(`select has_column_privilege('authenticated', 'public.stores', 'active', 'UPDATE') as ok`), false);
    assert.equal(await privilege(`select has_column_privilege('authenticated', 'public.store_domains', 'verified', 'INSERT') as ok`), false);
    assert.equal(await privilege(`select has_column_privilege('authenticated', 'public.store_domains', 'verified', 'UPDATE') as ok`), false);
  });
});

describe("anon (público)", () => {
  test("não lê nenhuma tabela", async () => {
    for (const table of ["profiles", "stores", "store_members", "store_domains", "store_settings"]) {
      await fails(asAnon, `select * from public.${table}`, DENIED);
    }
  });

  test("não escreve", async () => {
    await fails(asAnon, `insert into public.stores (name, slug) values ('x', 'loja-x')`, DENIED);
  });

  test("não executa as funções auxiliares privadas", async () => {
    await fails(asAnon, `select private.is_store_member('${S1}')`, DENIED);
  });
});

describe("isolamento: usuário A não acessa a loja B", () => {
  test("A lê apenas dados da própria loja", async () => {
    const stores = await rows(asUser(A), `select id from public.stores`);
    assert.deepEqual(stores.map((r) => r.id), [S1]);
    for (const table of ["store_members", "store_domains", "store_settings"]) {
      const data = await rows(asUser(A), `select store_id from public.${table}`);
      assert.ok(data.length > 0, table);
      assert.ok(data.every((r) => r.store_id === S1), `${table} vazou dados da loja B`);
    }
  });

  test("A não altera nem remove dados da loja B", async () => {
    const updated = await rows(asUser(A), `update public.stores set name = 'invadida' where id = '${S2}' returning id`);
    assert.equal(updated.length, 0);
    assert.equal((await rows(asUser(A), `update public.store_settings set whatsapp_number = '+5511900000000' where store_id = '${S2}' returning store_id`)).length, 0);
    assert.equal((await rows(asUser(A), `update public.store_domains set is_primary = false where store_id = '${S2}' returning id`)).length, 0);
    assert.equal((await rows(asUser(A), `delete from public.store_domains where store_id = '${S2}' returning id`)).length, 0);
    assert.equal((await rows(asUser(A), `delete from public.store_members where store_id = '${S2}' returning id`)).length, 0);

    const [store] = await rows(asSuperuser, `select name from public.stores where id = '${S2}'`);
    assert.equal(store.name, "Loja Dois");
    const [settings] = await rows(asSuperuser, `select whatsapp_number from public.store_settings where store_id = '${S2}'`);
    assert.equal(settings.whatsapp_number, "+5511999990002");
  });

  test("A não cria membros, domínios ou configurações na loja B", async () => {
    await fails(asUser(A), `insert into public.store_members (store_id, user_id, role) values ('${S2}', '${C}', 'editor')`, RLS);
    await fails(asUser(A), `insert into public.store_domains (store_id, domain) values ('${S2}', 'invasor.example.com')`, RLS);
    await fails(asUser(A), `insert into public.store_settings (store_id) values ('${S2}')`, /duplicate key|row-level security/);
  });

  test("A não move um membro da própria loja para a loja B", async () => {
    await fails(asUser(A), `update public.store_members set store_id = '${S2}' where store_id = '${S1}' and user_id = '${D}'`, DENIED);
  });

  test("store_id enviado pelo cliente não concede acesso", async () => {
    const data = await rows(asUser(A), `select * from public.store_settings where store_id = '${S2}'`);
    assert.equal(data.length, 0);
  });
});

describe("usuário sem membership (C)", () => {
  test("não enxerga nenhuma loja", async () => {
    for (const table of ["stores", "store_members", "store_domains", "store_settings"]) {
      assert.equal((await rows(asUser(C), `select 1 from public.${table}`)).length, 0, table);
    }
  });

  test("não consegue se adicionar a uma loja nem escalar para owner", async () => {
    await fails(asUser(C), `insert into public.store_members (store_id, user_id, role) values ('${S1}', '${C}', 'owner')`, RLS);
    await fails(asUser(C), `insert into public.store_members (store_id, user_id, role) values ('${S1}', '${C}', 'editor')`, RLS);
    await fails(asUser(C), `insert into public.store_settings (store_id) values ('${S1}')`, /duplicate key|row-level security/);
  });
});

describe("owner (A) administra a própria loja", () => {
  test("atualiza nome, descrição e logo; updated_at é renovado", async () => {
    const [row] = await rows(
      asUser(A),
      `update public.stores set name = 'Novo nome', description = 'Nova', logo_url = 'https://x.test/l.png'
       where id = '${S1}' returning name, updated_at`,
    );
    assert.equal(row.name, "Novo nome");
    const [{ recent }] = await rows(asSuperuser, `select updated_at > now() - interval '1 hour' as recent from public.stores where id = '${S1}'`);
    assert.equal(recent, true);
  });

  test("não altera slug nem active (controlados pela plataforma)", async () => {
    await fails(asUser(A), `update public.stores set slug = 'outro-slug' where id = '${S1}'`, DENIED);
    await fails(asUser(A), `update public.stores set active = false where id = '${S1}'`, DENIED);
  });

  test("não cria nem apaga lojas", async () => {
    await fails(asUser(A), `insert into public.stores (name, slug) values ('Nova', 'loja-nova')`, DENIED);
    await fails(asUser(A), `delete from public.stores where id = '${S1}'`, DENIED);
  });

  test("gerencia domínios sem poder se auto-verificar", async () => {
    const [added] = await rows(asUser(A), `insert into public.store_domains (store_id, domain) values ('${S1}', 'novo.example.com') returning id, verified, is_primary`);
    assert.equal(added.verified, false);
    assert.equal(added.is_primary, false);

    await fails(asUser(A), `insert into public.store_domains (store_id, domain, verified) values ('${S1}', 'auto.example.com', true)`, DENIED);
    await fails(asUser(A), `update public.store_domains set verified = true where id = '${added.id}'`, DENIED);
    await fails(asUser(A), `update public.store_domains set domain = 'outro.example.com' where id = '${added.id}'`, DENIED);
    await fails(asUser(A), `update public.store_domains set is_primary = true where id = '${added.id}'`, "23514");

    assert.equal((await rows(asUser(A), `delete from public.store_domains where id = '${added.id}' returning id`)).length, 1);
  });

  test("domínios inválidos ou duplicados são rejeitados", async () => {
    await fails(asUser(A), `insert into public.store_domains (store_id, domain) values ('${S1}', 'Loja.Example.com')`, "23514");
    await fails(asUser(A), `insert into public.store_domains (store_id, domain) values ('${S1}', 'semponto')`, "23514");
    await fails(asUser(A), `insert into public.store_domains (store_id, domain) values ('${S1}', 'https://x.example.com')`, "23514");
    await fails(asUser(A), `insert into public.store_domains (store_id, domain) values ('${S1}', 'loja-dois.example.com')`, "23505");
  });

  test("atualiza configurações; número de WhatsApp inválido é rejeitado", async () => {
    const [row] = await rows(asUser(A), `update public.store_settings set whatsapp_number = '+5511988887777' where store_id = '${S1}' returning whatsapp_number`);
    assert.equal(row.whatsapp_number, "+5511988887777");
    await fails(asUser(A), `update public.store_settings set whatsapp_number = '11988887777' where store_id = '${S1}'`, "23514");
    await fails(asUser(A), `update public.store_settings set store_id = '${S2}' where store_id = '${S1}'`, DENIED);
  });

  test("gerencia membros (adicionar, promover, remover)", async () => {
    await run(asUser(A), `insert into public.store_members (store_id, user_id, role) values ('${S1}', '${C}', 'editor')`);
    const [promoted] = await rows(asUser(A), `update public.store_members set role = 'owner' where store_id = '${S1}' and user_id = '${C}' returning role`);
    assert.equal(promoted.role, "owner");
    assert.equal((await rows(asUser(A), `delete from public.store_members where store_id = '${S1}' and user_id = '${C}' returning id`)).length, 1);
    await fails(asUser(A), `insert into public.store_members (store_id, user_id, role) values ('${S1}', '${C}', 'admin')`, "22P02");
  });
});

describe("editor (D) não recebe permissões de owner", () => {
  test("lê a loja, a equipe, os domínios e as configurações", async () => {
    for (const table of ["stores", "store_members", "store_domains", "store_settings"]) {
      assert.ok((await rows(asUser(D), `select 1 from public.${table}`)).length > 0, table);
    }
  });

  test("não altera loja nem configurações", async () => {
    assert.equal((await rows(asUser(D), `update public.stores set name = 'x' where id = '${S1}' returning id`)).length, 0);
    assert.equal((await rows(asUser(D), `update public.store_settings set whatsapp_number = '+5511900000000' where store_id = '${S1}' returning store_id`)).length, 0);
    const [store] = await rows(asSuperuser, `select name from public.stores where id = '${S1}'`);
    assert.equal(store.name, "Loja Um");
  });

  test("não gerencia domínios nem membros e não se promove a owner", async () => {
    await fails(asUser(D), `insert into public.store_domains (store_id, domain) values ('${S1}', 'editor.example.com')`, RLS);
    await fails(asUser(D), `insert into public.store_members (store_id, user_id, role) values ('${S1}', '${C}', 'editor')`, RLS);
    assert.equal((await rows(asUser(D), `update public.store_members set role = 'owner' where user_id = '${D}' returning id`)).length, 0);
    assert.equal((await rows(asUser(D), `delete from public.store_members where user_id = '${A}' returning id`)).length, 0);
    assert.equal((await rows(asUser(D), `delete from public.store_domains where store_id = '${S1}' returning id`)).length, 0);
    const [member] = await rows(asSuperuser, `select role from public.store_members where user_id = '${D}'`);
    assert.equal(member.role, "editor");
  });
});

describe("profiles", () => {
  test("cada usuário acessa apenas o próprio perfil", async () => {
    const own = await rows(asUser(A), `select id from public.profiles`);
    assert.deepEqual(own.map((r) => r.id), [A]);
    assert.equal((await rows(asUser(A), `update public.profiles set full_name = 'hack' where id = '${B}' returning id`)).length, 0);
    assert.equal((await rows(asUser(A), `update public.profiles set full_name = 'Novo A' where id = '${A}' returning id`)).length, 1);
  });

  test("não cria perfil para outro usuário", async () => {
    await fails(asUser(C), `insert into public.profiles (id, full_name) values ('${B}', 'x')`, RLS);
    await run(asUser(C), `insert into public.profiles (id, full_name) values ('${C}', 'Usuário C')`);
  });

  test("perfil e vínculo são removidos junto com o usuário do Auth", async () => {
    await run(asService, `update public.store_members set role = 'owner' where store_id = '${S1}' and user_id = '${D}'`);
    await run(asSuperuser, `delete from auth.users where id = '${A}'`);
    assert.equal((await rows(asSuperuser, `select 1 from public.profiles where id = '${A}'`)).length, 0);
    assert.equal((await rows(asSuperuser, `select 1 from public.store_members where user_id = '${A}'`)).length, 0);
  });
});

describe("constraints (via service_role)", () => {
  test("slug: formato, tamanho e unicidade", async () => {
    await fails(asService, `insert into public.stores (name, slug) values ('x', 'Loja-Maiuscula')`, "23514");
    await fails(asService, `insert into public.stores (name, slug) values ('x', 'ab')`, "23514");
    await fails(asService, `insert into public.stores (name, slug) values ('x', 'loja--dupla')`, "23514");
    await fails(asService, `insert into public.stores (name, slug) values ('x', '-loja')`, "23514");
    await fails(asService, `insert into public.stores (name, slug) values ('x', 'loja-um')`, "23505");
  });

  test("apenas um domínio principal por loja, e principal exige verificação", async () => {
    await fails(asService, `insert into public.store_domains (store_id, domain, is_primary, verified) values ('${S1}', 'segundo.example.com', true, true)`, "23505");
    await fails(asService, `insert into public.store_domains (store_id, domain, is_primary, verified) values ('${S1}', 'terceiro.example.com', true, false)`, "23514");
  });

  test("uma configuração por loja e um vínculo por usuário/loja", async () => {
    await fails(asService, `insert into public.store_settings (store_id) values ('${S1}')`, "23505");
    await fails(asService, `insert into public.store_members (store_id, user_id, role) values ('${S1}', '${A}', 'editor')`, "23505");
  });
});

describe("invariante: toda loja mantém pelo menos um owner", () => {
  const LAST_OWNER = /pelo menos um owner/;
  const owners = async (store) =>
    (await rows(asSuperuser, `select user_id from public.store_members where store_id = '${store}' and role = 'owner' order by user_id`)).map((r) => r.user_id);
  const promoteD = () => run(asUser(A), `update public.store_members set role = 'owner' where store_id = '${S1}' and user_id = '${D}'`);

  test("o último owner não pode sair", async () => {
    await fails(asUser(A), `delete from public.store_members where store_id = '${S1}' and user_id = '${A}'`, "23001");
    await fails(asUser(A), `delete from public.store_members where store_id = '${S1}' and user_id = '${A}'`, LAST_OWNER);
    assert.deepEqual(await owners(S1), [A]);
  });

  test("o último owner não pode virar editor", async () => {
    await fails(asUser(A), `update public.store_members set role = 'editor' where store_id = '${S1}' and user_id = '${A}'`, "23001");
    assert.deepEqual(await owners(S1), [A]);
  });

  test("a regra vale também para service_role", async () => {
    await fails(asService, `delete from public.store_members where store_id = '${S1}' and user_id = '${A}'`, "23001");
    await fails(asService, `update public.store_members set role = 'editor' where store_id = '${S1}' and user_id = '${A}'`, "23001");
    await fails(asService, `update public.store_members set store_id = '${S2}' where store_id = '${S1}' and user_id = '${A}'`, "23001");
    assert.deepEqual(await owners(S1), [A]);
  });

  test("com dois owners, um pode sair", async () => {
    await promoteD();
    assert.equal((await rows(asUser(A), `delete from public.store_members where store_id = '${S1}' and user_id = '${A}' returning id`)).length, 1);
    assert.deepEqual(await owners(S1), [D]);
    await fails(asUser(D), `delete from public.store_members where store_id = '${S1}' and user_id = '${D}'`, "23001");
  });

  test("owner transfere a função: promove outro e se rebaixa", async () => {
    await promoteD();
    const [demoted] = await rows(asUser(A), `update public.store_members set role = 'editor' where store_id = '${S1}' and user_id = '${A}' returning role`);
    assert.equal(demoted.role, "editor");
    assert.deepEqual(await owners(S1), [D]);
    const updated = await rows(asUser(D), `update public.stores set name = 'Gerida por D' where id = '${S1}' returning name`);
    assert.equal(updated.length, 1);
    assert.equal((await rows(asUser(A), `update public.stores set name = 'x' where id = '${S1}' returning id`)).length, 0);
  });

  test("dois owners continuam administrando normalmente", async () => {
    await promoteD();
    assert.equal((await rows(asUser(A), `update public.stores set name = 'Por A' where id = '${S1}' returning id`)).length, 1);
    assert.equal((await rows(asUser(D), `update public.stores set name = 'Por D' where id = '${S1}' returning id`)).length, 1);
    await run(asUser(D), `insert into public.store_domains (store_id, domain) values ('${S1}', 'dois-owners.example.com')`);
    await run(asUser(A), `insert into public.store_members (store_id, user_id, role) values ('${S1}', '${C}', 'editor')`);
    assert.equal((await rows(asUser(D), `delete from public.store_members where store_id = '${S1}' and user_id = '${A}' returning id`)).length, 1);
    assert.deepEqual(await owners(S1), [D]);
  });

  test("remover todos os owners de uma vez é bloqueado e nada é removido", async () => {
    await promoteD();
    await fails(asUser(A), `delete from public.store_members where store_id = '${S1}'`, "23001");
    assert.deepEqual(await owners(S1), [A, D]);
    await fails(asUser(A), `update public.store_members set role = 'editor' where store_id = '${S1}'`, "23001");
    assert.deepEqual(await owners(S1), [A, D]);
  });

  test("apagar o usuário do Auth que é o último owner é bloqueado", async () => {
    await fails(asSuperuser, `delete from auth.users where id = '${A}'`, "23001");
    assert.deepEqual(await owners(S1), [A]);
  });

  test("rebaixar ou remover não-owners não é afetado", async () => {
    assert.equal((await rows(asUser(A), `delete from public.store_members where store_id = '${S1}' and user_id = '${D}' returning id`)).length, 1);
    await run(asUser(A), `insert into public.store_members (store_id, user_id, role) values ('${S1}', '${D}', 'editor')`);
    assert.deepEqual(await owners(S1), [A]);
  });

  test("excluir a loja inteira continua funcionando (cascade)", async () => {
    await run(asService, `delete from public.stores where id = '${S1}'`);
    for (const table of ["store_members", "store_domains", "store_settings"]) {
      assert.equal((await rows(asSuperuser, `select 1 from public.${table} where store_id = '${S1}'`)).length, 0, table);
    }
    assert.deepEqual(await owners(S2), [B]);
  });
});

describe("service_role (onboarding)", () => {
  test("cria loja e owner; o owner passa a enxergá-la", async () => {
    const [store] = await rows(asService, `insert into public.stores (name, slug) values ('Loja Três', 'loja-tres') returning id`);
    await run(asService, `insert into public.store_members (store_id, user_id, role) values ('${store.id}', '${C}', 'owner')`);
    await run(asService, `insert into public.store_settings (store_id) values ('${store.id}')`);
    const visible = await rows(asUser(C), `select slug from public.stores`);
    assert.deepEqual(visible.map((r) => r.slug), ["loja-tres"]);
  });
});
