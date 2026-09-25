-- "Sobre nós" acima da hero: uma foto e um texto curto, editáveis pelo painel, numa
-- faixa entre o topo da home e o carrossel de banners.
--
-- Fica em store_settings (uma linha por loja) por ser conteúdo único da loja, como o
-- WhatsApp — não uma lista reordenável como store_banners. Sem foto OU sem texto, a
-- vitrine não mostra a seção (ver toStore() em mappers.ts).
--
-- Convenção do caminho da foto: {store_id}/{store_id}/{arquivo} — os mesmos dois
-- segmentos do restante do catálogo (store_id/entidade/arquivo), usando o próprio
-- store_id como "entidade" porque a seção não tem um id próprio além do da loja.

alter table public.store_settings
  add column about_image_path text,
  add column about_image_alt text,
  add column about_text text,
  add constraint store_settings_about_image_path_scoped check (
    about_image_path is null or (
      char_length(about_image_path) <= 500
      and about_image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[a-z0-9][a-z0-9_-]{0,99}\.(jpg|jpeg|png|webp|avif)$'
      and split_part(about_image_path, '/', 1) = store_id::text
      and split_part(about_image_path, '/', 2) = store_id::text
    )
  ),
  add constraint store_settings_about_image_alt_length check (
    about_image_alt is null or char_length(about_image_alt) <= 200
  ),
  add constraint store_settings_about_text_length check (
    about_text is null or char_length(about_text) <= 600
  );

comment on column public.store_settings.about_image_path is
  'Foto da seção "Sobre nós" acima da hero. Convenção {store_id}/{store_id}/{arquivo}.';
comment on column public.store_settings.about_text is
  'Texto ao lado da foto de "Sobre nós". Sem foto ou sem texto, a seção não aparece.';

grant insert (about_image_path, about_image_alt, about_text) on public.store_settings to authenticated;
grant update (about_image_path, about_image_alt, about_text) on public.store_settings to authenticated;

-- Mesma policy pública que já cobre o WhatsApp (store_settings_select_public): só falta
-- o privilégio nas colunas novas.
grant select (about_image_path, about_image_alt, about_text) on public.store_settings to anon;
