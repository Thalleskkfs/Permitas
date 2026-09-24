import { z } from "zod";
import type { ProductImage } from "../../types/catalog.ts";
import { storefrontPaths } from "../../lib/storefront-paths.ts";
import { imageSrc, toVariantGroups, type ImageRow, type VariantRow } from "./mappers.ts";
import type { StorefrontClient } from "./reads.ts";
import {
  WISHLIST_LIMITS,
  WISHLIST_MAX_ITEMS,
  WISHLIST_MAX_QUANTITY,
  isValidSlug,
  wishlistItemKey,
  type WishlistEntry,
} from "./wishlist.ts";

/**
 * Resolve a lista de interesse contra o catálogo PUBLICADO.
 *
 * Entra: slug da loja + identificadores guardados no navegador (produto, opções,
 * quantidade). Sai: nome, preço vigente, disponibilidade, link e rótulo da variante —
 * tudo lido do banco agora. Nada do que o navegador manda além de identificadores e
 * quantidade é aceito: a entrada nem tem campo de preço, e o schema é estrito, então um
 * `unitPrice` enfiado no `localStorage` é recusado em vez de ignorado em silêncio.
 *
 * O cliente chega por parâmetro (é sempre o anônimo SEM sessão; ver supabase-public.ts)
 * para que a regra seja testada contra o banco real, com o papel anon — o mesmo padrão
 * de reads.ts. Os filtros de loja e de `status = 'published'` são explícitos; a RLS é a
 * segunda linha de defesa.
 */

const slugSchema = (maxLength: number) =>
  z.string().refine((value) => isValidSlug(value, maxLength), "slug inválido");

const optionsSchema = z
  .record(
    z.string().min(1).max(WISHLIST_LIMITS.optionName),
    z.string().min(1).max(WISHLIST_LIMITS.optionValue),
  )
  .refine((value) => Object.keys(value).length <= WISHLIST_LIMITS.optionsPerItem, {
    message: "opções demais",
  });

const entrySchema = z.strictObject({
  product: slugSchema(WISHLIST_LIMITS.productSlug),
  options: optionsSchema,
  quantity: z.number().int().min(1).max(WISHLIST_MAX_QUANTITY),
});

export const wishlistRequestSchema = z.strictObject({
  storeSlug: slugSchema(WISHLIST_LIMITS.storeSlug),
  items: z.array(entrySchema).max(WISHLIST_MAX_ITEMS),
});

export type WishlistRequest = z.infer<typeof wishlistRequestSchema>;

/** Um item da lista com os dados atuais do catálogo. Preço em centavos. */
export type ResolvedWishlistItem = {
  /** Identidade do item (ver `wishlistItemKey`), para casar com a lista do navegador. */
  key: string;
  name: string;
  href: string;
  /** Preço vigente: o promocional quando houver. */
  unitPrice: number;
  /** Preço cheio, quando há promoção. */
  originalPrice?: number;
  available: boolean;
  variantLabel?: string;
  image?: ProductImage;
};

/** Item que saiu da lista, e por quê. */
export type RemovedWishlistItem = {
  key: string;
  /** O produto deixou de estar publicado (ou nunca existiu nesta loja). */
  reason: "unavailable" | "variant";
  /** Só conhecido quando o produto segue publicado e é a variante que sumiu. */
  name?: string;
};

export type WishlistResolution =
  | { ok: true; items: ResolvedWishlistItem[]; removed: RemovedWishlistItem[] }
  | { ok: false; error: "invalid-input" | "store-not-found" | "read-failed" };

type ResolvedProductRow = {
  id: string;
  slug: string;
  name: string;
  price_cents: number;
  promotional_price_cents: number | null;
  stock: number;
  product_images?: ImageRow[] | null;
  product_variants?: VariantRow[] | null;
};

