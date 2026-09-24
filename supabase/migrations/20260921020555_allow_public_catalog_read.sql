-- Leitura pública do catálogo publicado.
--
-- Até aqui o papel anon não tinha nenhum privilégio: o painel funcionava, mas a vitrine
-- não conseguia mostrar nada. Esta migration abre a leitura do que está PUBLICADO, e
-- somente isso.
--
-- O que passa a ser visível sem login:
--   * lojas ativas (nome, slug, descrição, logo);
--   * o número de WhatsApp e a mensagem padrão da loja — é o canal de venda, precisa ser
--     alcançável pelo visitante;
--   * categorias e coleções ATIVAS dessas lojas;
--   * produtos com status 'published' dessas lojas, com imagens, variantes ativas e tags.
--
-- O que continua fechado para anon: profiles, store_members e store_domains, além de
-- rascunhos, arquivados e qualquer coisa de loja inativa.
--
-- Duas decisões de desenho:
--
--   1. Privilégio POR COLUNA. Abrir a tabela inteira exporia campos internos (sku,
--      created_at/updated_at de controle, active/status usados como gaveta). O anon só
--      recebe as colunas que a vitrine realmente renderiza ou filtra — lembrando que o
--      Postgres exige privilégio também sobre colunas citadas no WHERE.
--
--   2. As policies valem SOMENTE para o papel anon, nunca para authenticated.
--
--      Estender a leitura pública a authenticated parece inofensivo — a vitrine é
--      pública de qualquer forma — mas derruba o isolamento de leitura entre lojas de
--      todo mundo que tem conta no painel: um editor da loja A passaria a enxergar
--      linhas da loja B, e o catálogo público deixaria de ser a única coisa que ele vê
--      além da própria loja. As policies são somadas com OR, então basta uma ampla para
--      anular as estreitas.
--
--      Em troca, a vitrine precisa ler com um cliente SEM SESSÃO (chave anon, sem
--      cookie). Isso é o certo de toda forma: página pública não deve ser renderizada
--      sob a identidade de ninguém, o resultado é igual para todo visitante e passa a
--      ser cacheável. Um administrador logado que abrir a loja é atendido como visitante.

-- ---------------------------------------------------------------------------
-- Funções auxiliares
--
-- SECURITY DEFINER para a checagem não depender da RLS da tabela consultada, o que
-- criaria dependência circular entre as policies de products e stores. Vivem no schema
-- private, que não é exposto pela API.
-- ---------------------------------------------------------------------------
create function private.is_public_store(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.stores s
    where s.id = p_store_id and s.active
  );
$$;

create function private.is_public_product(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.products p
    join public.stores s on s.id = p.store_id
    where p.id = p_product_id
      and p.status = 'published'
      and s.active
  );
$$;

revoke all on function private.is_public_store(uuid) from public;
revoke all on function private.is_public_product(uuid) from public;
-- Só anon: são as policies públicas que as usam, e elas não valem para authenticated.
grant execute on function private.is_public_store(uuid) to anon;
grant execute on function private.is_public_product(uuid) to anon;

-- ---------------------------------------------------------------------------
-- Privilégios de coluna para anon
-- ---------------------------------------------------------------------------

-- A vitrine mostra nome, descrição e logo; `active` e `id` entram porque a consulta
-- filtra por eles.
grant select (id, name, slug, description, logo_url, active)
  on public.stores to anon;

-- Apenas o canal de atendimento. O restante de store_settings segue fechado.
grant select (store_id, whatsapp_number, whatsapp_message_template)
  on public.store_settings to anon;

grant select (id, store_id, parent_id, name, slug, description, image_url, active, sort_order)
  on public.categories to anon;

-- `sku` fica de fora: é código interno de estoque, não informação de vitrine.
grant select (id, store_id, category_id, name, slug, short_description, description,
  price_cents, promotional_price_cents, stock, status, featured, created_at)
  on public.products to anon;

grant select (id, product_id, storage_path, alt_text, position)
  on public.product_images to anon;

-- Idem: sem `sku` na variante.
grant select (id, store_id, product_id, name, price_cents, stock, options, active, position)
  on public.product_variants to anon;

grant select (id, store_id, name, slug) on public.tags to anon;
grant select (store_id, product_id, tag_id) on public.product_tags to anon;

grant select (id, store_id, name, slug, description, image_url, active, sort_order)
  on public.collections to anon;

grant select (store_id, collection_id, product_id, position)
  on public.collection_products to anon;

-- ---------------------------------------------------------------------------
-- Policies de leitura pública
--
-- Somente SELECT. Nenhum INSERT, UPDATE ou DELETE é concedido a anon em lugar nenhum:
-- a vitrine é estritamente de leitura.
-- ---------------------------------------------------------------------------
create policy stores_select_public on public.stores
  for select to anon
  using (active);

create policy store_settings_select_public on public.store_settings
  for select to anon
  using (private.is_public_store(store_id));

create policy categories_select_public on public.categories
  for select to anon
  using (active and private.is_public_store(store_id));

create policy products_select_public on public.products
  for select to anon
  using (status = 'published' and private.is_public_store(store_id));

create policy product_images_select_public on public.product_images
  for select to anon
  using (private.is_public_product(product_id));

create policy product_variants_select_public on public.product_variants
  for select to anon
  using (active and private.is_public_product(product_id));

-- Tags e coleções são metadados da loja; ficam visíveis quando a loja está ativa. Os
-- VÍNCULOS, esses sim, só aparecem para produtos publicados — é o vínculo que revelaria
-- a existência de um rascunho.
create policy tags_select_public on public.tags
  for select to anon
  using (private.is_public_store(store_id));

create policy product_tags_select_public on public.product_tags
  for select to anon
  using (private.is_public_product(product_id));

create policy collections_select_public on public.collections
  for select to anon
  using (active and private.is_public_store(store_id));

create policy collection_products_select_public on public.collection_products
  for select to anon
  using (
    private.is_public_product(product_id)
    and exists (
      select 1 from public.collections c
      where c.id = collection_id and c.active
    )
  );
