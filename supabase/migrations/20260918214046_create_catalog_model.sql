-- Modelo de catálogo: categories, products, product_images, product_variants, tags,
-- product_tags, collections, collection_products.
--
-- Isolamento entre lojas:
--   * Toda relação entre linhas de lojas potencialmente diferentes é protegida por FK
--     COMPOSTA (id, store_id): o banco garante que categoria/produto/tag/coleção
--     relacionados pertencem à mesma loja, sem depender de trigger nem do cliente.
--     Por isso tabelas de vínculo (product_tags, collection_products) e product_variants
--     carregam store_id; product_images resolve a loja pelo produto.
--   * A autorização usa apenas auth.uid() + store_members (funções private.* existentes).
--
-- Acesso: somente authenticated com vínculo à loja. Nenhum acesso para anon/público
-- (a exposição pública do catálogo será definida em etapa posterior).
--   * owner e editor: leem, criam, atualizam e reorganizam.
--   * excluir estruturas (categorias, produtos, variantes, tags, coleções): somente owner.
--   * editor pode remover apenas linhas de vínculo/mídia (imagens, tags do produto,
--     produtos da coleção) e arquivar produtos (status) em vez de excluí-los.

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.product_status as enum ('draft', 'published', 'archived');

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  parent_id uuid,
  name text not null,
  slug text not null,
  description text,
  image_url text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_store_id_slug_key unique (store_id, slug),
  constraint categories_id_store_id_key unique (id, store_id),
  constraint categories_parent_fkey foreign key (parent_id, store_id)
    references public.categories (id, store_id) on delete set null (parent_id),
  constraint categories_parent_not_self check (parent_id is null or parent_id <> id),
  constraint categories_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  constraint categories_name_length check (char_length(btrim(name)) between 1 and 120),
  constraint categories_description_length check (description is null or char_length(description) <= 2000),
  constraint categories_image_url_length check (image_url is null or char_length(image_url) <= 2048)
);

create index categories_store_id_parent_id_idx on public.categories (store_id, parent_id);

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  category_id uuid,
  name text not null,
  slug text not null,
  sku text,
  short_description text,
  description text,
  price_cents integer not null,
  promotional_price_cents integer,
  stock integer not null default 0,
  status public.product_status not null default 'draft',
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_store_id_slug_key unique (store_id, slug),
  constraint products_store_id_sku_key unique (store_id, sku),
  constraint products_id_store_id_key unique (id, store_id),
  constraint products_category_fkey foreign key (category_id, store_id)
    references public.categories (id, store_id) on delete set null (category_id),
  constraint products_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  constraint products_name_length check (char_length(btrim(name)) between 1 and 200),
  constraint products_sku_length check (sku is null or char_length(btrim(sku)) between 1 and 64),
  constraint products_short_description_length check (short_description is null or char_length(short_description) <= 500),
  constraint products_description_length check (description is null or char_length(description) <= 20000),
  constraint products_price_non_negative check (price_cents >= 0),
  constraint products_promotional_price_valid check (
    promotional_price_cents is null
    or (promotional_price_cents >= 0 and promotional_price_cents <= price_cents)
  ),
  constraint products_stock_non_negative check (stock >= 0)
);

create index products_store_id_status_idx on public.products (store_id, status);
create index products_store_id_category_id_idx on public.products (store_id, category_id);
create index products_store_id_featured_idx on public.products (store_id) where featured;

comment on column public.products.status is
  'draft (rascunho), published (ativo/visível no futuro catálogo público) ou archived (fora do catálogo; permanece no banco).';

-- ---------------------------------------------------------------------------
-- product_images (a loja é resolvida pelo produto)
-- ---------------------------------------------------------------------------
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  storage_path text not null,
  alt_text text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint product_images_storage_path_valid check (
    char_length(storage_path) between 1 and 500
    and storage_path !~ '^/'
    and storage_path !~ '\.\.'
  ),
  constraint product_images_alt_text_length check (alt_text is null or char_length(alt_text) <= 300),
  constraint product_images_position_non_negative check (position >= 0)
);

