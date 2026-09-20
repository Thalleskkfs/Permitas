import Link from "next/link";
import { formatPrice } from "@/lib/format";
import type { ProductCardData } from "@/types/catalog";
import { ProductImage } from "./ProductImage";

export function ProductCard({ product }: { product: ProductCardData }) {
  const hasPromotion = product.promotionalPrice !== undefined;
  const currentPrice = product.promotionalPrice ?? product.price;

  return (
    <article className="group relative flex flex-col gap-3">
      <div className="relative">
        <ProductImage
          image={product.image}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="rounded-md border border-border"
        />
        {product.badge && (
          <span className="absolute left-2 top-2 rounded-sm bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
            {product.badge}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium leading-snug">
          <Link
            href={product.href}
            className="focus-ring after:absolute after:inset-0 group-hover:underline"
          >
            {product.name}
          </Link>
        </h3>

        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className={hasPromotion ? "font-semibold" : "font-medium"}>
            {formatPrice(currentPrice)}
          </span>
          {hasPromotion && (
            <s className="text-muted-foreground">{formatPrice(product.price)}</s>
          )}
        </p>

        {!product.available && (
          <p className="text-xs text-muted-foreground">Indisponível</p>
        )}
      </div>
    </article>
  );
}
