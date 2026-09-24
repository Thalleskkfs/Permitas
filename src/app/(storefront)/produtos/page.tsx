import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/storefront/Breadcrumb";
import { CategoryNav } from "@/components/storefront/CategoryNav";
import { Container } from "@/components/storefront/Container";
import { Pagination } from "@/components/storefront/Pagination";
import { CabecalhoDaLista, EstadoVazio, ProductGrid } from "@/components/storefront/ProductGrid";
import { getCurrentStoreSlug } from "@/lib/current-store-slug";
import { storefrontPaths } from "@/lib/storefront-paths";
import { getAllProducts, getCategories, getStore } from "@/modules/storefront/queries";

const PAGE_SIZE = 8;

export const metadata: Metadata = { title: "Todos os produtos" };

export default async function AllProductsPage({
  searchParams,
}: PageProps<"/produtos">) {
  const storeSlug = getCurrentStoreSlug();

  const [store, categories] = await Promise.all([getStore(storeSlug), getCategories(storeSlug)]);
  if (!store) notFound();

  const { page } = await searchParams;
  const pedida = Number(Array.isArray(page) ? page[0] : page);
  const paginaAtual = Number.isInteger(pedida) && pedida > 0 ? pedida : 1;

  const { products, total } = await getAllProducts(storeSlug, {
    offset: (paginaAtual - 1) * PAGE_SIZE,
    limit: PAGE_SIZE,
  });

  const totalDePaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Mesmo critério da categoria: página além da última é 404, não lista vazia com 200.
  if (products.length === 0 && total > 0) notFound();

  const paths = storefrontPaths();

  return (
    <>
      <CategoryNav categories={categories} paths={paths} />

      <Container className="flex flex-col gap-8 pt-6 pb-16 sm:gap-10 sm:pb-20">
        <Breadcrumb items={[{ label: "Início", href: paths.home }, { label: "Todos os produtos" }]} />

        <CabecalhoDaLista titulo="Todos os produtos" total={total} />

        {total === 0 ? (
          <EstadoVazio
            titulo="A vitrine está sendo montada."
            texto="Os produtos aparecem aqui assim que forem publicados. Volte em breve."
          />
        ) : (
          <div className="entrada [--ordem:1]">
            <ProductGrid products={products} />
          </div>
        )}

        <Pagination
          currentPage={paginaAtual}
          totalPages={totalDePaginas}
          getHref={(target) => `${paths.allProducts}?page=${target}`}
        />
      </Container>
    </>
  );
}
