import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AgeGate } from "@/components/storefront/AgeGate";
import { StoreFooter } from "@/components/storefront/StoreFooter";
import { StoreHeader } from "@/components/storefront/StoreHeader";
import { WhatsAppBubble } from "@/components/storefront/WhatsAppBubble";
import { getCurrentStoreSlug } from "@/lib/current-store-slug";
import { storefrontPaths } from "@/lib/storefront-paths";
import { AGE_GATE_COOKIE, shouldShowAgeGate } from "@/modules/storefront/age-gate";
import { getCategoryPreviews, getStore } from "@/modules/storefront/queries";

// Título padrão de toda a vitrine: sem isso, qualquer página sem `generateMetadata`
// própria (carrinho, categoria, coleção, busca, a própria home) mostrava o nome
// genérico do projeto ("catalogo-saas") na aba do navegador. Página com título
// próprio (produto, institucional) usa `%s` e cai no mesmo sufixo por consistência.
export async function generateMetadata(): Promise<Metadata> {
  const store = await getStore(getCurrentStoreSlug());
  if (!store) return {};

  return {
    title: { default: store.name, template: `%s — ${store.name}` },
    description: store.description ?? "Plataforma de catálogo de produtos.",
  };
}

export default async function StorefrontLayout({
  children,
}: LayoutProps<"/">) {
  const storeSlug = getCurrentStoreSlug();
  const [store, resumo] = await Promise.all([getStore(storeSlug), getCategoryPreviews(storeSlug)]);
  if (!store) notFound();

  const paths = storefrontPaths();
  // Decidido no servidor: o portão vem (ou não) já no HTML, sem piscar.
  const showAgeGate = shouldShowAgeGate((await cookies()).get(AGE_GATE_COOKIE)?.value);

  return (
    <div data-storefront className="flex flex-1 flex-col bg-background text-foreground">
      <AgeGate open={showAgeGate} termsHref={paths.institutional("termos")}>
        <StoreHeader store={store} paths={paths} categories={resumo.categories} totalDeProdutos={resumo.total} />
        <main className="flex-1">{children}</main>
        <StoreFooter store={store} paths={paths} />
        {/* Dentro do portão: enquanto ele estiver aberto, a bolha fica inerte como o resto. */}
        <WhatsAppBubble href={store.hero?.contactHref} />
      </AgeGate>
    </div>
  );
}
