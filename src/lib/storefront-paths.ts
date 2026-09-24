/**
 * Caminhos da vitrine. Cada deploy é uma loja no próprio domínio, então tudo parte da
 * raiz: não há slug de loja na URL. Sem dependência de servidor, serve também a Client
 * Components (erro, 404).
 */
export function storefrontPaths() {
  return {
    home: "/",
    category: (categorySlug: string) => `/categoria/${categorySlug}`,
    product: (productSlug: string) => `/produto/${productSlug}`,
    cart: "/carrinho",
    allProducts: "/produtos",
    search: "/busca",
    collection: (collectionSlug: string) => `/colecao/${collectionSlug}`,
    /** Páginas institucionais (políticas, contato, quem somos). Texto fixo no código. */
    institutional: (pageSlug: string) => `/institucional/${pageSlug}`,
  };
}

export type StorefrontPaths = ReturnType<typeof storefrontPaths>;