create index product_images_product_id_position_idx on public.product_images (product_id, position);

comment on column public.product_images.storage_path is
  'Caminho do objeto no Supabase Storage (sem barra inicial), ex.: {store_id}/{product_id}/{arquivo}. Nenhum binário é guardado no banco.';

-- ---------------------------------------------------------------------------
-- product_variants (opcionais; store_id permite SKU único por loja)
-- ---------------------------------------------------------------------------
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  product_id uuid not null,
  name text not null,
  sku text,
  price_cents integer,
  stock integer not null default 0,
  options jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_variants_store_id_sku_key unique (store_id, sku),
  constraint product_variants_product_fkey foreign key (product_id, store_id)
    references public.products (id, store_id) on delete cascade,
  constraint product_variants_name_length check (char_length(btrim(name)) between 1 and 200),
  constraint product_variants_sku_length check (sku is null or char_length(btrim(sku)) between 1 and 64),
  constraint product_variants_price_non_negative check (price_cents is null or price_cents >= 0),
  constraint product_variants_stock_non_negative check (stock >= 0),
  constraint product_variants_position_non_negative check (position >= 0),
  constraint product_variants_options_valid check (
    jsonb_typeof(options) = 'object'
    and octet_length(options::text) <= 2000
    and not jsonb_path_exists(options, '$.* ? (@.type() != "string")')
  )
);

create index product_variants_product_id_position_idx on public.product_variants (product_id, position);

comment on column public.product_variants.options is
  'Objeto JSON com valores em texto, ex.: {"cor": "Preto", "tamanho": "M"}.';

-- ---------------------------------------------------------------------------
-- tags e product_tags
-- ---------------------------------------------------------------------------
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  constraint tags_store_id_slug_key unique (store_id, slug),
  constraint tags_id_store_id_key unique (id, store_id),
  constraint tags_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  constraint tags_name_length check (char_length(btrim(name)) between 1 and 80)
);

create table public.product_tags (
  store_id uuid not null,
  product_id uuid not null,
  tag_id uuid not null,
  constraint product_tags_pkey primary key (product_id, tag_id),
  constraint product_tags_product_fkey foreign key (product_id, store_id)
    references public.products (id, store_id) on delete cascade,
  constraint product_tags_tag_fkey foreign key (tag_id, store_id)
    references public.tags (id, store_id) on delete cascade
);

create index product_tags_tag_id_idx on public.product_tags (tag_id);

-- ---------------------------------------------------------------------------
-- collections e collection_products
-- ---------------------------------------------------------------------------
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  image_url text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collections_store_id_slug_key unique (store_id, slug),
  constraint collections_id_store_id_key unique (id, store_id),
  constraint collections_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  constraint collections_name_length check (char_length(btrim(name)) between 1 and 120),
  constraint collections_description_length check (description is null or char_length(description) <= 2000),
  constraint collections_image_url_length check (image_url is null or char_length(image_url) <= 2048)
);

create table public.collection_products (
  store_id uuid not null,
  collection_id uuid not null,
  product_id uuid not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint collection_products_pkey primary key (collection_id, product_id),
  constraint collection_products_collection_fkey foreign key (collection_id, store_id)
    references public.collections (id, store_id) on delete cascade,
  constraint collection_products_product_fkey foreign key (product_id, store_id)
    references public.products (id, store_id) on delete cascade,
  constraint collection_products_position_non_negative check (position >= 0)
);

create index collection_products_collection_id_position_idx on public.collection_products (collection_id, position);
create index collection_products_product_id_idx on public.collection_products (product_id);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create trigger categories_set_updated_at before update on public.categories
  for each row execute function private.set_updated_at();
create trigger products_set_updated_at before update on public.products
  for each row execute function private.set_updated_at();
create trigger product_variants_set_updated_at before update on public.product_variants
  for each row execute function private.set_updated_at();
