-- Versão de celular da arte dos banners.
--
-- A arte de um banner vem pronta do designer, com texto e composição embutidos. Uma
-- arte deitada (desktop) cortada para caber num celular em pé perde exatamente o que
-- importa, então cada banner pode ter duas: `image_path` para telas largas e
-- `image_path_mobile` para o celular, que é de onde vem a maior parte das visitas.
--
-- Regras de exibição (aplicadas na vitrine):
--   * celular: `image_path_mobile`, ou `image_path` se não houver versão própria;
--   * desktop: `image_path`. Banner sem `image_path` não aparece no desktop — em vez de
--     esticar uma arte em pé numa faixa deitada.
--
-- A imagem de celular segue a mesma convenção e a mesma trava da imagem principal:
-- {store_id}/{banner_id}/{arquivo}, sempre da própria loja e do próprio banner.

alter table public.store_banners
  add column image_path_mobile text,
  add constraint store_banners_image_path_mobile_scoped check (
    image_path_mobile is null or (
      char_length(image_path_mobile) <= 500
      and image_path_mobile ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[a-z0-9][a-z0-9_-]{0,99}\.(jpg|jpeg|png|webp|avif)$'
      and split_part(image_path_mobile, '/', 1) = store_id::text
      and split_part(image_path_mobile, '/', 2) = id::text
    )
  );

comment on column public.store_banners.image_path_mobile is
  'Arte do banner para celular (em pé). Sem ela, o celular usa image_path.';

grant insert (image_path_mobile), update (image_path_mobile) on public.store_banners to authenticated;
grant select (image_path_mobile) on public.store_banners to anon;
