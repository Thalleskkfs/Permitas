import type { Category, Product, ProductCardData, Store } from "../../types/catalog.ts";
import { storefrontPaths } from "../../lib/storefront-paths.ts";
import type { createPublicClient } from "./supabase-public.ts";
import {
  productOfLink,
  toCategory,
  toCollection,
  toProduct,
  toProductCard,
  toStore,
  type CategoryRow,
  type Collection,
  type CollectionProductRow,
  type CollectionRow,
  type ProductCardRow,
  type ProductRow,
  type StoreRow,
} from "./mappers.ts";

/**
 * Leitura pública da vitrine.
 *
 * O cliente chega por parâmetro e é sempre o de chave anônima SEM sessão, sujeito à
 * RLS — queries.ts é a raiz de composição que o injeta. A separação existe para que a
 * leitura possa ser exercitada contra um banco real, com o papel anon, nos testes;
 * nada aqui conhece cookies, sessão ou service_role.
 *
 * Duas regras valem para TODA consulta deste arquivo:
 *
 *   1. o filtro por `store_id` é explícito. A loja é resolvida uma vez pelo slug, e é
 *      por isso que algumas funções fazem mais de uma consulta: a alternativa seria
 *      deixar a separação entre lojas por conta apenas da RLS;
 *   2. `status = 'published'` e `active` também são explícitos. A RLS repete os dois
 *      filtros, e é bom que repita — ela é a segunda linha de defesa, não a primeira.
 *
 * Preços trafegam em centavos, inteiros, exatamente como estão no banco.
 */

export type StorefrontClient = ReturnType<typeof createPublicClient>;

export type ProductPagination = { offset: number; limit: number };

export type ProductPage = { products: ProductCardData[]; total: number };

export type { Collection };

const STORE_COLUMNS = "id, name, slug, description";
const CATEGORY_COLUMNS = "id, name, slug, sort_order";
const COLLECTION_COLUMNS = "id, name, slug, description";

// Sem `sku` e sem `updated_at`: o papel anon não tem privilégio sobre essas colunas, e
// pedi-las derruba a consulta inteira com erro de permissão.
const PRODUCT_CARD_COLUMNS =
  "id, slug, name, price_cents, promotional_price_cents, stock, created_at, product_images(storage_path, alt_text, position)";

const PRODUCT_COLUMNS = `id, slug, name, short_description, description, price_cents,
  promotional_price_cents, stock, featured, category_id,
  categories(slug),
  product_images(storage_path, alt_text, position),
  product_variants(name, options, stock, position),
  product_tags(tags(name))`;

const emptyPage: ProductPage = { products: [], total: 0 };

/** Ordem estável: sem o desempate por id, paginar poderia repetir ou pular produto. */
function orderProducts<T extends { order: (column: string, options: { ascending: boolean }) => T }>(
  request: T,
) {
  return request.order("created_at", { ascending: false }).order("id", { ascending: true });
}

/** Offset e tamanho saneados: nada negativo, nada fracionário, página de pelo menos 1. */
function toRange({ offset, limit }: ProductPagination) {
  const from = Math.max(0, Math.trunc(offset));
  const size = Math.max(1, Math.trunc(limit));
  return { from, to: from + size - 1 };
}

/** Código do PostgREST para `range` que começa depois do último registro. */
export const RANGE_NOT_SATISFIABLE = "PGRST103";

type PageResponse = {
  data: unknown;
  count: number | null;
  error: { code?: string; message: string } | null;
};

/**
 * Executa uma leitura paginada e devolve as linhas e o total da consulta inteira.
 *
 * Quando o offset passa do último registro (`?page=999`), o PostgREST NÃO devolve lista
 * vazia: responde erro PGRST103. Lançar ali viraria 500, e a página nunca chegaria a
 * decidir pelo 404. Nesse caso, e só nele, fazemos uma contagem só de cabeçalho e
 * devolvemos página vazia com o total real — a regra das páginas
 * (`products.length === 0 && total > 0` → 404) continua valendo. Qualquer outro erro
 * lança como antes.
 *
 * `list` e `count` devem sair da MESMA função de consulta filtrada de quem chama (ver os
 * usos abaixo): é isso que impede a contagem de divergir dos filtros da listagem.
 */
