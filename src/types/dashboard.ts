/**
 * Tipos da interface do painel administrativo.
 *
 * São tipos de APRESENTAÇÃO: descrevem o que a tela precisa, não o schema do banco.
 * Quando os dados reais chegarem, um mapper converte as linhas do Supabase para estes
 * tipos e nenhum componente precisa mudar.
 */

export type ProductStatus = "draft" | "published" | "archived";

export type RequestStatus = "new" | "in-progress" | "confirmed" | "cancelled";

export type StockLevel = "in-stock" | "low-stock" | "out-of-stock";

export type AdminStore = {
  id: string;
  name: string;
  slug: string;
};

export type AdminUser = {
  name: string;
  email: string;
  roleLabel: string;
};

export type AdminImage = {
  id: string;
  alt: string;
};

export type AdminVariant = {
  id: string;
  name: string;
  sku: string | null;
  priceCents: number | null;
  stock: number;
  active: boolean;
  options: Record<string, string>;
};

export type AdminProduct = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  shortDescription: string;
  description: string;
  categoryId: string | null;
  tagIds: string[];
  collectionIds: string[];
  priceCents: number;
  promotionalPriceCents: number | null;
  stock: number;
  status: ProductStatus;
  featured: boolean;
  images: AdminImage[];
  variants: AdminVariant[];
  createdAt: string;
};

export type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  active: boolean;
  sortOrder: number;
  productCount: number;
};

export type AdminCategoryNode = AdminCategory & {
  depth: number;
};

export type AdminTag = {
  id: string;
  name: string;
  slug: string;
  usageCount: number;
};

export type AdminCollection = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  position: number;
  productCount: number;
};

export type AdminStockRow = {
  id: string;
  productId: string;
  productName: string;
  sku: string | null;
  variantName: string | null;
  stock: number;
};

export type AdminRequest = {
  id: string;
  code: string;
  customerName: string;
  phone: string;
  itemCount: number;
  estimatedTotalCents: number;
  createdAt: string;
  status: RequestStatus;
};

export type AdminCustomer = {
  id: string;
  name: string;
  phone: string;
  lastRequestAt: string;
  requestCount: number;
};

export type DashboardStats = {
  totalProducts: number;
  publishedProducts: number;
  inStockProducts: number;
  openRequests: number;
};
