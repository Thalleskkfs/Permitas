import type {
  Category,
  Product,
  ProductCardData,
  HeroSlide,
  ProductImage,
  Store,
  StoreAbout,
  VariantGroup,
} from "../../types/catalog.ts";
import type { StorefrontPaths } from "../../lib/storefront-paths.ts";
import { parseCatalogImagePath } from "../../lib/storage/catalog-image-path.ts";
import { normalizeWhatsAppNumber } from "./whatsapp.ts";

/**
 * Converte as linhas do banco nos tipos de apresentação da vitrine.
 *
 * As colunas aqui declaradas são exatamente as que o papel `anon` recebe: `sku` e
 * `updated_at`, por exemplo, não existem para o visitante e não aparecem em row type
 * nenhum deste arquivo.
 *
 * Duas conversões merecem nota:
 *
 *   * preço continua em CENTAVOS, inteiro, do banco até o componente — nenhuma divisão
 *     acontece nesta camada;
 *   * a imagem sai sem `src`. O bucket do catálogo é privado e não existe endereço
 *     público para os arquivos; o `alt` é o que a vitrine consegue renderizar hoje.
 */

const PROMOTION_BADGE = "Promoção";
const WHATSAPP_LABEL = "Falar no WhatsApp";

export type StoreSettingsRow = {
  whatsapp_number: string | null;
  whatsapp_message_template: string | null;
  about_image_path?: string | null;
  about_image_alt?: string | null;
  about_text?: string | null;
};

export type StoreRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  store_settings: StoreSettingsRow | StoreSettingsRow[] | null;
  store_banners?: BannerRow[] | null;
};

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
};

export type ImageRow = { storage_path: string; alt_text: string | null; position: number };

export type BannerRow = {
  id: string;
  title: string;
  subtitle: string | null;
  cta_label: string | null;
  cta_href: string | null;
  image_path: string | null;
  image_path_mobile: string | null;
  image_alt: string | null;
  position: number;
};

export type VariantRow = {
  name: string;
  options: unknown;
  stock: number;
  position: number;
};

export type ProductCardRow = {
  id: string;
  slug: string;
  name: string;
  price_cents: number;
  promotional_price_cents: number | null;
  stock: number;
  product_images?: ImageRow[] | null;
};

/** Vínculo coleção–produto com o produto embutido; `position` é a ordem da vitrine. */
export type CollectionProductRow = {
  position: number;
  products: ProductCardRow | ProductCardRow[] | null;
};

export type CollectionRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

/**
 * Coleção vista pela vitrine. Mora aqui, e não em types/catalog.ts, porque por ora só a
 * página de coleção a consome.
 */
export type Collection = {
  slug: string;
  name: string;
  description?: string;
};

export type ProductRow = ProductCardRow & {
  short_description: string | null;
  description: string | null;
  featured: boolean;
  categories?: { slug: string } | { slug: string }[] | null;
  product_variants?: VariantRow[] | null;
  product_tags?: { tags: { name: string } | { name: string }[] | null }[] | null;
};

const byPosition = <T extends { position: number }>(rows: T[]) =>
  [...rows].sort((a, b) => a.position - b.position);

/** Um vínculo para-um chega como objeto; normalizamos para não depender da forma. */
function first<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

const promotionalPrice = (cents: number | null) => cents ?? undefined;

const badge = (cents: number | null) => (cents === null ? undefined : PROMOTION_BADGE);

/** Disponibilidade é estoque do produto; a variante refina a opção, não o produto. */
const isAvailable = (stock: number) => stock > 0;

/**
 * Endereço público de um arquivo do bucket: a rota /imagens do próprio site, que só o
 * entrega se uma linha visível ao visitante o referencia. Caminho fora da convenção não
 * vira endereço — a imagem sai sem `src` e a vitrine mostra o estado sem foto.
 */
export function imageSrc(path: string | null | undefined): string | undefined {
  if (!path || !parseCatalogImagePath(path)) return undefined;
  return `/imagens/${path}`;
}

function toImage(row: ImageRow, productName: string): ProductImage {
  const src = imageSrc(row.storage_path);
  const alt = row.alt_text ?? productName;
  return src ? { src, alt } : { alt };
}

function toImages(rows: ImageRow[] | null | undefined, productName: string): ProductImage[] {
  return byPosition(rows ?? []).map((row) => toImage(row, productName));
}

/** O WhatsApp da loja é a única ação de contato da hero; sem número, não há botão. */
function toContact(settings: StoreSettingsRow | null) {
  const number = settings?.whatsapp_number ? normalizeWhatsAppNumber(settings.whatsapp_number) : null;
  if (!number) return {};
  return { contactLabel: WHATSAPP_LABEL, contactHref: `https://wa.me/${number}` };
}