export async function readPage(
  list: () => PromiseLike<PageResponse>,
  count: () => PromiseLike<PageResponse>,
  failure: string,
): Promise<{ rows: unknown[]; total: number }> {
  const listed = await list();
  if (!listed.error) return { rows: (listed.data as unknown[] | null) ?? [], total: listed.count ?? 0 };

  if (listed.error.code !== RANGE_NOT_SATISFIABLE) {
    throw new Error(`${failure}: ${listed.error.message}`);
  }

  const counted = await count();
  if (counted.error) throw new Error(`${failure}: ${counted.error.message}`);
  return { rows: [], total: counted.count ?? 0 };
}

async function getStoreId(client: StorefrontClient, storeSlug: string) {
  const { data, error } = await client
    .from("stores")
    .select("id")
    .eq("slug", storeSlug)
    .eq("active", true)
    .maybeSingle();

  if (error) throw new Error(`Falha ao carregar a loja: ${error.message}`);
  return data?.id ?? null;
}

async function getCategoryId(client: StorefrontClient, storeId: string, categorySlug: string) {
  const { data, error } = await client
    .from("categories")
    .select("id")
    .eq("store_id", storeId)
    .eq("slug", categorySlug)
    .eq("active", true)
    .maybeSingle();

  if (error) throw new Error(`Falha ao carregar a categoria: ${error.message}`);
  return data?.id ?? null;
}

/** Loja ativa pelo slug, com a hero e o canal de WhatsApp. */
export async function getStore(client: StorefrontClient, storeSlug: string): Promise<Store | null> {
  const { data, error } = await client
    .from("stores")
    .select(
      `${STORE_COLUMNS}, store_settings(whatsapp_number, whatsapp_message_template), store_banners(id, title, subtitle, cta_label, cta_href, image_path, image_path_mobile, image_alt, position)`,
    )
    .eq("slug", storeSlug)
    .eq("active", true)
    // A RLS já esconde o banner inativo do visitante; o filtro explícito é a primeira
    // linha de defesa, como em toda consulta desta camada.
    .eq("store_banners.active", true)
    .order("position", { referencedTable: "store_banners" })
    .maybeSingle();

  if (error) throw new Error(`Falha ao carregar a loja: ${error.message}`);
  return data ? toStore(data as StoreRow) : null;
}

export async function getCategories(
  client: StorefrontClient,
  storeSlug: string,
): Promise<Category[]> {
  const storeId = await getStoreId(client, storeSlug);
  if (!storeId) return [];

  const { data, error } = await client
    .from("categories")
    .select(CATEGORY_COLUMNS)
    .eq("store_id", storeId)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(`Falha ao listar categorias: ${error.message}`);
  return (data as CategoryRow[]).map(toCategory);
}

/** Categoria com a contagem de produtos publicados. */
export type CategoryPreview = Category & { count: number };

/**
 * Categorias ativas, na ordem do painel, cada uma com quantos produtos publicados tem.
 * Duas consultas no total (categorias e produtos), não uma por categoria: é o que o menu
 * do cabeçalho usa em toda página. `total` conta todos os produtos publicados, inclusive
 * os sem categoria.
 */
