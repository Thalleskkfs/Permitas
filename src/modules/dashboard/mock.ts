import type {
  AdminCategory,
  AdminCategoryNode,
  AdminCollection,
  AdminCustomer,
  AdminProduct,
  AdminRequest,
  AdminStockRow,
  AdminStore,
  AdminTag,
  AdminUser,
  DashboardStats,
  ProductStatus,
} from "@/types/dashboard";

/**
 * Dados de demonstração do painel. Nada aqui toca no Supabase.
 *
 * Substituir estas funções por consultas reais não deve exigir mudança nos componentes:
 * a interface consome os tipos de @/types/dashboard, não este arquivo.
 */

const store: AdminStore = { id: "store-demo", name: "Loja Demo", slug: "demo" };

const stores: AdminStore[] = [
  store,
  { id: "store-segunda", name: "Segunda Loja", slug: "segunda" },
];

const user: AdminUser = {
  name: "Usuário Demo",
  email: "demo@exemplo.com",
  roleLabel: "Proprietário",
};

const categories: AdminCategory[] = [
  { id: "cat-roupas", name: "Roupas", slug: "roupas", parentId: null, active: true, sortOrder: 0, productCount: 12 },
  { id: "cat-camisetas", name: "Camisetas", slug: "camisetas", parentId: "cat-roupas", active: true, sortOrder: 0, productCount: 7 },
  { id: "cat-regatas", name: "Regatas", slug: "regatas", parentId: "cat-roupas", active: false, sortOrder: 1, productCount: 5 },
  { id: "cat-acessorios", name: "Acessórios", slug: "acessorios", parentId: null, active: true, sortOrder: 1, productCount: 6 },
  { id: "cat-bolsas", name: "Bolsas", slug: "bolsas", parentId: "cat-acessorios", active: true, sortOrder: 0, productCount: 4 },
  { id: "cat-casa", name: "Casa", slug: "casa", parentId: null, active: true, sortOrder: 2, productCount: 6 },
];

const tags: AdminTag[] = [
  { id: "tag-novo", name: "Novo", slug: "novo", usageCount: 8 },
  { id: "tag-promocao", name: "Promoção", slug: "promocao", usageCount: 6 },
  { id: "tag-basico", name: "Básico", slug: "basico", usageCount: 11 },
  { id: "tag-verao", name: "Verão", slug: "verao", usageCount: 4 },
  { id: "tag-inverno", name: "Inverno", slug: "inverno", usageCount: 3 },
  { id: "tag-exclusivo", name: "Exclusivo", slug: "exclusivo", usageCount: 0 },
];

const collections: AdminCollection[] = [
  { id: "col-destaques", name: "Destaques", slug: "destaques", active: true, position: 0, productCount: 8 },
  { id: "col-promocoes", name: "Promoções", slug: "promocoes", active: true, position: 1, productCount: 6 },
  { id: "col-lancamentos", name: "Lançamentos", slug: "lancamentos", active: true, position: 2, productCount: 4 },
  { id: "col-inverno", name: "Coleção Inverno", slug: "colecao-inverno", active: false, position: 3, productCount: 0 },
];

const STATUS_CYCLE: ProductStatus[] = ["published", "published", "draft", "published", "archived", "published"];
const CATEGORY_CYCLE = ["cat-camisetas", "cat-regatas", "cat-bolsas", "cat-casa", "cat-acessorios", "cat-roupas"];

const products: AdminProduct[] = Array.from({ length: 24 }, (_, index) => {
  const number = index + 1;
  const label = String(number).padStart(2, "0");
  const priceCents = 4990 + (number % 6) * 1500;
  const onSale = number % 3 === 1;
  const stock = number % 7 === 0 ? 0 : number % 5 === 0 ? 3 : 10 + (number % 9) * 4;

  return {
    id: `prod-${label}`,
    name: `Produto exemplo ${label}`,
    slug: `produto-exemplo-${label}`,
    sku: number % 8 === 0 ? null : `EX-${label}`,
    shortDescription: "Descrição curta usada na listagem e na página do produto.",
    description:
      "Descrição completa do produto, com detalhes de material, modelagem e cuidados.\n\nUm segundo parágrafo com medidas e recomendações de uso.",
    categoryId: CATEGORY_CYCLE[index % CATEGORY_CYCLE.length],
    tagIds: [tags[index % tags.length].id, tags[(index + 2) % tags.length].id],
    collectionIds: number % 2 === 0 ? [collections[0].id] : [],
    priceCents,
    promotionalPriceCents: onSale ? Math.round(priceCents * 0.8) : null,
    stock,
    status: STATUS_CYCLE[index % STATUS_CYCLE.length],
    featured: number % 4 === 0,
    images: Array.from({ length: (number % 3) + 2 }, (_, imageIndex) => ({
      id: `img-${label}-${imageIndex + 1}`,
      alt: `Produto exemplo ${label} — imagem ${imageIndex + 1}`,
    })),
    variants:
      number % 3 === 0
        ? [
            { id: `var-${label}-p`, name: "Tamanho P", sku: `EX-${label}-P`, priceCents: null, stock: Math.floor(stock / 3), active: true, options: { Tamanho: "P" } },
            { id: `var-${label}-m`, name: "Tamanho M", sku: `EX-${label}-M`, priceCents: null, stock: Math.floor(stock / 3), active: true, options: { Tamanho: "M" } },
            { id: `var-${label}-g`, name: "Tamanho G", sku: `EX-${label}-G`, priceCents: priceCents + 500, stock: 0, active: false, options: { Tamanho: "G" } },
          ]
        : [],
    createdAt: `2026-09-${String(((index % 18) + 1)).padStart(2, "0")}T12:00:00.000Z`,
  };
});

