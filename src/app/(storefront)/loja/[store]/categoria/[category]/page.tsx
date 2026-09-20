import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/storefront/Breadcrumb";
import { CategoryNav } from "@/components/storefront/CategoryNav";
import { Container } from "@/components/storefront/Container";
import { Pagination } from "@/components/storefront/Pagination";
import { ProductGrid } from "@/components/storefront/ProductGrid";
import { storefrontPaths } from "@/lib/storefront-paths";
import {
  getCategories,
  getCategory,
  getProductsByCategory,
  getStore,
} from "@/modules/catalog/mock";
import { toProductCard } from "@/modules/catalog/product-card";

const PAGE_SIZE = 8;

export default async function CategoryPage({
  params,
  searchParams,
}: PageProps<"/loja/[store]/categoria/[category]">) {
  const { store: storeSlug, category: categorySlug } = await params;
  const store = getStore(storeSlug);
  const category = getCategory(categorySlug);
  if (!store || !category) notFound();

  const paths = storefrontPaths(store.slug);
  const products = getProductsByCategory(category.slug);
  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));

  const { page } = await searchParams;
  const requestedPage = Number(Array.isArray(page) ? page[0] : page);
  const currentPage = Number.isInteger(requestedPage)
    ? Math.min(Math.max(requestedPage, 1), totalPages)
    : 1;

  const pageProducts = products
    .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
    .map((product) => toProductCard(product, paths));

  return (
    <>
      <CategoryNav categories={getCategories()} paths={paths} activeSlug={category.slug} />

      <Container className="flex flex-col gap-8 py-8">
        <Breadcrumb
          items={[{ label: "Início", href: paths.home }, { label: category.name }]}
        />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold sm:text-3xl">{category.name}</h1>
            <p className="text-sm text-muted-foreground">
              {products.length} {products.length === 1 ? "produto" : "produtos"}
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Ordenar por</span>
            <select className="focus-ring rounded-md border border-border bg-background px-3 py-2">
              <option>Relevância</option>
              <option>Menor preço</option>
              <option>Maior preço</option>
              <option>Mais recentes</option>
            </select>
          </label>
        </div>

        <ProductGrid products={pageProducts} />

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          getHref={(target) => `${paths.category(category.slug)}?page=${target}`}
        />
      </Container>
    </>
  );
}
