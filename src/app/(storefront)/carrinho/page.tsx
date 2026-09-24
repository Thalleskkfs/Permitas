import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/storefront/Breadcrumb";
import { Cart } from "@/components/storefront/Cart";
import { Container } from "@/components/storefront/Container";
import { getCurrentStoreSlug } from "@/lib/current-store-slug";
import { storefrontPaths } from "@/lib/storefront-paths";
import { getStore } from "@/modules/storefront/queries";

export const metadata: Metadata = { title: "Carrinho" };

export default async function CartPage() {
  const storeSlug = getCurrentStoreSlug();
  const store = await getStore(storeSlug);
  if (!store) notFound();

  const paths = storefrontPaths();

  return (
    <Container className="flex flex-col gap-8 pt-4 pb-8 sm:gap-10 sm:pt-6">
      <div className="flex flex-col gap-4 sm:gap-6">
        <Breadcrumb items={[{ label: "Início", href: paths.home }, { label: "Carrinho" }]} />
                {/* Título da página: o único bloco que entra com movimento aqui. */}
                <h1 className="entrada font-display text-[length:var(--texto-titulo-1)] leading-[1.08] font-light tracking-[-0.02em] text-balance">
                  Carrinho
                </h1>
      </div>

      {/*
        A lista vive no navegador (sem conta de cliente), então o servidor não a conhece:
        quem a lê é o componente, já no cliente. O que ele guarda são só identificadores —
        nome, preço e disponibilidade chegam atualizados pela Server Action
        `resolveWishlist`, direto do catálogo publicado.
      */}
      <Cart
        storeSlug={store.slug}
        continueShoppingHref={paths.home}
        whatsappNumber={store.whatsappNumber}
        whatsappMessageTemplate={store.whatsappMessageTemplate}
      />
    </Container>
  );
}
