-- Banners de destaque da hero da vitrine.
--
-- Cada loja cadastra, pelo painel, os banners que giram no topo da página inicial:
-- título, texto de apoio, uma chamada opcional e uma imagem opcional. A ordem de
-- exibição é `position`; só os ativos aparecem.
--
-- Decisões:
--
--   1. A imagem segue a MESMA convenção de caminho das fotos de produto:
--      {store_id}/{banner_id}/{arquivo}. Assim o validador, o upload e a rota que serve
--      as imagens são os mesmos, sem um segundo caminho paralelo para manter. O banco
--      garante que o caminho aponta para a própria loja e para o próprio banner — um
--      banner nunca consegue exibir a imagem de outra loja.
--
--   2. O link da chamada é SEMPRE interno: começa com uma única "/" e não traz espaço
--      nem caractere de controle. Isso barra `javascript:`, `//outro-site.com` (que o
--      navegador trata como externo), `/\outro-site.com` e redirecionamento aberto. Um
--      banner é texto editável por qualquer membro da loja; o link não pode virar vetor.
--
--   3. Leitura pública só de banner ATIVO de loja ATIVA, com privilégio por coluna, no
--      mesmo desenho da leitura pública do catálogo (somente anon; ver
--      20260921020555_allow_public_catalog_read.sql para o porquê).

create table public.store_banners (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  title text not null,
  subtitle text,
  cta_label text,
  cta_href text,
  image_path text,
  image_alt text,
  active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint store_banners_id_store_id_key unique (id, store_id),
  constraint store_banners_title_length check (char_length(btrim(title)) between 1 and 120),
  constraint store_banners_subtitle_length check (subtitle is null or char_length(subtitle) <= 240),
  constraint store_banners_cta_label_length check (cta_label is null or char_length(btrim(cta_label)) between 1 and 40),
  constraint store_banners_image_alt_length check (image_alt is null or char_length(image_alt) <= 200),
  constraint store_banners_position_range check (position between 0 and 1000),

  -- Chamada completa ou nenhuma: rótulo sem destino (ou destino sem rótulo) vira um
  -- botão que não leva a lugar nenhum.
  constraint store_banners_cta_complete check ((cta_label is null) = (cta_href is null)),

  constraint store_banners_cta_href_internal check (
    cta_href is null or (
      char_length(cta_href) between 1 and 300
      and cta_href ~ '^/[^/\\]'
      and cta_href !~ '[[:space:][:cntrl:]]'
    )
  ),

  constraint store_banners_image_path_scoped check (
    image_path is null or (
      char_length(image_path) <= 500
      and image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[a-z0-9][a-z0-9_-]{0,99}\.(jpg|jpeg|png|webp|avif)$'
      and split_part(image_path, '/', 1) = store_id::text
      and split_part(image_path, '/', 2) = id::text
    )
  )
);

comment on table public.store_banners is
  'Banners da hero da vitrine, gerenciados pelo painel. Só os ativos de lojas ativas são públicos.';
comment on column public.store_banners.cta_href is
  'Destino da chamada. Sempre caminho interno do site ("/loja/..."); links externos são recusados pelo banco.';
comment on column public.store_banners.image_path is
  'Caminho no bucket privado catalog-images: {store_id}/{banner_id}/{arquivo}. Servido pela rota de imagens do site.';

create index store_banners_store_id_position_idx on public.store_banners (store_id, position);

create trigger store_banners_set_updated_at before update on public.store_banners
  for each row execute function private.set_updated_at();

alter table public.store_banners enable row level security;

-- No Supabase, toda tabela nova em `public` nasce com privilégio TOTAL para anon e
-- authenticated (privilégios padrão do schema). Sem este revoke, os grants por coluna
-- abaixo seriam decorativos: o visitante leria colunas internas e só a RLS o
-- impediria de gravar. Zera tudo e concede só o necessário, como nas demais tabelas.
revoke all on public.store_banners from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Painel: mesmo recorte das coleções. Membros criam, leem e editam; só o owner exclui.
-- `store_id` não é atualizável: um banner não muda de loja.
-- ---------------------------------------------------------------------------
grant select on public.store_banners to authenticated;
grant insert (store_id, title, subtitle, cta_label, cta_href, image_path, image_alt, active, position)
  on public.store_banners to authenticated;
grant update (title, subtitle, cta_label, cta_href, image_path, image_alt, active, position)
  on public.store_banners to authenticated;
grant delete on public.store_banners to authenticated;

create policy store_banners_select_member on public.store_banners
  for select to authenticated using (private.is_store_member(store_id));
create policy store_banners_insert_member on public.store_banners
  for insert to authenticated with check (private.is_store_member(store_id));
create policy store_banners_update_member on public.store_banners
  for update to authenticated
  using (private.is_store_member(store_id)) with check (private.is_store_member(store_id));
create policy store_banners_delete_owner on public.store_banners
  for delete to authenticated using (private.is_store_owner(store_id));

-- ---------------------------------------------------------------------------
-- Vitrine: leitura pública, só anon, só colunas exibidas ou filtradas.
-- ---------------------------------------------------------------------------
grant select (id, store_id, title, subtitle, cta_label, cta_href, image_path, image_alt, active, position)
  on public.store_banners to anon;

create policy store_banners_select_public on public.store_banners
  for select to anon
  using (active and private.is_public_store(store_id));