create trigger collections_set_updated_at before update on public.collections
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Categorias: impedir ciclos na hierarquia
--
-- Não há como expressar "sem ciclos" com constraint. O trigger é AFTER (o estado final
-- do comando já é visível; um BEFORE ROW não enxerga as linhas anteriores de um UPDATE
-- em lote que troca pais entre si) e SECURITY DEFINER (a checagem não pode depender da
-- visibilidade RLS de quem chama). Um advisory lock por loja serializa alterações
-- concorrentes. Função de trigger, sem argumentos, em schema não exposto.
-- ---------------------------------------------------------------------------
create function private.prevent_category_cycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('categories:' || new.store_id::text, 0)
  );

  if exists (
    with recursive ancestors as (
      select c.id, c.parent_id
      from public.categories c
      where c.id = new.parent_id
      union
      select c.id, c.parent_id
      from public.categories c
      join ancestors a on c.id = a.parent_id
    )
    select 1 from ancestors where id = new.id
  ) then
    raise exception 'A hierarquia de categorias não pode conter ciclos.'
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

revoke all on function private.prevent_category_cycle() from public;

create trigger categories_prevent_cycle
  after update of parent_id on public.categories
  for each row
  when (new.parent_id is not null and new.parent_id is distinct from old.parent_id)
  execute function private.prevent_category_cycle();

-- ---------------------------------------------------------------------------
-- Privilégios (mínimos, por coluna) e RLS
--
-- store_id e product_id nunca são atualizáveis por clientes: mover linhas entre lojas
-- ou produtos não é uma operação permitida.
-- ---------------------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.tags enable row level security;
alter table public.product_tags enable row level security;
alter table public.collections enable row level security;
alter table public.collection_products enable row level security;

revoke all on public.categories, public.products, public.product_images,
  public.product_variants, public.tags, public.product_tags,
  public.collections, public.collection_products from anon, authenticated;

grant select on public.categories, public.products, public.product_images,
  public.product_variants, public.tags, public.product_tags,
  public.collections, public.collection_products to authenticated;

grant insert (store_id, parent_id, name, slug, description, image_url, active, sort_order)
  on public.categories to authenticated;
grant update (parent_id, name, slug, description, image_url, active, sort_order)
  on public.categories to authenticated;
grant delete on public.categories to authenticated;

grant insert (store_id, category_id, name, slug, sku, short_description, description,
  price_cents, promotional_price_cents, stock, status, featured)
  on public.products to authenticated;
grant update (category_id, name, slug, sku, short_description, description,
  price_cents, promotional_price_cents, stock, status, featured)
  on public.products to authenticated;
grant delete on public.products to authenticated;

grant insert (product_id, storage_path, alt_text, position) on public.product_images to authenticated;
grant update (storage_path, alt_text, position) on public.product_images to authenticated;
grant delete on public.product_images to authenticated;

grant insert (store_id, product_id, name, sku, price_cents, stock, options, active, position)
  on public.product_variants to authenticated;
grant update (name, sku, price_cents, stock, options, active, position)
  on public.product_variants to authenticated;
grant delete on public.product_variants to authenticated;

grant insert (store_id, name, slug) on public.tags to authenticated;
grant update (name, slug) on public.tags to authenticated;
grant delete on public.tags to authenticated;

grant insert (store_id, product_id, tag_id) on public.product_tags to authenticated;
grant delete on public.product_tags to authenticated;

grant insert (store_id, name, slug, description, image_url, active, sort_order)
  on public.collections to authenticated;
grant update (name, slug, description, image_url, active, sort_order)
  on public.collections to authenticated;
grant delete on public.collections to authenticated;

grant insert (store_id, collection_id, product_id, position) on public.collection_products to authenticated;
grant update (position) on public.collection_products to authenticated;
grant delete on public.collection_products to authenticated;

-- Tabelas com store_id: leitura/criação/edição por membros (owner e editor);
-- exclusão de estruturas apenas por owner.
create policy categories_select_member on public.categories
  for select to authenticated using (private.is_store_member(store_id));
