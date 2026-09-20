import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/storefront/Breadcrumb";
import { CategoryNav } from "@/components/storefront/CategoryNav";
import { Container } from "@/components/storefront/Container";
import { ProductGallery } from "@/components/storefront/ProductGallery";
import { ProductInfo } from "@/components/storefront/ProductInfo";
import { RelatedProducts } from "@/components/storefront/RelatedProducts";
import { storefrontPaths } from "@/lib/storefront-paths";
import {
  getCategories,
  getCategory,
  getProduct,
  getRelatedProducts,
  getStore,
} from "@/modules/catalog/mock";
import { toProductCard } from "@/modules/catalog/product-card";

export default async function ProductPage({
  params,
}: PageProps<"/loja/[store]/produto/[product]">) {
  const { store: storeSlug, product: productSlug } = await params;
  const store = getStore(storeSlug);
  const product = getProduct(productSlug);
  if (!store || !product) notFound();

  const paths = storefrontPaths(store.slug);
  const category = getCategory(product.categorySlugs[0]);
  const related = getRelatedProducts(product, 4).map((item) => toProductCard(item, paths));

  return (
    <>
      <CategoryNav categories={getCategories()} paths={paths} activeSlug={category?.slug} />

      <Container className="flex flex-col gap-12 py-8">
        <div className="flex flex-col gap-6">
          <Breadcrumb
            items={[
              { label: "Início", href: paths.home },
              ...(category ? [{ label: category.name, href: paths.category(category.slug) }] : []),
              { label: product.name },
            ]}
          />

          <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
            <ProductGallery images={product.images} />
            <ProductInfo
              name={product.name}
              shortDescription={product.shortDescription}
              price={product.price}
              promotionalPrice={product.promotionalPrice}
              available={product.available}
              badge={product.badge}
              variants={product.variants}
            />
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-[3fr_2fr]">
          <section aria-labelledby="product-description" className="flex flex-col gap-3">
            <h2 id="product-description" className="text-xl font-semibold">
              Descrição
            </h2>
            <div className="flex flex-col gap-3 text-muted-foreground">
              {product.description.split("\n\n").map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>

          <section aria-labelledby="product-info" className="flex flex-col gap-3">
            <h2 id="product-info" className="text-xl font-semibold">
              Informações adicionais
            </h2>
            <dl className="divide-y divide-border rounded-md border border-border text-sm">
              {product.additionalInfo.map((row) => (
                <div key={row.label} className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="text-right font-medium">{row.value}</dd>
                </div>
              ))}
            </dl>

            {product.tags.length > 0 && (
              <ul aria-label="Tags" className="mt-2 flex flex-wrap gap-2">
                {product.tags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <RelatedProducts products={related} />
      </Container>
    </>
  );
}