// Só colunas que o papel anon pode ler (sem sku/updated_at: ver reads.ts).
const RESOLVE_COLUMNS = `id, slug, name, price_cents, promotional_price_cents, stock,
  product_images(storage_path, alt_text, position),
  product_variants(name, options, stock, position)`;

/**
 * Confere a escolha contra as variantes ATIVAS de hoje, do mesmo jeito que a página de
 * produto as apresenta: um grupo por nome de opção. A escolha precisa cobrir exatamente
 * os grupos existentes, com valores que ainda existem. Devolve o rótulo na ordem dos
 * grupos ("Tamanho M · Cor Preto") e se todas as opções escolhidas têm estoque.
 */
function matchVariant(row: ResolvedProductRow, options: Record<string, string>) {
  const groups = toVariantGroups(row.product_variants);
  const chosen = Object.keys(options);

  if (chosen.length !== groups.length) return null;

  const parts: string[] = [];
  let available = true;

  for (const group of groups) {
    const value = options[group.name];
    const option = group.options.find((candidate) => candidate.value === value);
    if (!option) return null;
    available &&= option.available;
    parts.push(`${group.name} ${value}`);
  }

  return { label: parts.join(" · ") || undefined, available };
}

function firstImage(rows: ImageRow[] | null | undefined, name: string): ProductImage | undefined {
  const first = [...(rows ?? [])].sort((a, b) => a.position - b.position)[0];
  if (!first) return undefined;
  // Faltava montar o endereço público a partir do `storage_path`: sem isso, o carrinho
  // sempre caía no estado "sem foto", mesmo com fotos publicadas (ver mappers.ts toImage).
  const src = imageSrc(first.storage_path);
  const alt = first.alt_text ?? name;
  return src ? { src, alt } : { alt };
}

export async function resolveWishlistWith(
  client: StorefrontClient,
  input: unknown,
): Promise<WishlistResolution> {
  const parsed = wishlistRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid-input" };

  const { storeSlug, items } = parsed.data as { storeSlug: string; items: WishlistEntry[] };

  try {
    const store = await client
      .from("stores")
      .select("id")
      .eq("slug", storeSlug)
      .eq("active", true)
      .maybeSingle();

    if (store.error) return { ok: false, error: "read-failed" };
    if (!store.data) return { ok: false, error: "store-not-found" };

    if (items.length === 0) return { ok: true, items: [], removed: [] };

    const slugs = [...new Set(items.map((item) => item.product))];

    const { data, error } = await client
      .from("products")
      .select(RESOLVE_COLUMNS)
      .eq("store_id", store.data.id)
      .eq("status", "published")
      .in("slug", slugs)
      .eq("product_variants.active", true);

    if (error) return { ok: false, error: "read-failed" };

    const bySlug = new Map(
      ((data ?? []) as ResolvedProductRow[]).map((row) => [row.slug, row] as const),
    );
    const paths = storefrontPaths();

    const resolved: ResolvedWishlistItem[] = [];
    const removed: RemovedWishlistItem[] = [];
    const seen = new Set<string>();

    for (const item of items) {
      const key = wishlistItemKey(item);
      if (seen.has(key)) continue;
      seen.add(key);

      const row = bySlug.get(item.product);
      if (!row) {
        removed.push({ key, reason: "unavailable" });
        continue;
      }

      const variant = matchVariant(row, item.options);
      if (!variant) {
        removed.push({ key, reason: "variant", name: row.name });
        continue;
      }

      const promotional = row.promotional_price_cents;

      resolved.push({
        key,
        name: row.name,
        href: paths.product(row.slug),
        unitPrice: promotional ?? row.price_cents,
        originalPrice: promotional === null ? undefined : row.price_cents,
        available: row.stock > 0 && variant.available,
        variantLabel: variant.label,
        image: firstImage(row.product_images, row.name),
      });
    }

    return { ok: true, items: resolved, removed };
  } catch {
    return { ok: false, error: "read-failed" };
  }
}
