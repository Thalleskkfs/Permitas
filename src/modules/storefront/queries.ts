import "server-only";

import type { Category, Product, ProductCardData, Store } from "@/types/catalog";
import * as reads from "./reads";
import type { CategoryPreview, Collection, ProductPage, ProductPagination } from "./reads";
import { createPublicClient } from "./supabase-public";

/**
 * Porta de entrada da vitrine para o banco.
 *
 * É a camada que as páginas públicas consomem no lugar do mock. Só faz uma coisa: ligar
 * as leituras de reads.ts ao cliente anônimo SEM sessão (ver supabase-public.ts). Toda
 * a lógica de consulta e de conversão vive em reads.ts e mappers.ts.
 *
 * O `import "server-only"` faz o build falhar se um Client Component alcançar este
 * módulo. A vitrine lê no servidor, durante a renderização.
 *
 * Listagens devolvem `ProductCardData` já com o `href` montado a partir do slug da loja;
 * a página de produto recebe `Product` completo.
 */

export type { CategoryPreview, Collection, ProductPage, ProductPagination };

// Funções puras, sem banco: a página de busca usa para mostrar o termo que foi de fato
// procurado e para limitar o campo.
export { normalizeSearchTerm, SEARCH_TERM_MAX_LENGTH } from "./reads";

export async function getStore(storeSlug: string): Promise<Store | null> {
  return reads.getStore(createPublicClient(), storeSlug);
}

export async function getCategories(storeSlug: string): Promise<Category[]> {
  return reads.getCategories(createPublicClient(), storeSlug);
}

export async function getCategoryPreviews(
  storeSlug: string,
): Promise<{ categories: CategoryPreview[]; total: number }> {
  return reads.getCategoryPreviews(createPublicClient(), storeSlug);
}

export async function getCategory(
  storeSlug: string,
  categorySlug: string,
): Promise<Category | null> {
  return reads.getCategory(createPublicClient(), storeSlug, categorySlug);
}

export async function getCategoryProducts(
  storeSlug: string,
  categorySlug: string,
  pagination: ProductPagination,
): Promise<ProductPage> {
  return reads.getCategoryProducts(createPublicClient(), storeSlug, categorySlug, pagination);
}

export async function getProduct(
  storeSlug: string,
  productSlug: string,
): Promise<Product | null> {
  return reads.getProduct(createPublicClient(), storeSlug, productSlug);
}

export async function getFeaturedProducts(
  storeSlug: string,
  limit: number,
): Promise<ProductCardData[]> {
  return reads.getFeaturedProducts(createPublicClient(), storeSlug, limit);
}

export async function getPromotionalProducts(
  storeSlug: string,
  limit: number,
): Promise<ProductCardData[]> {
  return reads.getPromotionalProducts(createPublicClient(), storeSlug, limit);
}

export async function getRelatedProducts(
  storeSlug: string,
  product: Product,
  limit: number,
): Promise<ProductCardData[]> {
  return reads.getRelatedProducts(createPublicClient(), storeSlug, product, limit);
}

export async function getAllProducts(
  storeSlug: string,
  pagination: ProductPagination,
): Promise<ProductPage> {
  return reads.getAllProducts(createPublicClient(), storeSlug, pagination);
}

export async function searchProducts(
  storeSlug: string,
  term: string,
  pagination: ProductPagination,
): Promise<ProductPage> {
  return reads.searchProducts(createPublicClient(), storeSlug, term, pagination);
}

export async function getCollection(
  storeSlug: string,
  collectionSlug: string,
): Promise<Collection | null> {
  return reads.getCollection(createPublicClient(), storeSlug, collectionSlug);
}

export async function getCollectionProducts(
  storeSlug: string,
  collectionSlug: string,
  pagination: ProductPagination,
): Promise<ProductPage> {
  return reads.getCollectionProducts(createPublicClient(), storeSlug, collectionSlug, pagination);
}
