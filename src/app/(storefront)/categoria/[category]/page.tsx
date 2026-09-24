import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/storefront/Breadcrumb";
import { CategoryNav } from "@/components/storefront/CategoryNav";
import { Container } from "@/components/storefront/Container";
import { Pagination } from "@/components/storefront/Pagination";
import { ChevronRightIcon } from "@/components/storefront/icons";
import {
  botaoVinho,
  CabecalhoDaLista,
  campo,
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

  const { page } = await searchParams;
  const pedida = Number(Array.isArray(page) ? page[0] : page);
  const paginaAtual = Number.isInteger(pedida) && pedida > 0 ? pedida : 1;

  const { products, total } = await getCategoryProducts(storeSlug, categorySlug, {
    offset: (paginaAtual - 1) * PAGE_SIZE,
    limit: PAGE_SIZE,
  });

  const totalDePaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // `?page=999` não deve devolver uma página vazia com status 200: isso vira resultado
  // indexável e sem conteúdo. Categoria de verdade sem produto algum continua válida.
  if (products.length === 0 && total > 0) notFound();

  const paths = storefrontPaths();

  return (
    <>
      <CategoryNav categories={categories} paths={paths} activeSlug={category.slug} />

      <Container className="flex flex-col gap-8 pt-6 pb-16 sm:gap-10 sm:pb-20">
        <Breadcrumb items={[{ label: "Início", href: paths.home }, { label: category.name }]} />

        <CabecalhoDaLista titulo={category.name} total={total}>
          {/*
            A ordenação ainda não está ligada à consulta: o controle é só visual por
            enquanto. Fica escondido com a lista vazia, onde não haveria o que ordenar.
          */}
          {total > 1 && (
            <label className="flex items-center gap-3 text-sm">
              <span className="shrink-0 text-muted-foreground">Ordenar por</span>
              <span className="relative flex-1 sm:flex-none">
                <select className={`${campo} w-full appearance-none pr-11 sm:w-auto`}>
                  <option>Relevância</option>
                  <option>Menor preço</option>
                  <option>Maior preço</option>
                  <option>Mais recentes</option>
                </select>
                <ChevronRightIcon className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 rotate-90 text-muted-foreground" />
              </span>
            </label>
          )}
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
          getHref={(target) => `${paths.category(category.slug)}?page=${target}`}
        />
      </Container>
    </>
  );
}
