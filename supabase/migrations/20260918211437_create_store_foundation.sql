-- Fundação multi-loja: profiles, stores, store_members, store_domains, store_settings.
--
-- Modelo de acesso:
--   * anon não tem nenhum privilégio (catálogo/público virá em etapa posterior).
--   * authenticated só enxerga lojas das quais é membro; owner administra, editor só lê.
--   * lojas são criadas e ativadas/desativadas via service_role (RLS não se aplica a ele).
--   * a autorização nunca usa store_id vindo do cliente: sempre auth.uid() + store_members.

-- ---------------------------------------------------------------------------
-- Schema privado (não exposto pela API) para funções auxiliares
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.store_role as enum ('owner', 'editor');

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  description text,
  logo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stores_slug_key unique (slug),
  constraint stores_slug_format check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 63
  ),
  constraint stores_name_length check (char_length(btrim(name)) between 1 and 120),
  constraint stores_description_length check (description is null or char_length(description) <= 2000)
);

create table public.store_members (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.store_role not null,
  created_at timestamptz not null default now(),
  constraint store_members_store_id_user_id_key unique (store_id, user_id)
);

create index store_members_user_id_idx on public.store_members (user_id);

create table public.store_domains (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  domain text not null,
  is_primary boolean not null default false,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_domains_domain_key unique (domain),
  constraint store_domains_domain_format check (
    domain = lower(domain)
    and char_length(domain) <= 253
    and domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
  ),
  constraint store_domains_primary_requires_verified check (not is_primary or verified)
);

create index store_domains_store_id_idx on public.store_domains (store_id);
create unique index store_domains_one_primary_per_store_idx
  on public.store_domains (store_id) where is_primary;

create table public.store_settings (
  store_id uuid primary key references public.stores (id) on delete cascade,
  whatsapp_number text,
  whatsapp_message_template text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_settings_whatsapp_number_e164 check (
    whatsapp_number is null or whatsapp_number ~ '^\+[1-9][0-9]{7,14}$'
  ),
  constraint store_settings_message_template_length check (
    whatsapp_message_template is null or char_length(whatsapp_message_template) <= 1000
  )
);

comment on column public.store_settings.whatsapp_number is 'Formato E.164 com "+" (ex.: +5511999999999).';
comment on column public.store_domains.verified is 'Somente service_role altera: cliente não pode se auto-verificar.';
comment on column public.stores.active is 'Somente service_role altera: controlado pela plataforma.';

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger stores_set_updated_at before update on public.stores
  for each row execute function private.set_updated_at();
create trigger store_domains_set_updated_at before update on public.store_domains
  for each row execute function private.set_updated_at();
create trigger store_settings_set_updated_at before update on public.store_settings
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Funções auxiliares de autorização
--
-- SECURITY DEFINER é necessário aqui: uma policy em store_members que consultasse
-- store_members causaria recursão infinita de RLS. As funções não recebem o usuário
-- por parâmetro (usam auth.uid()) e vivem em schema não exposto pela API.
-- ---------------------------------------------------------------------------
create function private.is_store_member(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.store_members m
    where m.store_id = p_store_id
      and m.user_id = (select auth.uid())
  );
$$;

create function private.is_store_owner(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.store_members m
    where m.store_id = p_store_id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  );
$$;

revoke all on function private.is_store_member(uuid) from public;
revoke all on function private.is_store_owner(uuid) from public;
grant execute on function private.is_store_member(uuid) to authenticated;
grant execute on function private.is_store_owner(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Privilégios (mínimos, por coluna) e RLS
--
-- O Supabase concede privilégios amplos a anon/authenticated por padrão em tabelas
-- novas; revogamos tudo e concedemos apenas o necessário, de forma explícita.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.store_domains enable row level security;
alter table public.store_settings enable row level security;

revoke all on public.profiles, public.stores, public.store_members,
  public.store_domains, public.store_settings from anon, authenticated;

grant select on public.profiles, public.stores, public.store_members,
  public.store_domains, public.store_settings to authenticated;

grant insert (id, full_name, avatar_url) on public.profiles to authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

grant update (name, description, logo_url) on public.stores to authenticated;

grant insert (store_id, user_id, role) on public.store_members to authenticated;
grant update (role) on public.store_members to authenticated;
grant delete on public.store_members to authenticated;

grant insert (store_id, domain, is_primary) on public.store_domains to authenticated;
grant update (is_primary) on public.store_domains to authenticated;
grant delete on public.store_domains to authenticated;

grant insert (store_id, whatsapp_number, whatsapp_message_template) on public.store_settings to authenticated;
grant update (whatsapp_number, whatsapp_message_template) on public.store_settings to authenticated;

-- profiles: cada usuário só acessa o próprio perfil
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- stores: membros leem; owner atualiza. Sem INSERT/DELETE para clientes.
create policy stores_select_member on public.stores
  for select to authenticated
  using (private.is_store_member(id));

create policy stores_update_owner on public.stores
  for update to authenticated
  using (private.is_store_owner(id))
  with check (private.is_store_owner(id));

-- store_members: membros leem a equipe; somente owner gerencia
create policy store_members_select_member on public.store_members
  for select to authenticated
  using (private.is_store_member(store_id));

create policy store_members_insert_owner on public.store_members
  for insert to authenticated
  with check (private.is_store_owner(store_id));

create policy store_members_update_owner on public.store_members
  for update to authenticated
  using (private.is_store_owner(store_id))
  with check (private.is_store_owner(store_id));

create policy store_members_delete_owner on public.store_members
  for delete to authenticated
  using (private.is_store_owner(store_id));

-- store_domains: membros leem; somente owner gerencia
create policy store_domains_select_member on public.store_domains
  for select to authenticated
  using (private.is_store_member(store_id));

create policy store_domains_insert_owner on public.store_domains
  for insert to authenticated
  with check (private.is_store_owner(store_id));

create policy store_domains_update_owner on public.store_domains
  for update to authenticated
  using (private.is_store_owner(store_id))
  with check (private.is_store_owner(store_id));

create policy store_domains_delete_owner on public.store_domains
  for delete to authenticated
  using (private.is_store_owner(store_id));

-- store_settings: membros leem; somente owner grava
create policy store_settings_select_member on public.store_settings
  for select to authenticated
  using (private.is_store_member(store_id));

create policy store_settings_insert_owner on public.store_settings
  for insert to authenticated
  with check (private.is_store_owner(store_id));

create policy store_settings_update_owner on public.store_settings
  for update to authenticated
  using (private.is_store_owner(store_id))
  with check (private.is_store_owner(store_id));
