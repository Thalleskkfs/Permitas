import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/storefront/Breadcrumb";
import { Cart } from "@/components/storefront/Cart";
import { Container } from "@/components/storefront/Container";
import { storefrontPaths } from "@/lib/storefront-paths";
import { getCartItems, getStore } from "@/modules/catalog/mock";

export default async function CartPage({ params }: PageProps<"/loja/[store]/carrinho">) {
  const { store: storeSlug } = await params;
  const store = getStore(storeSlug);
  if (!store) notFound();

  const paths = storefrontPaths(store.slug);

  return (
    <Container className="flex flex-col gap-8 py-8">
      <div className="flex flex-col gap-4">
        <Breadcrumb items={[{ label: "Início", href: paths.home }, { label: "Carrinho" }]} />
        <h1 className="text-2xl font-semibold sm:text-3xl">Carrinho</h1>
      </div>

      <Cart initialItems={getCartItems()} continueShoppingHref={paths.home} />
    </Container>
  );
}
