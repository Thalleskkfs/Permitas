-- Hardening: valores monetários sempre positivos (não existe produto gratuito por preço 0).
--
--   * products.price_cents > 0
--   * products.promotional_price_cents, quando informado, > 0 e <= price_cents
--   * product_variants.price_cents, quando informado (opcional), > 0
--
-- Estoque e posições continuam aceitando 0.

alter table public.products
  drop constraint products_price_non_negative,
  drop constraint products_promotional_price_valid;

alter table public.products
  add constraint products_price_positive check (price_cents > 0),
  add constraint products_promotional_price_valid check (
    promotional_price_cents is null
    or (promotional_price_cents > 0 and promotional_price_cents <= price_cents)
  );

alter table public.product_variants
  drop constraint product_variants_price_non_negative;

alter table public.product_variants
  add constraint product_variants_price_positive check (price_cents is null or price_cents > 0);