export async function getCategoryPreviews(
  client: StorefrontClient,
  storeSlug: string,
): Promise<{ categories: CategoryPreview[]; total: number }> {
  const storeId = await getStoreId(client, storeSlug);
  if (!storeId) return { categories: [], total: 0 };

  const [categorias, produtos] = await Promise.all([
    client
      .from("categories")
      .select(CATEGORY_COLUMNS)
      .eq("store_id", storeId)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    client.from("products").select("category_id").eq("store_id", storeId).eq("status", "published"),
  ]);

  if (categorias.error) throw new Error(`Falha ao listar categorias: ${categorias.error.message}`);
  if (produtos.error) throw new Error(`Falha ao resumir as categorias: ${produtos.error.message}`);

  const linhas = (produtos.data ?? []) as { category_id: string | null }[];
  const contagem = new Map<string, number>();
  for (const linha of linhas) {
    if (linha.category_id) contagem.set(linha.category_id, (contagem.get(linha.category_id) ?? 0) + 1);
  }

  return {
    categories: (categorias.data as CategoryRow[]).map((row) => ({
      ...toCategory(row),
      count: contagem.get(row.id) ?? 0,
    })),
    total: linhas.length,
  };
}

export async function getCategory(
  client: StorefrontClient,
  storeSlug: string,
  categorySlug: string,
): Promise<Category | null> {
  const storeId = await getStoreId(client, storeSlug);
  if (!storeId) return null;

  const { data, error } = await client
    .from("categories")
    .select(CATEGORY_COLUMNS)
    .eq("store_id", storeId)
    .eq("slug", categorySlug)
    .eq("active", true)
    .maybeSingle();

  if (error) throw new Error(`Falha ao carregar a categoria: ${error.message}`);
  return data ? toCategory(data as CategoryRow) : null;
}

/**
 * Produtos publicados de uma categoria, paginados.
 *
 * `total` é a contagem da consulta inteira, não da página: é dele que sai o número de
 * páginas. Categoria inexistente ou inativa devolve página vazia, nunca a loja toda.
 */
export async function getCategoryProducts(
  client: StorefrontClient,
  storeSlug: string,
  categorySlug: string,
  pagination: ProductPagination,
): Promise<ProductPage> {
  const storeId = await getStoreId(client, storeSlug);
  if (!storeId) return emptyPage;

  const categoryId = await getCategoryId(client, storeId, categorySlug);
  if (!categoryId) return emptyPage;

  const { from, to } = toRange(pagination);

  const filtered = (head: boolean) =>
    client
      .from("products")
      .select(PRODUCT_CARD_COLUMNS, { count: "exact", head })
      .eq("store_id", storeId)
      .eq("category_id", categoryId)
      .eq("status", "published");

  const { rows, total } = await readPage(
    () => orderProducts(filtered(false)).range(from, to),
    () => filtered(true),
    "Falha ao listar os produtos da categoria",
  );

  return toProductPage(rows as ProductCardRow[], total);
}

function toProductPage(rows: ProductCardRow[], total: number): ProductPage {
  const paths = storefrontPaths();
  return { products: rows.map((row) => toProductCard(row, paths)), total };
}

/** Produto publicado pelo slug, com imagens, variantes ativas e tags. */
export async function getProduct(
  client: StorefrontClient,
  storeSlug: string,
  productSlug: string,
): Promise<Product | null> {
  const storeId = await getStoreId(client, storeSlug);
  if (!storeId) return null;

  const { data, error } = await client
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("store_id", storeId)
    .eq("slug", productSlug)
    .eq("status", "published")
    .eq("product_variants.active", true)
    .maybeSingle();

  if (error) throw new Error(`Falha ao carregar o produto: ${error.message}`);
  return data ? toProduct(data as ProductRow) : null;
}

export async function getFeaturedProducts(
  client: StorefrontClient,
  storeSlug: string,
  limit: number,
): Promise<ProductCardData[]> {
  const storeId = await getStoreId(client, storeSlug);
  if (!storeId) return [];

  const { data, error } = await orderProducts(
    client
      .from("products")
      .select(PRODUCT_CARD_COLUMNS)
      .eq("store_id", storeId)
      .eq("status", "published")
      .eq("featured", true),
  ).limit(Math.max(1, Math.trunc(limit)));

  if (error) throw new Error(`Falha ao listar os produtos em destaque: ${error.message}`);

  const paths = storefrontPaths();
  return (data as ProductCardRow[]).map((row) => toProductCard(row, paths));
}

