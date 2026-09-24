import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AdminStockRow, DashboardStats } from "@/types/dashboard";
import {
  toAdminCategory,
  toAdminCollection,
  toAdminProduct,
  toAdminTag,
  toCategoryTree,
  type CategoryRow,
  type CollectionRow,
  type ProductRow,
  type TagRow,
} from "./mappers";
import { PRODUCTS_PER_PAGE, toSearchPattern, type ProductQuery } from "./schemas";

/**
 * Leitura do catálogo.
 *
 * Tudo passa pelo cliente de SESSÃO, então a RLS filtra por loja em cada consulta. O
 * `storeId` recebido vem sempre do contexto autorizado (requireCurrentStore) e serve
 * para restringir ainda mais, nunca para conceder acesso: um id de outra loja
 * simplesmente não retorna linhas.
 */

const PRODUCT_COLUMNS =
  "id, name, slug, sku, short_description, description, category_id, price_cents, promotional_price_cents, stock, status, featured, created_at";

const SORT_COLUMNS: Record<ProductQuery["sort"], { column: string; ascending: boolean }> = {
  recent: { column: "created_at", ascending: false },
  name: { column: "name", ascending: true },
  price: { column: "price_cents", ascending: true },
  stock: { column: "stock", ascending: true },
};

export type ProductListResult = {
  products: ReturnType<typeof toAdminProduct>[];
  total: number;
  page: number;
  pageCount: number;
};

export async function listProducts(storeId: string, query: ProductQuery): Promise<ProductListResult> {
  const supabase = await createClient();

  let request = supabase
    .from("products")
    .select(`${PRODUCT_COLUMNS}, product_images(id, alt_text, position, storage_path)`, { count: "exact" })
    .eq("store_id", storeId);

  if (query.status !== "all") request = request.eq("status", query.status);
  if (query.categoryId) request = request.eq("category_id", query.categoryId);

  const pattern = toSearchPattern(query.q);
  if (pattern) request = request.or(`name.ilike.${pattern},sku.ilike.${pattern}`);

  const sort = SORT_COLUMNS[query.sort];
  const from = (query.page - 1) * PRODUCTS_PER_PAGE;

  const { data, count, error } = await request
    .order(sort.column, { ascending: sort.ascending })
    .order("id", { ascending: true })
    .range(from, from + PRODUCTS_PER_PAGE - 1);

  if (error) throw new Error(`Falha ao listar produtos: ${error.message}`);

  const total = count ?? 0;
  return {
    // A listagem não carrega variantes: a tela não as usa.
    products: (data as ProductRow[]).map(toAdminProduct),
    total,
    page: query.page,
    pageCount: Math.max(1, Math.ceil(total / PRODUCTS_PER_PAGE)),
  };
}

export async function getProduct(storeId: string, productId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(
      `${PRODUCT_COLUMNS},
       product_images(id, alt_text, position, storage_path),
       product_variants(id, name, sku, price_cents, stock, active, position, options),
       product_tags(tag_id),
       collection_products(collection_id)`,
    )
    .eq("store_id", storeId)
    .eq("id", productId)
    .maybeSingle();

  if (error) throw new Error(`Falha ao carregar o produto: ${error.message}`);
  return data ? toAdminProduct(data as ProductRow) : null;
}

export async function listCategories(storeId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id, active, sort_order, products(count)")
    .eq("store_id", storeId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(`Falha ao listar categorias: ${error.message}`);
  return (data as CategoryRow[]).map(toAdminCategory);
}

export async function listCategoryTree(storeId: string) {
  return toCategoryTree(await listCategories(storeId));
}

export async function listTags(storeId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tags")
    .select("id, name, slug, product_tags(count)")
    .eq("store_id", storeId)
    .order("name", { ascending: true });

  if (error) throw new Error(`Falha ao listar tags: ${error.message}`);
  return (data as TagRow[]).map(toAdminTag);
}

export async function listCollections(storeId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("collections")
    .select("id, name, slug, active, sort_order, collection_products(count)")
    .eq("store_id", storeId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(`Falha ao listar coleções: ${error.message}`);
  return (data as CollectionRow[]).map(toAdminCollection);
}

/**
 * Estoque por produto e por variante. Não há histórico de movimentação: a tela mostra a
 * quantidade atual, que é o que o banco guarda.
 */
export async function listStockRows(storeId: string): Promise<AdminStockRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("id, name, sku, stock, product_variants(id, name, sku, stock, position)")
    .eq("store_id", storeId)
    .order("name", { ascending: true });

  if (error) throw new Error(`Falha ao carregar o estoque: ${error.message}`);

  return (data ?? []).flatMap((product): AdminStockRow[] => {
    const variants = [...(product.product_variants ?? [])].sort((a, b) => a.position - b.position);

    return variants.length > 0
      ? variants.map((variant) => ({
          id: variant.id,
          productId: product.id,
          productName: product.name,
          sku: variant.sku,
          variantName: variant.name,
          stock: variant.stock,
        }))
      : [
          {
            id: product.id,
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            variantName: null,
            stock: product.stock,
          },
        ];
  });
}

/** Métricas que o banco suporta hoje. Nada é estimado. */
export async function getCatalogStats(storeId: string): Promise<Pick<DashboardStats, "totalProducts" | "publishedProducts" | "inStockProducts">> {
  const supabase = await createClient();

  const countProducts = async (apply?: (q: ReturnType<typeof baseQuery>) => ReturnType<typeof baseQuery>) => {
    const query = apply ? apply(baseQuery()) : baseQuery();
    const { count, error } = await query;
    if (error) throw new Error(`Falha ao calcular métricas: ${error.message}`);
    return count ?? 0;
  };

  function baseQuery() {
    return supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId);
  }

  const [totalProducts, publishedProducts, inStockProducts] = await Promise.all([
    countProducts(),
    countProducts((query) => query.eq("status", "published")),
    countProducts((query) => query.gt("stock", 0)),
  ]);

  return { totalProducts, publishedProducts, inStockProducts };
}

export async function listRecentProducts(storeId: string, limit: number) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(`${PRODUCT_COLUMNS}, product_images(id, alt_text, position, storage_path)`)
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Falha ao carregar produtos recentes: ${error.message}`);
  return (data as ProductRow[]).map(toAdminProduct);
}
