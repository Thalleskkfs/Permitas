/**
 * Opções de ordenação disponíveis nas listagens da vitrine.
 *
 * Cada valor mapeia para uma combinação estável de colunas no PostgREST/Supabase,
 * garantindo paginação determinística sem repetição ou pulo de itens.
 */

export const PRODUCT_SORT_OPTIONS = [
  { value: "relevancia", label: "Relevância" },
  { value: "menor-preco", label: "Menor preço" },
  { value: "maior-preco", label: "Maior preço" },
  { value: "mais-recentes", label: "Mais recentes" },
] as const;

export type ProductSortOption = (typeof PRODUCT_SORT_OPTIONS)[number]["value"];
export type ProductSortOrder = ProductSortOption;

export const DEFAULT_PRODUCT_SORT: ProductSortOption = "relevancia";

/**
 * Valida e normaliza o parâmetro de ordenação vindo da URL (ou formulário).
 * Valores desconhecidos ou vazios voltam silenciosamente para a ordenação padrão ("relevancia").
 */
export function parseProductSort(raw: unknown): ProductSortOption {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return DEFAULT_PRODUCT_SORT;

  const normalized = value.trim().toLowerCase();

  switch (normalized) {
    case "menor-preco":
    case "menor_preco":
    case "menor-preço":
    case "menor_preço":
    case "price-asc":
    case "preco-crescente":
      return "menor-preco";

    case "maior-preco":
    case "maior_preco":
    case "maior-preço":
    case "maior_preço":
    case "price-desc":
    case "preco-decrescente":
      return "maior-preco";

    case "mais-recentes":
    case "mais_recentes":
    case "recentes":
    case "date-desc":
      return "mais-recentes";

    case "relevancia":
    case "padrao":
    case "destaque":
    case "destaques":
      return "relevancia";

    default:
      return DEFAULT_PRODUCT_SORT;
  }
}
