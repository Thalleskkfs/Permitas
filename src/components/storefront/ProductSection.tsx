import Link from "next/link";
import { useId } from "react";
import type { ProductCardData } from "@/types/catalog";
import { ProductGrid, tituloDeSecao, tituloDeVitrine } from "./ProductGrid";

type ProductSectionProps = {
  title: string;
  products: ProductCardData[];
  viewAllHref?: string;
  /** Título grande no desktop. Só na página inicial: nos relacionados do produto ele passaria o h1. */
  vitrine?: boolean;
};

/*
 * Uma faixa de vitrine é uma amostra, não a lista completa: no tablet (3 colunas) os
 * cards que sobrariam sozinhos numa última linha ficam de fora, para a faixa fechar
 * inteira. Classes escritas por extenso para o Tailwind encontrá-las.
 */
const SOBRA_NO_TABLET = [
  "",
  "md:max-lg:[&_li:nth-last-child(-n+1)]:hidden",
  "md:max-lg:[&_li:nth-last-child(-n+2)]:hidden",
];

export function ProductSection({ title, products, viewAllHref, vitrine = false }: ProductSectionProps) {
  const titleId = useId();

  if (products.length === 0) return null;

  const sobra = products.length > 3 ? products.length % 3 : 0;

  return (
    // A faixa inteira sobe e aparece ao entrar na tela, presa à rolagem; os cards não
    // animam um a um (a grade é percorrida depressa).
    <section aria-labelledby={titleId} className="revelar flex flex-col gap-5 sm:gap-6 lg:gap-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={titleId} className={vitrine ? tituloDeVitrine : tituloDeSecao}>
          {title}
        </h2>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="focus-ring -mx-2 inline-flex min-h-11 shrink-0 items-center rounded-md px-2 text-sm text-foreground underline decoration-control-border underline-offset-4 transition-[text-decoration-color] duration-(--duracao-estado) ease-(--ease-saida) hover:decoration-accent"
          >
            Ver todos
          </Link>
        )}
      </div>
      <div className={SOBRA_NO_TABLET[sobra]}>
        <ProductGrid products={products} />
      </div>
    </section>
  );
}