create policy categories_insert_member on public.categories
  for insert to authenticated with check (private.is_store_member(store_id));
create policy categories_update_member on public.categories
  for update to authenticated
  using (private.is_store_member(store_id)) with check (private.is_store_member(store_id));
create policy categories_delete_owner on public.categories
  for delete to authenticated using (private.is_store_owner(store_id));

create policy products_select_member on public.products
  for select to authenticated using (private.is_store_member(store_id));
create policy products_insert_member on public.products
  for insert to authenticated with check (private.is_store_member(store_id));
create policy products_update_member on public.products
  for update to authenticated
  using (private.is_store_member(store_id)) with check (private.is_store_member(store_id));
create policy products_delete_owner on public.products
  for delete to authenticated using (private.is_store_owner(store_id));

create policy product_variants_select_member on public.product_variants
  for select to authenticated using (private.is_store_member(store_id));
create policy product_variants_insert_member on public.product_variants
  for insert to authenticated with check (private.is_store_member(store_id));
create policy product_variants_update_member on public.product_variants
  for update to authenticated
  using (private.is_store_member(store_id)) with check (private.is_store_member(store_id));
create policy product_variants_delete_owner on public.product_variants
  for delete to authenticated using (private.is_store_owner(store_id));

create policy tags_select_member on public.tags
  for select to authenticated using (private.is_store_member(store_id));
create policy tags_insert_member on public.tags
  for insert to authenticated with check (private.is_store_member(store_id));
create policy tags_update_member on public.tags
  for update to authenticated
  using (private.is_store_member(store_id)) with check (private.is_store_member(store_id));
create policy tags_delete_owner on public.tags
  for delete to authenticated using (private.is_store_owner(store_id));

create policy collections_select_member on public.collections
  for select to authenticated using (private.is_store_member(store_id));
create policy collections_insert_member on public.collections
  for insert to authenticated with check (private.is_store_member(store_id));
create policy collections_update_member on public.collections
  for update to authenticated
  using (private.is_store_member(store_id)) with check (private.is_store_member(store_id));
create policy collections_delete_owner on public.collections
  for delete to authenticated using (private.is_store_owner(store_id));

-- Vínculos: membros gerenciam por completo (remover um vínculo não destrói estruturas)
create policy product_tags_select_member on public.product_tags
  for select to authenticated using (private.is_store_member(store_id));
create policy product_tags_insert_member on public.product_tags
  for insert to authenticated with check (private.is_store_member(store_id));
create policy product_tags_delete_member on public.product_tags
  for delete to authenticated using (private.is_store_member(store_id));

create policy collection_products_select_member on public.collection_products
  for select to authenticated using (private.is_store_member(store_id));
create policy collection_products_insert_member on public.collection_products
  for insert to authenticated with check (private.is_store_member(store_id));
create policy collection_products_update_member on public.collection_products
  for update to authenticated
  using (private.is_store_member(store_id)) with check (private.is_store_member(store_id));
create policy collection_products_delete_member on public.collection_products
  for delete to authenticated using (private.is_store_member(store_id));

-- Imagens: a loja é a do produto; membros gerenciam por completo
create policy product_images_select_member on public.product_images
  for select to authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_images.product_id and private.is_store_member(p.store_id)
  ));
create policy product_images_insert_member on public.product_images
  for insert to authenticated
  with check (exists (
    select 1 from public.products p
    where p.id = product_images.product_id and private.is_store_member(p.store_id)
  ));
create policy product_images_update_member on public.product_images
  for update to authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_images.product_id and private.is_store_member(p.store_id)
  ))
  with check (exists (
    select 1 from public.products p
    where p.id = product_images.product_id and private.is_store_member(p.store_id)
  ));
create policy product_images_delete_member on public.product_images
  for delete to authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_images.product_id and private.is_store_member(p.store_id)
  ));
