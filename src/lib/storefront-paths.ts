export function storefrontPaths(storeSlug: string) {
  const base = `/loja/${storeSlug}`;

  return {
    home: base,
    category: (categorySlug: string) => `${base}/categoria/${categorySlug}`,
    product: (productSlug: string) => `${base}/produto/${productSlug}`,
    cart: `${base}/carrinho`,
  };
}

export type StorefrontPaths = ReturnType<typeof storefrontPaths>;