/** Em promoção é o que tem `promotional_price_cents`; o banco garante que é menor. */
export async function getPromotionalProducts(
  client: StorefrontClient,
  storeSlug: string,
  limit: number,
): Promise<ProductCardData[]> {
  const storeId = await getStoreId(client, storeSlug);
  if (!storeId) return [];

  const { data, error } = await orderProducts(
    client
      .from("products")
      .select(PRODUCT_CARD_COLUMNS)
      .eq("store_id", storeId)
      .eq("status", "published")
      .not("promotional_price_cents", "is", null),
  ).limit(Math.max(1, Math.trunc(limit)));

  if (error) throw new Error(`Falha ao listar os produtos em promoção: ${error.message}`);

  const paths = storefrontPaths();
  return (data as ProductCardRow[]).map((row) => toProductCard(row, paths));
}

/**
 * Relacionados: mesma categoria, menos o próprio produto.
 *
 * Recebe o produto já carregado para não reler o que a página de produto acabou de
 * buscar. Produto sem categoria não tem relacionados.
 */
export async function getRelatedProducts(
  client: StorefrontClient,
  storeSlug: string,
  product: Product,
  limit: number,
): Promise<ProductCardData[]> {
  const categorySlug = product.categorySlugs[0];
  if (!categorySlug) return [];

  const storeId = await getStoreId(client, storeSlug);
  if (!storeId) return [];

  const categoryId = await getCategoryId(client, storeId, categorySlug);
  if (!categoryId) return [];

  const { data, error } = await orderProducts(
    client
      .from("products")
      .select(PRODUCT_CARD_COLUMNS)
      .eq("store_id", storeId)
      .eq("category_id", categoryId)
      .eq("status", "published")
      .neq("slug", product.slug),
  ).limit(Math.max(1, Math.trunc(limit)));

  if (error) throw new Error(`Falha ao listar os produtos relacionados: ${error.message}`);

  const paths = storefrontPaths();
  return (data as ProductCardRow[]).map((row) => toProductCard(row, paths));
}

/** Todos os produtos publicados da loja, paginados, na mesma ordem das categorias. */
export async function getAllProducts(
  client: StorefrontClient,
  storeSlug: string,
  pagination: ProductPagination,
): Promise<ProductPage> {
  const storeId = await getStoreId(client, storeSlug);
  if (!storeId) return emptyPage;

  const { from, to } = toRange(pagination);

  const filtered = (head: boolean) =>
    client
      .from("products")
      .select(PRODUCT_CARD_COLUMNS, { count: "exact", head })
      .eq("store_id", storeId)
      .eq("status", "published");

  const { rows, total } = await readPage(
    () => orderProducts(filtered(false)).range(from, to),
    () => filtered(true),
    "Falha ao listar os produtos",
  );

  return toProductPage(rows as ProductCardRow[], total);
}

/** Termos maiores que isto são cortados: ninguém digita um nome de produto desse tamanho. */
export const SEARCH_TERM_MAX_LENGTH = 100;

/**
 * O termo como a busca vai usá-lo: sem espaço nas pontas, espaços internos colapsados e
 * no máximo SEARCH_TERM_MAX_LENGTH caracteres. A página mostra ESTE termo, para o
 * visitante ver exatamente o que foi procurado.
 *
 * O `*` sai porque o PostgREST o trata como sinônimo de `%` dentro de like/ilike, e não há
 * como escapá-lo na URL: mantido, viraria curinga pelas costas do escape abaixo.
 */