const REQUEST_STATUS_CYCLE = ["new", "in-progress", "confirmed", "cancelled", "new", "confirmed"] as const;

const customerNames = [
  "Ana Souza", "Bruno Lima", "Carla Dias", "Diego Alves",
  "Elisa Rocha", "Felipe Nunes", "Gabriela Reis", "Henrique Costa",
];

const requests: AdminRequest[] = Array.from({ length: 14 }, (_, index) => {
  const number = index + 1;
  const customer = customerNames[index % customerNames.length];

  return {
    id: `req-${number}`,
    code: `SOL-${String(1000 + number)}`,
    customerName: customer,
    phone: `+55 11 9${String(80000000 + number * 137).slice(0, 8)}`,
    itemCount: (number % 4) + 1,
    estimatedTotalCents: 7990 + (number % 7) * 4500,
    createdAt: `2026-09-${String(18 - (index % 14)).padStart(2, "0")}T14:30:00.000Z`,
    status: REQUEST_STATUS_CYCLE[index % REQUEST_STATUS_CYCLE.length],
  };
});

const customers: AdminCustomer[] = customerNames.map((name, index) => {
  const related = requests.filter((request) => request.customerName === name);
  return {
    id: `cus-${index + 1}`,
    name,
    phone: related[0]?.phone ?? "+55 11 900000000",
    lastRequestAt: related[0]?.createdAt ?? "2026-09-01T12:00:00.000Z",
    requestCount: related.length,
  };
});

export function getStore() {
  return store;
}

export function getStores() {
  return stores;
}

export function getUser() {
  return user;
}

export function getStats(): DashboardStats {
  return {
    totalProducts: products.length,
    publishedProducts: products.filter((product) => product.status === "published").length,
    inStockProducts: products.filter((product) => product.stock > 0).length,
    openRequests: requests.filter((request) => request.status === "new" || request.status === "in-progress").length,
  };
}

export function getProducts() {
  return products;
}

export function getProduct(id: string) {
  return products.find((product) => product.id === id);
}

export function getRecentProducts(limit: number) {
  return [...products]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function getCategories() {
  return categories;
}

/** Achata a hierarquia preservando a ordem de exibição e a profundidade. */
export function getCategoryTree(): AdminCategoryNode[] {
  const byParent = (parentId: string | null) =>
    categories
      .filter((category) => category.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

  const walk = (parentId: string | null, depth: number): AdminCategoryNode[] =>
    byParent(parentId).flatMap((category) => [
      { ...category, depth },
      ...walk(category.id, depth + 1),
    ]);

  return walk(null, 0);
}

export function getCategoryName(id: string | null) {
  if (!id) return null;
  return categories.find((category) => category.id === id)?.name ?? null;
}

export function getTags() {
  return tags;
}

export function getCollections() {
  return collections;
}

export function getStockRows(): AdminStockRow[] {
  return products.flatMap((product): AdminStockRow[] =>
    product.variants.length > 0
      ? product.variants.map((variant) => ({
          id: variant.id,
          productId: product.id,
          productName: product.name,
          sku: variant.sku,
          variantName: variant.name,
          stock: variant.stock,
        }))
      : [
          {
            id: product.id,
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            variantName: null,
            stock: product.stock,
          },
        ],
  );
}

export function getRequests() {
  return requests;
}

export function getRecentRequests(limit: number) {
  return [...requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

export function getCustomers() {
  return customers;
}
