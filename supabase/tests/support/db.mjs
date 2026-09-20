import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const migrationsDir = new URL("../../migrations/", import.meta.url);

// Simula o ambiente do Supabase: papéis, auth.users, auth.uid() e os privilégios
// padrão que o Supabase concede em tabelas novas (a migration precisa revogá-los).
export const supabaseBootstrap = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
  $$;
  grant usage on schema auth, public to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;

  -- Simulação MÍNIMA do schema storage do Supabase: só o suficiente para a migration
  -- configurar o bucket e para verificar que ninguém ganhou acesso a storage.objects.
  --
  -- Fiel ao serviço real em dois pontos que importam: RLS ativo nas duas tabelas (como
  -- verificado no projeto remoto) e grants permissivos para anon/authenticated — no
  -- Supabase quem barra é a RLS, não o grant. Partir dos grants abertos torna o teste
  -- mais severo: se mesmo assim o acesso é negado, é porque não existe policy alguma.
  --
  -- NÃO reproduz a API do Storage: upload, enforcement de MIME e tamanho, listagem e
  -- URLs assinadas não são exercitados aqui (ver testes marcados como todo).
  create schema storage;
  create table storage.buckets (
    id text primary key,
    name text not null unique,
    created_at timestamptz default now(),
    public boolean default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text,
    created_at timestamptz default now(),
    unique (bucket_id, name)
  );
  alter table storage.buckets enable row level security;
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated, service_role;
  grant all on all tables in schema storage to anon, authenticated, service_role;
`;

export async function createMigratedDb() {
  const db = new PGlite();
  await db.exec(supabaseBootstrap);
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    await db.exec(await readFile(new URL(file, migrationsDir), "utf8"));
  }
  return db;
}
