import { notFound } from "next/navigation";
import { CategoryNav } from "@/components/storefront/CategoryNav";
import { Container } from "@/components/storefront/Container";
import { Hero } from "@/components/storefront/Hero";
import { ProductSection } from "@/components/storefront/ProductSection";
import { storefrontPaths } from "@/lib/storefront-paths";
import {
  getCategories,
  getFeaturedProducts,
  getPromotionalProducts,
  getStore,
} from "@/modules/catalog/mock";
import { toProductCard } from "@/modules/catalog/product-card";

export default async function StoreHomePage({ params }: PageProps<"/loja/[store]">) {
  const { store: storeSlug } = await params;
  const store = getStore(storeSlug);
  if (!store) notFound();

  const paths = storefrontPaths(store.slug);
  const featured = getFeaturedProducts(4).map((product) => toProductCard(product, paths));
  const promotional = getPromotionalProducts(4).map((product) => toProductCard(product, paths));

  return (
    <>
      {store.hero ? <Hero {...store.hero} /> : <h1 className="sr-only">{store.name}</h1>}
      <CategoryNav categories={getCategories()} paths={paths} />

      <Container className="flex flex-col gap-14 py-10">
        <ProductSection
          title="Produtos em destaque"
          products={featured}
          viewAllHref={paths.category("exemplo")}
        />
        <ProductSection title="Em promoção" products={promotional} />
      </Container>
    </>
  );
}
