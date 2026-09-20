import type { ProductCardData } from "@/types/catalog";
import { ProductSection } from "./ProductSection";

export function RelatedProducts({ products }: { products: ProductCardData[] }) {
  return <ProductSection title="Produtos relacionados" products={products} />;
}
