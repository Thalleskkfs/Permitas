import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/storefront/Breadcrumb";
import { CategoryNav } from "@/components/storefront/CategoryNav";
import { Container } from "@/components/storefront/Container";
import { Pagination } from "@/components/storefront/Pagination";
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
  getCollection,
  getCollectionProducts,
  getStore,
} from "@/modules/storefront/queries";

const PAGE_SIZE = 8;

export async function generateMetadata({
  params,
}: PageProps<"/colecao/[slug]">): Promise<Metadata> {
  const { slug: collectionSlug } = await params;
  const collection = await getCollection(getCurrentStoreSlug(), collectionSlug);
  if (!collection) return {};

  return { title: collection.name, description: collection.description };
}

export default async function CollectionPage({
  params,
  searchParams,
}: PageProps<"/colecao/[slug]">) {
  const storeSlug = getCurrentStoreSlug();
  const { slug: collectionSlug } = await params;

  const [store, collection, categories] = await Promise.all([
    getStore(storeSlug),
    getCollection(storeSlug, collectionSlug),
    getCategories(storeSlug),
  ]);
  // Coleção inativa, de outra loja ou inexistente: para o visitante, ela não existe.
  if (!store || !collection) notFound();

  const { page } = await searchParams;
  const pedida = Number(Array.isArray(page) ? page[0] : page);
  const paginaAtual = Number.isInteger(pedida) && pedida > 0 ? pedida : 1;

  const { products, total } = await getCollectionProducts(storeSlug, collectionSlug, {
    offset: (paginaAtual - 1) * PAGE_SIZE,
    limit: PAGE_SIZE,
  });

  const totalDePaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (products.length === 0 && total > 0) notFound();

  const paths = storefrontPaths();

  return (
    <>
      <CategoryNav categories={categories} paths={paths} />

      <Container className="flex flex-col gap-8 pt-6 pb-16 sm:gap-10 sm:pb-20">
        <Breadcrumb items={[{ label: "Início", href: paths.home }, { label: collection.name }]} />

        <CabecalhoDaLista
          titulo={collection.name}
          descricao={collection.description}
          total={total}
        />

        {total === 0 ? (
          <EstadoVazio
            titulo="Esta seleção está sendo renovada."
            texto="Os produtos voltam a aparecer aqui em breve. Enquanto isso, veja o restante da loja."
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
          getHref={(target) => `${paths.collection(collection.slug)}?page=${target}`}
        />
      </Container>
    </>
  );
}
