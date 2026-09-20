import Link from "next/link";
import { useId } from "react";
import type { ProductCardData } from "@/types/catalog";
import { ProductGrid } from "./ProductGrid";

type ProductSectionProps = {
  title: string;
  products: ProductCardData[];
  viewAllHref?: string;
};

export function ProductSection({ title, products, viewAllHref }: ProductSectionProps) {
  const titleId = useId();

  if (products.length === 0) return null;

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={titleId} className="text-xl font-semibold">
          {title}
        </h2>
        {viewAllHref && (
          <Link href={viewAllHref} className="focus-ring text-sm text-muted-foreground underline hover:text-foreground">
            Ver todos
          </Link>
        )}
      </div>
      <ProductGrid products={products} />
    </section>
  );
}
