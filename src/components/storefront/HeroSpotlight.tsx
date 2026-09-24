import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import type { ProductCardData } from "@/types/catalog";

/**
 * Coluna de produtos ao lado do banner, só no desktop: a primeira tela já mostra o que a
 * loja vende e quanto custa, não só a marca. Cada cartão é um produto real, inteiro
 * clicável, e no hover afunda para o vinho escuro da paleta.
 */
export function HeroSpotlight({ products }: { products: ProductCardData[] }) {
  return products.map((product) => {
    const emPromocao = product.promotionalPrice !== undefined;
    return (
      <Link
        key={product.href}
        href={product.href}
        className="group pressionavel focus-ring flex min-h-0 overflow-hidden rounded-3xl bg-card transition-colors duration-(--duracao-estado) ease-(--ease-saida) hover:bg-primary-dark"
      >
        <div className="relative aspect-[2/3] h-full shrink-0 overflow-hidden bg-muted">
          {product.image?.src && (
            <Image
              src={product.image.src}
              alt={product.image.alt}
              fill
              sizes="200px"
              className="object-cover transition-transform duration-(--duracao-mola) ease-spring motion-safe:group-hover:scale-[1.04]"
            />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-4 p-6 xl:p-7">
          <p className="line-clamp-4 font-display text-lg leading-[1.25] font-light tracking-[-0.01em] text-pretty xl:text-xl">
            {product.name}
          </p>
          <div className="flex flex-col gap-3">
            <p className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
              <span className="text-lg font-semibold">
                {emPromocao && <span className="sr-only">Por </span>}
                {formatPrice(product.promotionalPrice ?? product.price)}
              </span>
              {emPromocao && (
                <s className="text-sm text-muted-foreground">
                  <span className="sr-only">antes </span>
                  {formatPrice(product.price)}
                </s>
              )}
            </p>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-accent group-hover:text-foreground">
              Ver produto
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4 transition-transform duration-(--duracao-mola) ease-spring motion-safe:group-hover:translate-x-0.5"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </div>
        </div>
      </Link>
    );
  });
}
