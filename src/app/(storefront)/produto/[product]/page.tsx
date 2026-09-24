import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/storefront/Breadcrumb";
import { CategoryNav } from "@/components/storefront/CategoryNav";
import { Container } from "@/components/storefront/Container";
import { ProductGallery } from "@/components/storefront/ProductGallery";
import { ProductInfo } from "@/components/storefront/ProductInfo";
import { RelatedProducts } from "@/components/storefront/RelatedProducts";
import { getCurrentStoreSlug } from "@/lib/current-store-slug";
import { storefrontPaths } from "@/lib/storefront-paths";
import {
  getCategories,
  getCategory,
  getProduct,
  getRelatedProducts,
  getStore,
} from "@/modules/storefront/queries";

const RELACIONADOS = 4;

/**
 * Metadados da página de produto.
 *
 * É daqui que sai o cartão de prévia do WhatsApp. O link do produto viaja na mensagem
 * de interesse, e o aparelho de quem envia busca esta página para montar o cartão:
 * título e descrição saem destas tags. A miniatura depende de `openGraph.images` com
 * URL publicamente acessível — enquanto as fotos viverem só no bucket privado, o cartão
 * sai sem imagem, e passa a ter uma assim que existir um endereço público para elas.
 */
export async function generateMetadata({
  params,
}: PageProps<"/produto/[product]">): Promise<Metadata> {
  const storeSlug = getCurrentStoreSlug();
  const { product: productSlug } = await params;
  const [store, product] = await Promise.all([
    getStore(storeSlug),
    getProduct(storeSlug, productSlug),
  ]);
  if (!store || !product) return {};

  const title = `${product.name} — ${store.name}`;
  const description = product.shortDescription;
  const url = storefrontPaths().product(product.slug);

  return {
    // `absolute`: a vitrine agora tem um `title.template` no layout ("%s — Loja"); sem
    // isso, o sufixo entraria duas vezes (o nome do produto já termina com "— Loja").
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: store.name,
      title,
      description,
      url,
    },
  };
}

export default async function ProductPage({
  params,
}: PageProps<"/produto/[product]">) {
  const storeSlug = getCurrentStoreSlug();
  const { product: productSlug } = await params;

  const [store, product, categories] = await Promise.all([
    getStore(storeSlug),
    getProduct(storeSlug, productSlug),
    getCategories(storeSlug),
  ]);
  if (!store || !product) notFound();

  const paths = storefrontPaths();

  // Os relacionados dependem do produto já carregado, então só aqui dá para pedi-los.
  // A categoria da trilha pode não existir mais na navegação: um produto publicado
  // continua publicado mesmo com a categoria desativada, e aí a trilha a omite.
  const [category, related] = await Promise.all([
    product.categorySlugs[0]
      ? getCategory(storeSlug, product.categorySlugs[0])
      : Promise.resolve(null),
    getRelatedProducts(storeSlug, product, RELACIONADOS),
  ]);

  const temInformacoes = product.additionalInfo.length > 0 || product.tags.length > 0;

  return (
    <>
      <CategoryNav categories={categories} paths={paths} activeSlug={category?.slug} />

      <Container className="flex flex-col gap-14 pt-4 pb-8 sm:gap-20 sm:pt-6">
        <div className="flex flex-col gap-4 sm:gap-6">
          <Breadcrumb
            items={[
              { label: "Início", href: paths.home },
              ...(category ? [{ label: category.name, href: paths.category(category.slug) }] : []),
              { label: product.name },
            ]}
          />

          {/*
            Celular: uma coluna, galeria e depois a compra. Desktop: a galeria à esquerda,
            do tamanho que a foto 2:3 cabe na tela, presa no alto enquanto a coluna de
            compra rola ao lado; a coluna de compra ocupa o resto.
          */}
          <div className="grid gap-8 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start lg:gap-16">
            <div className="lg:sticky lg:top-24">
              <ProductGallery images={product.images} productName={product.name} />
            </div>
            <ProductInfo
              storeSlug={store.slug}
              name={product.name}
              shortDescription={product.shortDescription}
              price={product.price}
              promotionalPrice={product.promotionalPrice}
              available={product.available}
              badge={product.badge}
              variants={product.variants}
              whatsappNumber={store.whatsappNumber}
              whatsappMessageTemplate={store.whatsappMessageTemplate}
              highlights={store.hero?.highlights}
            />
          </div>
        </div>

        <div className="revelar grid gap-14 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-16">
          {product.description.trim() && (
            <section aria-labelledby="product-description" className="flex flex-col gap-5 sm:gap-6">
              <h2
                id="product-description"
                className="font-display text-[length:var(--texto-titulo-2)] leading-[1.15] font-normal tracking-[-0.01em] text-balance"
              >
                Descrição
              </h2>
              <div className="flex max-w-[65ch] flex-col gap-4 text-base leading-[1.55] text-pretty text-muted-foreground">
                {product.description.split("\n\n").map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          )}

          {temInformacoes && (
            <section aria-labelledby="product-info" className="flex flex-col gap-5 sm:gap-6">
              <h2
                id="product-info"
                className="font-display text-[length:var(--texto-titulo-2)] leading-[1.15] font-normal tracking-[-0.01em] text-balance"
              >
                Informações adicionais
              </h2>

              {product.additionalInfo.length > 0 && (
                // Linhas separadas só por um fio entre elas, sem caixa em volta.
                <dl className="flex flex-col divide-y divide-border text-sm">
                  {product.additionalInfo.map((row) => (
                    <div key={row.label} className="flex justify-between gap-6 py-3 first:pt-0">
                      <dt className="text-muted-foreground">{row.label}</dt>
                      <dd className="text-right font-medium text-foreground">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {product.tags.length > 0 && (
                <ul aria-label="Tags" className="flex flex-wrap gap-2">
                  {product.tags.map((tag) => (
                    <li
                      key={tag}
                      className="rounded-full border border-border px-3 py-1.5 text-xs tracking-[0.01em] text-muted-foreground"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        <RelatedProducts products={related} />
      </Container>
    </>
  );
}
