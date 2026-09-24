-- Dados de DESENVOLVIMENTO para o banco local (`supabase start` / `supabase db reset`).
--
-- Nunca rode isto no projeto remoto: são uma loja e produtos fictícios, criados só para
-- a vitrine ter o que mostrar na máquina de quem desenvolve. O número de WhatsApp é
-- inventado e não pertence a ninguém.
--
-- Há de propósito um rascunho e um arquivado: eles NÃO devem aparecer na vitrine, e
-- estar aqui torna isso visível a olho nu durante o desenvolvimento.

insert into public.stores (id, name, slug, description, active) values
  ('d0000000-0000-0000-0000-000000000001', 'Permita-se', 'permita-se',
   null, true);

insert into public.store_settings (store_id, whatsapp_number, whatsapp_message_template) values
  ('d0000000-0000-0000-0000-000000000001', '+5511900000000', null);

insert into public.categories (id, store_id, name, slug, sort_order) values
  ('c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Categoria um',     'categoria-um',     1),
  ('c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'Categoria dois',   'categoria-dois',   2),
  ('c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'Categoria três',   'categoria-tres',   3),
  ('c0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', 'Categoria quatro', 'categoria-quatro', 4);

-- 20 produtos publicados, distribuídos entre as categorias. Um a cada três em promoção
-- (20% abaixo do preço), os seis primeiros em destaque.
insert into public.products
  (id, store_id, category_id, name, slug, short_description, description,
   price_cents, promotional_price_cents, stock, status, featured, created_at)
select
  ('e0000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'd0000000-0000-0000-0000-000000000001',
  ('c0000000-0000-0000-0000-' || lpad((1 + (n - 1) % 4)::text, 12, '0'))::uuid,
  'Produto exemplo ' || lpad(n::text, 2, '0'),
  'produto-exemplo-' || n,
  'Descrição curta do produto de exemplo.',
  'Descrição completa do produto de exemplo.' || E'\n\n' || 'Segundo parágrafo ilustrativo.',
  4990 + (n % 6) * 1500,
  case when n % 3 = 1 then round((4990 + (n % 6) * 1500) * 0.8)::int end,
  case when n % 8 = 0 then 0 else 10 end,
  'published',
  n <= 6,
  now() - (n || ' hours')::interval
from generate_series(1, 20) as n;

insert into public.products (store_id, category_id, name, slug, price_cents, status) values
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'Rascunho que não pode aparecer', 'rascunho-invisivel', 9990, 'draft'),
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'Arquivado que não pode aparecer', 'arquivado-invisivel', 9990, 'archived');

-- Variantes nos quatro primeiros produtos.
insert into public.product_variants (store_id, product_id, name, stock, options, position)
select
  'd0000000-0000-0000-0000-000000000001',
  ('e0000000-0000-0000-0000-' || lpad(p::text, 12, '0'))::uuid,
  v.nome, v.estoque, jsonb_build_object('Tamanho', v.nome), v.pos
from generate_series(1, 4) as p
cross join (values ('P', 5, 0), ('M', 5, 1), ('G', 0, 2)) as v(nome, estoque, pos);

insert into public.tags (id, store_id, name, slug) values
  ('70000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Novidade', 'novidade');

insert into public.product_tags (store_id, product_id, tag_id)
select 'd0000000-0000-0000-0000-000000000001',
       ('e0000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       '70000000-0000-0000-0000-000000000001'
from generate_series(1, 5) as n;

insert into public.collections (id, store_id, name, slug, description) values
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
   'Seleção da semana', 'selecao-da-semana', 'Coleção de exemplo.');

insert into public.collection_products (store_id, collection_id, product_id, position)
select 'd0000000-0000-0000-0000-000000000001',
       'a0000000-0000-0000-0000-000000000001',
       ('e0000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       n
from generate_series(7, 12) as n;
