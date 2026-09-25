import Link from "next/link";
import { notFound } from "next/navigation";
import { AboutSection } from "@/components/storefront/AboutSection";
import { CategoryIndex } from "@/components/storefront/CategoryIndex";
import { CategoryShelf } from "@/components/storefront/CategoryShelf";
import type { CategoryShowcaseItem } from "@/components/storefront/CategoryShowcase";
import { Container } from "@/components/storefront/Container";
import { Hero } from "@/components/storefront/Hero";
import { HeroSpotlight } from "@/components/storefront/HeroSpotlight";
import { ChatIcon } from "@/components/storefront/icons";
import {
  botaoVazado,
  botaoVinho,
  botaoWhatsApp,
  EstadoVazio,
  tituloDeVitrine,
} from "@/components/storefront/ProductGrid";
import { ProductSection } from "@/components/storefront/ProductSection";
import { getCurrentStoreSlug } from "@/lib/current-store-slug";
import { storefrontPaths } from "@/lib/storefront-paths";
import {
  getAllProducts,
  getCategories,
  getCategoryProducts,
  getFeaturedProducts,
  getPromotionalProducts,
  getStore,
} from "@/modules/storefront/queries";

const VITRINE = 4;

/** Produtos lidos por categoria: o bastante para a capa e para a fileira do desktop. */
const POR_CATEGORIA = 8;

/** Produtos ao lado do bloco vinho da categoria, no desktop. */
const NA_FILEIRA = 3;

/** Produtos mais recentes lidos para escolher os dois cartões ao lado do banner. */
const RECENTES = 12;

