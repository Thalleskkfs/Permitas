import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/storefront/Breadcrumb";
import { CategoryNav } from "@/components/storefront/CategoryNav";
import { Container } from "@/components/storefront/Container";
import { Pagination } from "@/components/storefront/Pagination";
import { ProductSortSelect } from "@/components/storefront/ProductSortSelect";
import {
  botaoVinho,
  CabecalhoDaLista,
  EstadoVazio,
  ProductGrid,
} from "@/components/storefront/ProductGrid";
import { getCurrentStoreSlug } from "@/lib/current-store-slug";
import { storefrontPaths } from "@/lib/storefront-paths";
import {
  getCategories,
  getCategory,
  getCategoryProducts,
  getStore,
  parseProductSort,
} from "@/modules/storefront/queries";

const PAGE_SIZE = 8;

export async function generateMetadata({
  params,
}: PageProps<"/categoria/[category]">): Promise<Metadata> {
  const { category: categorySlug } = await params;
  const category = await getCategory(getCurrentStoreSlug(), categorySlug);
  if (!category) return {};

  return { title: category.name };
}

export default async function CategoryPage({
  params,
  searchParams,
}: PageProps<"/categoria/[category]">) {
  const storeSlug = getCurrentStoreSlug();
  const { category: categorySlug } = await params;

  const [store, category, categories] = await Promise.all([
    getStore(storeSlug),
    getCategory(storeSlug, categorySlug),
    getCategories(storeSlug),
  ]);
  if (!store || !category) notFound();

  const { page, ordem, sort } = await searchParams;
  const sortOrder = parseProductSort(ordem ?? sort);
  const pedida = Number(Array.isArray(page) ? page[0] : page);
  const paginaAtual = Number.isInteger(pedida) && pedida > 0 ? pedida : 1;

  const { products, total } = await getCategoryProducts(
    storeSlug,
    categorySlug,
    {
      offset: (paginaAtual - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
    },
    sortOrder,
  );

  const totalDePaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // `?page=999` não deve devolver uma página vazia com status 200: isso vira resultado
  // indexável e sem conteúdo. Categoria de verdade sem produto algum continua válida.
  if (products.length === 0 && total > 0) notFound();

  const paths = storefrontPaths();

  const getHref = (target: number) => {
    const query = new URLSearchParams();
    if (sortOrder !== "relevancia") query.set("ordem", sortOrder);
    query.set("page", String(target));
    return `${paths.category(category.slug)}?${query.toString()}`;
  };

  return (
    <>
      <CategoryNav categories={categories} paths={paths} activeSlug={category.slug} />

      <Container className="flex flex-col gap-8 pt-6 pb-16 sm:gap-10 sm:pb-20">
        <Breadcrumb items={[{ label: "Início", href: paths.home }, { label: category.name }]} />

        <CabecalhoDaLista titulo={category.name} total={total}>
          {total > 1 && <ProductSortSelect currentSort={sortOrder} />}
        </CabecalhoDaLista>

        {total === 0 ? (
          <EstadoVazio
            titulo="Ainda não há produtos nesta categoria."
            texto="Novidades entram por aqui assim que chegam. Enquanto isso, veja o restante da loja."
          >
            <Link href={paths.allProducts} className={botaoVinho}>
              Ver todos os produtos
            </Link>
          </EstadoVazio>
        ) : (
          <div className="entrada [--ordem:1]">
            <ProductGrid products={products} />
          </div>
        )}

        <Pagination
          currentPage={paginaAtual}
          totalPages={totalDePaginas}
          getHref={getHref}
        />
      </Container>
    </>
  );
}
