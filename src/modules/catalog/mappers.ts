import type {
  AdminCategory,
  AdminCategoryNode,
  AdminCollection,
  AdminImage,
  AdminProduct,
  AdminTag,
  AdminVariant,
  ProductStatus,
} from "@/types/dashboard";

/**
 * Converte as linhas do banco nos tipos de apresentação do painel.
 *
 * É o que permite a interface continuar igual: os componentes seguem consumindo
 * AdminProduct e afins, sem saber que a origem deixou de ser mock.
 */

type ImageRow = { id: string; alt_text: string | null; position: number; storage_path: string };
type VariantRow = {
  id: string;
  name: string;
  sku: string | null;
  price_cents: number | null;
  stock: number;
  active: boolean;
  position: number;
  options: unknown;
};

export type ProductRow = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  short_description: string | null;
  description: string | null;
  category_id: string | null;
  price_cents: number;
  promotional_price_cents: number | null;
  stock: number;
  status: ProductStatus;
  featured: boolean;
  created_at: string;
  product_images?: ImageRow[] | null;
  product_variants?: VariantRow[] | null;
  product_tags?: { tag_id: string }[] | null;
  collection_products?: { collection_id: string }[] | null;
};

const byPosition = <T extends { position: number }>(rows: T[]) =>
  [...rows].sort((a, b) => a.position - b.position);

/**
 * Rota que serve o bucket privado ao próprio painel autenticado; a leitura pública
 * (vitrine) usa a mesma rota, mas resolve por outro caminho (ver modules/storefront).
 */
function toImage(row: ImageRow, productName: string): AdminImage {
  return {
    id: row.id,
    alt: row.alt_text ?? productName,
    storagePath: row.storage_path,
    url: `/imagens/${row.storage_path}`,
  };
}

function toVariant(row: VariantRow): AdminVariant {
  const options =
    row.options && typeof row.options === "object" && !Array.isArray(row.options)
      ? (row.options as Record<string, string>)
      : {};

  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    priceCents: row.price_cents,
    stock: row.stock,
    active: row.active,
    options,
  };
}

export function toAdminProduct(row: ProductRow): AdminProduct {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    sku: row.sku,
    shortDescription: row.short_description ?? "",
    description: row.description ?? "",
    categoryId: row.category_id,
    tagIds: (row.product_tags ?? []).map((link) => link.tag_id),
    collectionIds: (row.collection_products ?? []).map((link) => link.collection_id),
    priceCents: row.price_cents,
    promotionalPriceCents: row.promotional_price_cents,
    stock: row.stock,
    status: row.status,
    featured: row.featured,
    images: byPosition(row.product_images ?? []).map((image) => toImage(image, row.name)),
    variants: byPosition(row.product_variants ?? []).map(toVariant),
    createdAt: row.created_at,
  };
}

/** PostgREST devolve agregados embutidos como [{ count }]. */
const embeddedCount = (value: { count: number }[] | null | undefined) => value?.[0]?.count ?? 0;

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  active: boolean;
  sort_order: number;
  products?: { count: number }[] | null;
};

export function toAdminCategory(row: CategoryRow): AdminCategory {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    parentId: row.parent_id,
    active: row.active,
    sortOrder: row.sort_order,
    productCount: embeddedCount(row.products),
  };
}

/** Achata a hierarquia preservando ordem e profundidade, como a interface espera. */
export function toCategoryTree(categories: AdminCategory[]): AdminCategoryNode[] {
  const childrenOf = (parentId: string | null) =>
    categories
      .filter((category) => category.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR"));

  const walk = (parentId: string | null, depth: number): AdminCategoryNode[] =>
    childrenOf(parentId).flatMap((category) => [
      { ...category, depth },
      ...walk(category.id, depth + 1),
    ]);

  const tree = walk(null, 0);
  // Categorias cujo pai não está visível não podem sumir da tela.
  const seen = new Set(tree.map((node) => node.id));
  const orphans = categories.filter((category) => !seen.has(category.id));
  return [...tree, ...orphans.map((category) => ({ ...category, depth: 0 }))];
}

export type TagRow = {
  id: string;
  name: string;
  slug: string;
  product_tags?: { count: number }[] | null;
};

export function toAdminTag(row: TagRow): AdminTag {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    usageCount: embeddedCount(row.product_tags),
  };
}

export type CollectionRow = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  sort_order: number;
  collection_products?: { count: number }[] | null;
};

export function toAdminCollection(row: CollectionRow): AdminCollection {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    active: row.active,
    position: row.sort_order,
    productCount: embeddedCount(row.collection_products),
  };
}