export default async function StoreHomePage() {
  const storeSlug = getCurrentStoreSlug();
  const store = await getStore(storeSlug);
  if (!store) notFound();

  // As leituras são independentes: em série somariam idas ao banco antes de a página
  // começar a renderizar.
  const [categories, featured, promotional, todos] = await Promise.all([
    getCategories(storeSlug),
    getFeaturedProducts(storeSlug, VITRINE),
    getPromotionalProducts(storeSlug, VITRINE),
    getAllProducts(storeSlug, { offset: 0, limit: RECENTES }),
  ]);

  // Uma leitura por categoria: a contagem real, a foto de capa do índice do desktop e a
  // fileira extra de produtos. Nada aqui é inventado; categoria vazia fica sem foto.
  const porCategoria = await Promise.all(
    categories.map((category) =>
      getCategoryProducts(storeSlug, category.slug, { offset: 0, limit: POR_CATEGORIA }),
    ),
  );

  const paths = storefrontPaths();

  // Fileira da categoria no desktop: a maior categoria que ainda tenha três produtos fora
  // dos destaques E da promoção — as duas seções já fixas da página, exibidas antes e
  // depois dela.
  const reservados = new Set([...featured, ...promotional].map((product) => product.href));
  const prateleira = categories
    .map((category, indice) => ({
      category,
      total: porCategoria[indice].total,
      produtos: porCategoria[indice].products
        .filter((product) => !reservados.has(product.href))
        .slice(0, NA_FILEIRA),
    }))
    .filter((grupo) => grupo.produtos.length === NA_FILEIRA)
    .sort((a, b) => b.total - a.total)[0];

  // Cartões ao lado do banner (desktop): os dois produtos mais recentes, disponíveis e com
  // foto, que não aparecem em nenhuma outra parte da página. Com menos de dois, o banner
  // volta a ocupar a largura toda.
  const naPagina = new Set([...reservados, ...(prateleira?.produtos.map((product) => product.href) ?? [])]);
  const naHero = todos.products
    .filter((product) => product.available && product.image?.src && !naPagina.has(product.href))
    .slice(0, 2);
  const lateral = naHero.length === 2 ? <HeroSpotlight products={naHero} /> : undefined;

  // Índice do desktop: todas as categorias ativas, inclusive as que ainda vão receber
  // produtos (sem foto, o painel mostra a marca). A foto evita repetir um produto que já
  // aparece na página.
  const naTela = new Set([...naPagina, ...(lateral ? naHero.map((product) => product.href) : [])]);
  const showcase: CategoryShowcaseItem[] = [
    ...categories.flatMap((category, indice) => {
      const pagina = porCategoria[indice];
      const comFoto = pagina.products.filter((product) => product.image?.src);
      const capa = (comFoto.find((product) => !naTela.has(product.href)) ?? comFoto[0])?.image;
      return [
        {
          href: paths.category(category.slug),
          name: category.name,
          count: pagina.total,
          cover: capa?.src ? { src: capa.src, alt: capa.alt } : undefined,
        },
      ];
    }),
    { href: paths.allProducts, name: "Todos os produtos", count: todos.total },
  ];

  const contato = store.hero?.contactHref;

  return (
    <>
      {/*
        O título da página é o nome da loja; cada banner do carrossel é um h2 dentro
        dele. Fica só para leitor de tela porque a identidade visível é o cabeçalho.
      */}
      <h1 className="sr-only">{store.name}</h1>
      {store.about && <AboutSection about={store.about} />}
      {store.hero && <Hero {...store.hero} lateral={lateral} />}
      <div className="hidden pt-6 sm:block sm:pt-8 lg:pt-20">
        <CategoryIndex categories={categories} paths={paths} showcase={showcase} />
      </div>

      {/* Celular e tablet. Entre seções: 56px no celular, 80px no tablet. Cada faixa se revela ao rolar. */}
      <Container className="flex flex-col gap-14 pt-10 pb-16 sm:gap-20 sm:pt-14 sm:pb-20 lg:hidden">
        <ProductSection
          title="Produtos em destaque"
          products={featured}
          // "Ver todos" de uma vitrine geral leva à lista completa, não a uma categoria.
          viewAllHref={paths.allProducts}
        />
        <ProductSection title="Em promoção" products={promotional} />
        {featured.length === 0 && promotional.length === 0 && (
          <EstadoVazio
            titulo="A vitrine está sendo montada."
            texto="Os destaques aparecem aqui assim que forem publicados."
          >
            <Link href={paths.allProducts} className={botaoVinho}>
              Ver todos os produtos
            </Link>
          </EstadoVazio>
        )}
      </Container>

      {/*
        Desktop: as seções alternam superfícies chapadas da paleta (nada de degradê) para
        a página não ser uma pilha de blocos iguais sobre o mesmo fundo. Destaques numa
        faixa de ponta a ponta; a categoria num bloco vinho ao lado dos produtos dela.
      */}
      <div className="hidden lg:block">
        {featured.length > 0 && (
          <div className="mt-24 bg-chrome py-20">
            <Container>
              <ProductSection
                title="Produtos em destaque"
                products={featured}
                viewAllHref={paths.allProducts}
                vitrine
              />
            </Container>
          </div>
        )}

        {prateleira && (
          <Container className="pt-24">
            <CategoryShelf
              name={prateleira.category.name}
              href={paths.category(prateleira.category.slug)}
              count={prateleira.total}
              products={prateleira.produtos}
            />
          </Container>
        )}

        {promotional.length > 0 && (
          <Container className="pt-24">
            <ProductSection title="Em promoção" products={promotional} vitrine />
          </Container>
        )}

        {featured.length === 0 && promotional.length === 0 && (
          <Container className="pt-24">
            <EstadoVazio
              titulo="A vitrine está sendo montada."
              texto="Os destaques aparecem aqui assim que forem publicados."
            >
              <Link href={paths.allProducts} className={botaoVinho}>
                Ver todos os produtos
              </Link>
            </EstadoVazio>
          </Container>
        )}

        {!contato && <div className="pb-20" />}
      </div>

      {/*
        Fecho do desktop: em vez de fundo vazio antes do rodapé, o canal de atendimento
        da loja. Superfície chapada da paleta, colada no rodapé (o -mb anula a margem
        de cima dele só nesta página).
      */}
      {contato && (
        <section
          aria-labelledby="fecho-atendimento"
          className="bg-chrome revelar hidden lg:mt-24 lg:-mb-20 lg:block"
        >
          <Container className="flex items-center justify-between gap-12 py-16">
            <h2 id="fecho-atendimento" className={tituloDeVitrine}>
              Atendimento via WhatsApp
            </h2>
            <div className="flex shrink-0 gap-3">
              <a href={contato} target="_blank" rel="noopener noreferrer" className={botaoWhatsApp}>
                <ChatIcon className="size-5" />
                {store.hero?.contactLabel ?? "Falar no WhatsApp"}
              </a>
              <Link href={paths.allProducts} className={botaoVazado}>
                Ver todos os produtos
              </Link>
            </div>
          </Container>
        </section>
      )}
    </>
  );
}
