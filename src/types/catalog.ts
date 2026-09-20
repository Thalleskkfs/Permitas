export type ProductImage = {
  src?: string;
  alt: string;
};

export type VariantOption = {
  value: string;
  available: boolean;
};

export type VariantGroup = {
  name: string;
  options: VariantOption[];
};

export type ProductInfoRow = {
  label: string;
  value: string;
};

/** Valores monetários sempre em centavos. */
export type Product = {
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  price: number;
  promotionalPrice?: number;
  available: boolean;
  badge?: string;
  images: ProductImage[];
  variants: VariantGroup[];
  tags: string[];
  additionalInfo: ProductInfoRow[];
  categorySlugs: string[];
  featured: boolean;
};

export type ProductCardData = {
  name: string;
  href: string;
  price: number;
  promotionalPrice?: number;
  available: boolean;
  badge?: string;
  image?: ProductImage;
};

export type Category = {
  slug: string;
  name: string;
};

export type StoreHero = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionHref?: string;
};

export type Store = {
  slug: string;
  name: string;
  description?: string;
  hero?: StoreHero;
};

export type CartItem = {
  id: string;
  name: string;
  href: string;
  unitPrice: number;
  quantity: number;
  variantLabel?: string;
  image?: ProductImage;
};
