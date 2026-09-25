import Link from "next/link";
import type { StorefrontPaths } from "@/lib/storefront-paths";
import type { CategoryPreview } from "@/modules/storefront/queries";
import type { Store } from "@/types/catalog";
import { Container } from "./Container";
import { MenuCategorias } from "./MenuCategorias";
import { SearchIcon } from "./icons";
import { LinkDaLista } from "./WishlistCount";

// Ação do cabeçalho: alvo de 44px, pílula, afunda ao toque. O texto fica em
// `foreground` sobre a camada translúcida para manter o contraste com qualquer
// conteúdo que role por baixo.
const ACAO =
  "pressionavel focus-ring relative inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-full px-3 text-sm font-medium text-foreground hover:bg-foreground/5";

/**
 * Cabeçalho da vitrine: logo, busca e lista de interesse.
 *
 * Fica preso ao topo como uma camada translúcida sobre o conteúdo. O desfoque é fixo
 * (nunca animado), então o custo no celular é só o de composição da faixa. Sem
 * suporte a `backdrop-filter`, ou com transparência reduzida pedida pelo sistema, o
 * fundo fica sólido.
 *
 * O cabeçalho é de servidor; só o link da lista, que mostra quantos itens ela tem,
 * roda no navegador (`LinkDaLista`).
 */
export function StoreHeader({
  store,
  paths,
  categories = [],
  totalDeProdutos = 0,
}: {
  store: Pick<Store, "name" | "slug">;
  paths: StorefrontPaths;
  categories?: CategoryPreview[];
  totalDeProdutos?: number;
}) {
  // Aba de categorias do celular: cada categoria com a contagem real de produtos.
  const itensDoMenu = categories.map((category) => ({
    href: paths.category(category.slug),
    label: category.name,
    count: category.count,
  }));
  return (
    // Barra presa ao topo, de ponta a ponta: faz parte da borda de cima da tela, com só os
    // cantos de baixo arredondados. Translúcida, então o conteúdo aparece por trás ao rolar.
    <header className="sticky top-0 z-40 rounded-b-2xl border-b border-border bg-chrome/90 supports-[backdrop-filter]:bg-chrome/75 supports-[backdrop-filter]:backdrop-blur-md sm:rounded-b-3xl [@media(prefers-reduced-transparency:reduce)]:bg-chrome [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none">
      <Container className="grid h-[5.5rem] grid-cols-[1fr_auto_1fr] items-center gap-3 sm:h-[5.5rem] lg:h-[4.5rem]">
        {/* Link, não campo: no celular um campo no cabeçalho espreme o logo. A página
            de busca tem o formulário e funciona sem JavaScript. */}
        <div className="-ml-3 flex items-center">
          <MenuCategorias
            itens={itensDoMenu}
            todos={{ href: paths.allProducts, count: totalDeProdutos }}
            logo={{ src: "/marca/logo-novo-desktop.svg", alt: store.name }}
            classeDoBotao={ACAO}
          />
          <nav aria-label="Busca" className="flex items-center">
            <Link href={paths.search} className={ACAO}>
              <SearchIcon />
              <span className="sr-only sm:not-sr-only">Buscar</span>
            </Link>
          </nav>
        </div>

        {/* O logo substitui o nome em texto; o nome continua como nome acessível do link. */}
        <Link
          href={paths.home}
          className="pressionavel focus-ring inline-flex shrink-0 items-center justify-center rounded-md px-1"
        >
          {/* No desktop entra a mesma arte sem a sobra de tela em volta: o desenho fica maior
              numa barra mais baixa. Celular e tablet seguem com o arquivo de sempre. */}
          <picture>
            <source media="(min-width: 1024px)" srcSet="/marca/logo-novo-desktop.svg" width={543} height={194} />
            <img
              src="/marca/logo-novo.svg"
              alt={store.name}
              width={1160}
              height={831}
              // 50px de altura no celular e 58px no desktop: a barra é baixa, mas o traço do
              // logo é fino e a assinatura "Por Karol Basilio" precisa de tamanho.
              className="h-[4rem] w-auto sm:h-[5rem] lg:h-[3.25rem]"
            />
          </picture>
        </Link>

        <nav aria-label="Carrinho" className="-mr-3 flex items-center justify-end">
          <LinkDaLista href={paths.cart} storeSlug={store.slug} className={ACAO} />
        </nav>
      </Container>
    </header>
  );
}