export function normalizeSearchTerm(raw: string | null | undefined): string {
  return (raw ?? "")
    .replaceAll("*", " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SEARCH_TERM_MAX_LENGTH)
    .trim();
}

/**
 * Escapa os curingas do LIKE (`%` e `_`) e a própria barra, que é o caractere de escape
 * padrão do Postgres. Uma passada só: a barra acrescentada não é reescapada.
 */
export function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Busca por nome, sem diferenciar maiúsculas, paginada.
 *
 * O filtro é `.ilike("name", ...)` e nunca uma string montada para `.or()`: vírgula e
 * parêntese digitados pelo visitante seriam lidos como sintaxe do PostgREST e quebrariam
 * (ou alterariam) o filtro. Termo vazio não consulta o banco — devolve página vazia.
 */
export async function searchProducts(
  client: StorefrontClient,
  storeSlug: string,
  rawTerm: string,
  pagination: ProductPagination,
): Promise<ProductPage> {
  const term = normalizeSearchTerm(rawTerm);
  if (!term) return emptyPage;

  const storeId = await getStoreId(client, storeSlug);
  if (!storeId) return emptyPage;

  const { from, to } = toRange(pagination);

  const pattern = `%${escapeLikePattern(term)}%`;

  const filtered = (head: boolean) =>
    client
      .from("products")
      .select(PRODUCT_CARD_COLUMNS, { count: "exact", head })
      .eq("store_id", storeId)
      .eq("status", "published")
      .ilike("name", pattern);

  const { rows, total } = await readPage(
    () => orderProducts(filtered(false)).range(from, to),
    () => filtered(true),
    "Falha ao buscar produtos",
  );

  return toProductPage(rows as ProductCardRow[], total);
}

async function getCollectionRow(client: StorefrontClient, storeId: string, collectionSlug: string) {
  const { data, error } = await client
    .from("collections")
    .select(COLLECTION_COLUMNS)
    .eq("store_id", storeId)
    .eq("slug", collectionSlug)
    .eq("active", true)
    .maybeSingle();

  if (error) throw new Error(`Falha ao carregar a coleção: ${error.message}`);
  return data as CollectionRow | null;
}

/** Coleção ativa pelo slug. Inativa, de outra loja ou de loja desativada devolve null. */
export async function getCollection(
  client: StorefrontClient,
  storeSlug: string,
  collectionSlug: string,
): Promise<Collection | null> {
  const storeId = await getStoreId(client, storeSlug);
  if (!storeId) return null;

  const row = await getCollectionRow(client, storeId, collectionSlug);
  return row ? toCollection(row) : null;
}

/**
 * Produtos publicados de uma coleção ativa, na ordem de `collection_products.position`.
 *
 * A consulta parte do vínculo, e não do produto, porque é o vínculo que guarda a ordem.
 * O `!inner` faz o filtro do produto embutido (loja e status) valer para a linha do
 * vínculo — e para a contagem: sem ele, o vínculo de um rascunho viria com o produto
 * nulo e ainda contaria no total. `product_id` desempata posições iguais.
 */
export async function getCollectionProducts(
  client: StorefrontClient,
  storeSlug: string,
  collectionSlug: string,
  pagination: ProductPagination,
): Promise<ProductPage> {
  const storeId = await getStoreId(client, storeSlug);
  if (!storeId) return emptyPage;

  const collection = await getCollectionRow(client, storeId, collectionSlug);
  if (!collection) return emptyPage;

  const { from, to } = toRange(pagination);

  // A contagem usa o mesmo select: é o `!inner` dele que tira o rascunho do total.
  const filtered = (head: boolean) =>
    client
      .from("collection_products")
      .select(`position, products!inner(${PRODUCT_CARD_COLUMNS})`, { count: "exact", head })
      .eq("store_id", storeId)
      .eq("collection_id", collection.id)
      .eq("products.store_id", storeId)
      .eq("products.status", "published");

  const { rows, total } = await readPage(
    () =>
      filtered(false)
        .order("position", { ascending: true })
        .order("product_id", { ascending: true })
        .range(from, to),
    () => filtered(true),
    "Falha ao listar os produtos da coleção",
  );

  const products = (rows as CollectionProductRow[])
    .map(productOfLink)
    .filter((row): row is ProductCardRow => row !== null);

  return toProductPage(products, total);
}
