import { notFound } from "next/navigation";
import { StoreFooter } from "@/components/storefront/StoreFooter";
import { StoreHeader } from "@/components/storefront/StoreHeader";
import { storefrontPaths } from "@/lib/storefront-paths";
import { getStore } from "@/modules/catalog/mock";

export default async function StorefrontLayout({
  children,
  params,
}: LayoutProps<"/loja/[store]">) {
  const { store: storeSlug } = await params;
  const store = getStore(storeSlug);
  if (!store) notFound();

  const paths = storefrontPaths(store.slug);

  return (
    <div data-storefront className="flex flex-1 flex-col bg-background text-foreground">
      <StoreHeader store={store} paths={paths} />
      <main className="flex-1">{children}</main>
      <StoreFooter store={store} paths={paths} />
    </div>
  );
}
