import assert from "node:assert/strict";
import { afterEach, beforeEach } from "node:test";
import { createMigratedDb } from "./db.mjs";

export const A = "00000000-0000-0000-0000-00000000000a"; // owner da loja 1
export const B = "00000000-0000-0000-0000-00000000000b"; // owner da loja 2
export const C = "00000000-0000-0000-0000-00000000000c"; // sem membership
export const D = "00000000-0000-0000-0000-00000000000d"; // editor da loja 1
export const S1 = "10000000-0000-0000-0000-000000000001";
export const S2 = "10000000-0000-0000-0000-000000000002";

export const RLS = /row-level security/;
export const DENIED = /permission denied/;

export const baseSeed = `
  insert into auth.users (id, email) values
    ('${A}', 'a@test'), ('${B}', 'b@test'), ('${C}', 'c@test'), ('${D}', 'd@test');
  insert into public.stores (id, name, slug, updated_at) values
    ('${S1}', 'Loja Um', 'loja-um', now() - interval '1 day'),
    ('${S2}', 'Loja Dois', 'loja-dois', now() - interval '1 day');
  insert into public.store_members (store_id, user_id, role) values
    ('${S1}', '${A}', 'owner'), ('${S1}', '${D}', 'editor'), ('${S2}', '${B}', 'owner');
  insert into public.store_domains (store_id, domain, is_primary, verified) values
    ('${S1}', 'loja-um.example.com', true, true),
    ('${S2}', 'loja-dois.example.com', true, true);
  insert into public.store_settings (store_id, whatsapp_number, whatsapp_message_template) values
    ('${S1}', '+5511999990001', 'Olá, loja 1'), ('${S2}', '+5511999990002', 'Olá, loja 2');
  insert into public.profiles (id, full_name) values ('${A}', 'Usuário A'), ('${B}', 'Usuário B');
`;

export const asAnon = { role: "anon" };
export const asUser = (id) => ({ role: "authenticated", sub: id });
export const asService = { role: "service_role" };
export const asSuperuser = {};

// Registra hooks que criam um banco novo (migrations + seed) para cada teste do arquivo.
export function setupDatabase(extraSeed = "") {
  let db;

  beforeEach(async () => {
    db = await createMigratedDb();
    await db.exec(baseSeed);
    if (extraSeed) await db.exec(extraSeed);
  });

  afterEach(async () => {
    await db.close();
  });

  async function run(actor, sql, params = []) {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [actor.sub ?? ""]);
    if (actor.role) await db.exec(`set role ${actor.role}`);
    try {
      return await db.query(sql, params);
    } finally {
      await db.exec("reset role");
    }
  }

  const rows = async (actor, sql, params) => (await run(actor, sql, params)).rows;

  const fails = (actor, sql, expected, params) =>
    assert.rejects(
      run(actor, sql, params),
      expected instanceof RegExp ? { message: expected } : { code: expected },
    );

  return { run, rows, fails };
}
