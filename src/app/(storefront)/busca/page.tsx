import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/storefront/Breadcrumb";
import { CategoryNav } from "@/components/storefront/CategoryNav";
import { Container } from "@/components/storefront/Container";
import { Pagination } from "@/components/storefront/Pagination";
import { ChatIcon } from "@/components/storefront/icons";
import {
  botaoVinho,
  botaoWhatsApp,
  campo,
  EstadoVazio,
  ProductGrid,
  tituloDePagina,
} from "@/components/storefront/ProductGrid";
import { getCurrentStoreSlug } from "@/lib/current-store-slug";
import { storefrontPaths } from "@/lib/storefront-paths";
import {
  getCategories,
  getStore,
  normalizeSearchTerm,
  SEARCH_TERM_MAX_LENGTH,
  searchProducts,
} from "@/modules/storefront/queries";
import { normalizeWhatsAppNumber } from "@/modules/storefront/whatsapp";

const PAGE_SIZE = 8;

/**
 * Link para perguntar pelo WhatsApp por algo que a busca não achou: a loja pode ter o
 * item e não ter cadastrado. A mensagem já leva o termo, para a conversa começar certa.
 */
function linkParaPerguntar(numero: string | null | undefined, termo: string) {
  const telefone = numero ? normalizeWhatsAppNumber(numero) : null;
  if (!telefone) return null;
  const texto = `Olá! Procurei por "${termo}" na loja e não encontrei. Vocês têm?`;
  return `https://wa.me/${telefone}?text=${encodeURIComponent(texto)}`;
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export async function generateMetadata({
  searchParams,
}: PageProps<"/busca">): Promise<Metadata> {
  const { q } = await searchParams;
  const termo = normalizeSearchTerm(first(q));
  return { title: termo ? `Busca: "${termo}"` : "Busca" };
}

export default async function SearchPage({ searchParams }: PageProps<"/busca">) {
  const storeSlug = getCurrentStoreSlug();

  const [store, categories] = await Promise.all([getStore(storeSlug), getCategories(storeSlug)]);
  if (!store) notFound();

  const { q, page } = await searchParams;
  // O termo exibido é o mesmo que a consulta usa: aparado e limitado.
  const termo = normalizeSearchTerm(first(q));

  const pedida = Number(first(page));
  const paginaAtual = Number.isInteger(pedida) && pedida > 0 ? pedida : 1;

  // Sem termo, nada é consultado: a página mostra só o campo.
  const { products, total } = await searchProducts(storeSlug, termo, {
    offset: (paginaAtual - 1) * PAGE_SIZE,
    limit: PAGE_SIZE,
  });

  const totalDePaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (products.length === 0 && total > 0) notFound();

  const paths = storefrontPaths();

  const perguntar = termo && total === 0 ? linkParaPerguntar(store.whatsappNumber, termo) : null;

  const hrefDaPagina = (target: number) =>
    `${paths.search}?${new URLSearchParams({ q: termo, page: String(target) })}`;

  return (
    <>
      <CategoryNav categories={categories} paths={paths} />

      <Container className="flex flex-col gap-8 pt-6 pb-16 sm:gap-10 sm:pb-20">
        <Breadcrumb items={[{ label: "Início", href: paths.home }, { label: "Busca" }]} />

        <div className="entrada flex flex-col gap-6">
          <h1 className={tituloDePagina}>Buscar produtos</h1>

          {/* GET puro: funciona sem JavaScript e o resultado fica no endereço, pronto para
              voltar, recarregar ou compartilhar. */}
          <form
            action={paths.search}
            method="get"
            role="search"
            className="flex max-w-xl flex-col gap-2"
          >
            <label htmlFor="busca-termo" className="text-sm font-medium">
              Nome do produto
            </label>
            <div className="flex gap-2">
              <input
                id="busca-termo"
                name="q"
                type="search"
                defaultValue={termo}
                maxLength={SEARCH_TERM_MAX_LENGTH}
                placeholder="Buscar pelo nome"
                autoComplete="off"
                enterKeyHint="search"
                className={`${campo} flex-1`}
              />
              <button type="submit" className={`${botaoVinho} shrink-0 px-6`}>
                Buscar
              </button>
            </div>
          </form>

          {termo && total > 0 && (
            <p className="text-sm text-muted-foreground tabular-nums">
              {total} {total === 1 ? "resultado" : "resultados"} para{" "}
              <span className="font-medium text-foreground">“{termo}”</span>
            </p>
          )}
        </div>

        {!termo ? (
          <p className="text-base text-muted-foreground">
            Digite o nome de um produto ou{" "}
            <Link
              href={paths.allProducts}
              className="focus-ring -mx-1 inline-flex min-h-11 items-center rounded-sm px-1 text-foreground underline decoration-control-border underline-offset-4 transition-[text-decoration-color] duration-(--duracao-estado) ease-(--ease-saida) hover:decoration-accent"
            >
              veja todos os produtos
            </Link>
            .
          </p>
        ) : total === 0 ? (
          <EstadoVazio
            titulo={`Nada encontrado para “${termo}”.`}
            texto={
              perguntar
                ? "Confira a grafia ou tente uma palavra mais curta. Se preferir, pergunte direto: nem tudo o que temos está no site."
                : "Confira a grafia ou tente uma palavra mais curta."
            }
          >
            {perguntar ? (
              <a href={perguntar} target="_blank" rel="noopener noreferrer" className={botaoWhatsApp}>
                <ChatIcon />
                Perguntar no WhatsApp
              </a>
            ) : (
              <Link href={paths.allProducts} className={botaoVinho}>
                Ver todos os produtos
              </Link>
            )}
          </EstadoVazio>
        ) : (
          <>
            <div className="entrada [--ordem:1]">
              <ProductGrid products={products} />
            </div>
            <Pagination currentPage={paginaAtual} totalPages={totalDePaginas} getHref={hrefDaPagina} />
          </>
        )}
      </Container>
    </>
  );
}
