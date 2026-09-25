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

/** Um banner de destaque da hero. Vem do painel; a ordem é a de exibição. */
export type HeroSlide = {
  id: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionHref?: string;
  /** Arte para telas largas (deitada). Sem ela, o banner não aparece no desktop. */
  image?: ProductImage;
  /** Arte para o celular (em pé). Sem ela, o celular usa `image`. */
  imageMobile?: ProductImage;
};

export type StoreHero = {
  /** Um só banner é o caso normal; vários viram carrossel. Vazio esconde a hero. */
  slides: HeroSlide[];
  /**
   * Segunda chamada, fixa em todos os banners: o WhatsApp da loja. Fica fora dos
   * slides porque é o canal da loja, não um destaque que rotaciona.
   */
  contactLabel?: string;
  contactHref?: string;
  /**
   * Selos curtos logo abaixo da hero (discrição, entrega, atendimento).
   * São o texto que responde à principal objeção de quem compra: privacidade.
   */
  highlights?: string[];
};

/** Seção "Sobre nós", acima do carrossel de banners. Sem foto ou sem texto, não existe. */
export type StoreAbout = {
  image: { src: string; alt: string };
  text: string;
};

export type Store = {
  slug: string;
  name: string;
  description?: string;
  hero?: StoreHero;
  about?: StoreAbout;
  /**
   * Canal de atendimento, cru como está no banco.
   *
   * A hero já traz um link pronto em `contactHref`, mas o carrinho e a página de
   * produto montam a mensagem do zero (itens, quantidades, total) e precisam do número
   * e do modelo de mensagem sem tratamento — quem normaliza é `buildWhatsAppUrl`.
   * Opcionais porque a loja pode não ter número cadastrado.
   */
  whatsappNumber?: string | null;
  whatsappMessageTemplate?: string | null;
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
