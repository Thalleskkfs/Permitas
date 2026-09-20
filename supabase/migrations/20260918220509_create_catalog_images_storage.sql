-- Storage das imagens do catálogo: apenas a configuração do bucket privado.
--
-- POR QUE NÃO HÁ POLICIES EM storage.objects
--
-- No projeto hospedado, storage.objects pertence a supabase_storage_admin, e o papel
-- postgres (usado pelo `supabase db push`) não é dono, não é membro desse papel e não é
-- superuser. O Postgres exige propriedade da tabela para CREATE POLICY, então qualquer
-- tentativa falharia com 42501. Mudar o dono de tabelas internas do Supabase não é uma
-- opção aceitável.
--
-- Consequência arquitetural: storage.objects continua com RLS ativo e ZERO policies, que
-- é o padrão do Supabase. Sem policy, nem anon nem authenticated acessam objeto algum,
-- nem para ler, nem para gravar. Isso é desejado aqui: o navegador nunca fala com o
-- Storage. Todo acesso acontece no servidor Next.js, com service_role (que ignora RLS),
-- em src/lib/storage/catalog-images.ts.
--
-- Como a autorização deixa de ser feita pelo banco, ela passa a ser responsabilidade
-- explícita do código server-side: cada operação precisa validar o vínculo do usuário
-- com a loja e a relação entre produto e loja antes de tocar no Storage.
--
-- CONVENÇÃO DE PATH (validada no código, não mais por policy):
--
--   {store_id}/{product_id}/{filename}
--
--   * store_id e product_id: UUIDs em minúsculas, no formato canônico.
--   * filename: gerado pelo servidor como "{uuid}.{ext}", com ext em
--     jpg, jpeg, png, webp ou avif. Nome enviado pelo usuário nunca vira path.
--   * Exemplo: 4f0c…/9b1e…/0d6f3c1a-7e5b-4a52-9c1d-2b8e6f4a7c10.webp

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'catalog-images',
  'catalog-images',
  false,
  5242880, -- 5 MiB por arquivo
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

comment on column public.product_images.storage_path is
  'Caminho no bucket privado catalog-images: {store_id}/{product_id}/{filename}. O bucket não tem policies: o acesso é exclusivamente server-side via service_role. Nenhum binário é guardado no banco.';
