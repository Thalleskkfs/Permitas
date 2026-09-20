import type { CartItem, Category, Product, Store } from "@/types/catalog";

const store: Store = {
  slug: "demo",
  name: "Loja Demo",
  description:
    "Template visual neutro de loja. Todo o conteúdo desta página é de demonstração.",
  hero: {
    title: "Título de destaque da loja",
    subtitle:
      "Área opcional para uma mensagem principal, campanha ou coleção em evidência.",
    actionLabel: "Ver produtos",
    actionHref: "/loja/demo/categoria/exemplo",
  },
};

const categories: Category[] = [
  { slug: "exemplo", name: "Categoria exemplo" },
  { slug: "acessorios", name: "Acessórios" },
  { slug: "casa", name: "Casa" },
  { slug: "calcados", name: "Calçados" },
];

const extraCategoryByRemainder = ["acessorios", "casa", "calcados"];

const products: Product[] = Array.from({ length: 24 }, (_, index) => {
  const number = index + 1;
  const label = String(number).padStart(2, "0");
  const price = 4990 + (number % 6) * 1500;
  const promotional = number % 3 === 1;
  const name = `Produto exemplo ${label}`;

  return {
    slug: number === 1 ? "produto-exemplo" : `produto-exemplo-${number}`,
    name,
    shortDescription:
      "Descrição curta do produto, com uma ou duas linhas sobre o principal diferencial.",
    description:
      "Descrição completa do produto. Aqui entram detalhes de material, modelagem, uso e cuidados.\n\nUm segundo parágrafo pode explicar diferenciais, medidas e recomendações. Este texto é apenas ilustrativo.",
    price,
    promotionalPrice: promotional ? Math.round(price * 0.8) : undefined,
    available: number % 8 !== 0,
    badge: promotional ? "Promoção" : number % 5 === 0 ? "Novo" : undefined,
    images: Array.from({ length: 4 }, (_, imageIndex) => ({
      alt: `${name} — imagem ${imageIndex + 1}`,
    })),
    variants: [
      {
        name: "Tamanho",
        options: [
          { value: "P", available: true },
          { value: "M", available: true },
          { value: "G", available: true },
          { value: "GG", available: false },
        ],
      },
      {
        name: "Cor",
        options: [
          { value: "Preto", available: true },
          { value: "Branco", available: true },
          { value: "Cinza", available: number % 2 === 0 },
        ],
      },
    ],
    tags: ["exemplo", "básico", "neutro"],
    additionalInfo: [
      { label: "Código", value: `EX-${String(number).padStart(3, "0")}` },
      { label: "Material", value: "Material de exemplo" },
      { label: "Peso", value: "0,4 kg" },
    ],
    categorySlugs: ["exemplo", extraCategoryByRemainder[number % 3]],
    featured: number <= 8,
  };
});

const cartItems: CartItem[] = [
  {
    id: "produto-exemplo-M-Preto",
    name: "Produto exemplo 01",
    href: "/loja/demo/produto/produto-exemplo",
    unitPrice: 5192,
    quantity: 2,
    variantLabel: "Tamanho M · Cor Preto",
  },
  {
    id: "produto-exemplo-2-G-Branco",
    name: "Produto exemplo 02",
    href: "/loja/demo/produto/produto-exemplo-2",
    unitPrice: 7990,
    quantity: 1,
    variantLabel: "Tamanho G · Cor Branco",
  },
];

export function getStore(slug: string) {
  return slug === store.slug ? store : undefined;
}

export function getCategories() {
  return categories;
}

export function getCategory(slug: string) {
  return categories.find((category) => category.slug === slug);
}

export function getProductsByCategory(categorySlug: string) {
  return products.filter((product) => product.categorySlugs.includes(categorySlug));
}

export function getProduct(slug: string) {
  return products.find((product) => product.slug === slug);
}

export function getFeaturedProducts(limit: number) {
  return products.filter((product) => product.featured).slice(0, limit);
}

export function getPromotionalProducts(limit: number) {
  return products.filter((product) => product.promotionalPrice !== undefined).slice(0, limit);
}

export function getRelatedProducts(product: Product, limit: number) {
  return products
    .filter(
      (candidate) =>
        candidate.slug !== product.slug &&
        candidate.categorySlugs.some((slug) => product.categorySlugs.includes(slug)),
    )
    .slice(0, limit);
}

export function getCartItems() {
  return cartItems;
}
