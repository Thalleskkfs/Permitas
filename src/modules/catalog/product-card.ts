import type { StorefrontPaths } from "@/lib/storefront-paths";
import type { Product, ProductCardData } from "@/types/catalog";

export function toProductCard(product: Product, paths: StorefrontPaths): ProductCardData {
  return {
    name: product.name,
    href: paths.product(product.slug),
    price: product.price,
    promotionalPrice: product.promotionalPrice,
    available: product.available,
    badge: product.badge,
    image: product.images[0],
  };
}