/** Só existe com foto E texto: metade da seção sozinha não é publicável. */
function toAbout(settings: StoreSettingsRow | null, storeName: string): StoreAbout | undefined {
  const text = settings?.about_text?.trim();
  const src = imageSrc(settings?.about_image_path);
  if (!text || !src) return undefined;

  return { image: { src, alt: settings?.about_image_alt ?? storeName }, text };
}

function toSlides(rows: BannerRow[] | null | undefined): HeroSlide[] | null {
  if (!rows || rows.length === 0) return null;

  return byPosition(rows).map((banner) => {
    const alt = banner.image_alt ?? "";
    const src = imageSrc(banner.image_path);
    const srcMobile = imageSrc(banner.image_path_mobile);
    return {
      id: banner.id,
      title: banner.title,
      subtitle: banner.subtitle ?? undefined,
      // O banco só aceita caminho interno e chamada completa (rótulo + destino).
      actionLabel: banner.cta_label ?? undefined,
      actionHref: banner.cta_href ?? undefined,
      image: src ? { src, alt } : undefined,
      imageMobile: srcMobile ? { src: srcMobile, alt } : undefined,
    };
  });
}

export function toStore(row: StoreRow): Store {
  const description = row.description ?? undefined;
  const settings = first(row.store_settings);

  return {
    slug: row.slug,
    name: row.name,
    description,
    hero: {
      // Os banners ativos cadastrados no painel, na ordem definida lá. Loja sem banner
      // nenhum ainda tem hero: o nome e a descrição da própria loja, sem imagem.
      slides: toSlides(row.store_banners) ?? [{ id: row.id, title: row.name, subtitle: description }],
      ...toContact(settings),
    },
    about: toAbout(settings, row.name),
    // Crus, sem normalizar: quem monta a mensagem do carrinho precisa do original.
    whatsappNumber: settings?.whatsapp_number ?? null,
    whatsappMessageTemplate: settings?.whatsapp_message_template ?? null,
  };
}

export function toCategory(row: CategoryRow): Category {
  return { slug: row.slug, name: row.name };
}

export function toCollection(row: CollectionRow): Collection {
  return { slug: row.slug, name: row.name, description: row.description ?? undefined };
}

/** O produto do vínculo, se ele veio: sem produto publicado, o vínculo não vira cartão. */
export function productOfLink(row: CollectionProductRow): ProductCardRow | null {
  return first(row.products);
}

/** Opções em texto, como o banco garante: `{"cor": "Preto", "tamanho": "M"}`. */
function toOptions(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

/**
 * Agrupa as variantes por nome de opção, preservando a ordem de `position`.
 *
 * A variante inativa não chega aqui: quem a exclui é a consulta, em reads.ts. Repetir o
 * filtro neste arquivo deixaria a regra em dois lugares e nenhum teste conseguiria
 * distinguir qual dos dois está de fato segurando a porta.
 */
export function toVariantGroups(rows: VariantRow[] | null | undefined): VariantGroup[] {
  const groups = new Map<string, Map<string, boolean>>();

  for (const row of byPosition(rows ?? [])) {
    const available = isAvailable(row.stock);

    for (const [name, value] of Object.entries(toOptions(row.options))) {
      const options = groups.get(name) ?? new Map<string, boolean>();
      options.set(value, (options.get(value) ?? false) || available);
      groups.set(name, options);
    }
  }

  return [...groups].map(([name, options]) => ({
    name,
    options: [...options].map(([value, available]) => ({ value, available })),
  }));
}

export function toProduct(row: ProductRow): Product {
  const category = first(row.categories);

  return {
    slug: row.slug,
    name: row.name,
    shortDescription: row.short_description ?? "",
    description: row.description ?? "",
    price: row.price_cents,
    promotionalPrice: promotionalPrice(row.promotional_price_cents),
    available: isAvailable(row.stock),
    badge: badge(row.promotional_price_cents),
    images: toImages(row.product_images, row.name),
    variants: toVariantGroups(row.product_variants),
    tags: (row.product_tags ?? [])
      .map((link) => first(link.tags)?.name)
      .filter((name): name is string => Boolean(name)),
    // O banco não guarda ficha técnica: a seção fica vazia até existir campo para ela.
    additionalInfo: [],
    categorySlugs: category ? [category.slug] : [],
    featured: row.featured,
  };
}

export function toProductCard(row: ProductCardRow, paths: StorefrontPaths): ProductCardData {
  const images = toImages(row.product_images, row.name);

  return {
    name: row.name,
    href: paths.product(row.slug),
    price: row.price_cents,
    promotionalPrice: promotionalPrice(row.promotional_price_cents),
    available: isAvailable(row.stock),
    badge: badge(row.promotional_price_cents),
    image: images[0],
  };
}
