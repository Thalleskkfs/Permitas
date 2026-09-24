import Link from "next/link";
import type { ProductCardData } from "@/types/catalog";
import { ProductCard } from "./ProductCard";
import { tituloDeVitrine } from "./ProductGrid";

/**
 * Fileira de uma categoria no desktop: um bloco vinho chapado com o nome e a contagem
 * reais, ao lado de três produtos dela. Quebra a repetição de grades iguais na página
 * inicial. Texto claro sobre o vinho (o vinho nunca é cor de texto).
 */
export function CategoryShelf({
  name,
  href,
  count,
  products,
}: {
  name: string;
  href: string;
  count: number;
  products: ProductCardData[];
}) {
  return (
    <section aria-labelledby="fileira-categoria" className="revelar grid grid-cols-12 gap-6">
      <div className="col-span-4 flex flex-col justify-between gap-10 rounded-card bg-primary p-10 text-primary-foreground xl:p-12">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-primary-foreground/80 tabular-nums">
            {count} {count === 1 ? "produto" : "produtos"}
          </p>
          <h2 id="fileira-categoria" className={tituloDeVitrine}>
            {name}
          </h2>
        </div>
        <Link
          href={href}
          className="pressionavel focus-ring inline-flex min-h-12 items-center justify-center gap-2 self-start rounded-full border border-primary-foreground/50 px-7 text-[0.9375rem] font-medium whitespace-nowrap hover:border-primary-foreground hover:bg-primary-foreground/10"
        >
          Ver todos
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4"
          >
            <path d="M7 17 17 7M9 7h8v8" />
          </svg>
        </Link>
      </div>

      <ul className="col-span-8 grid grid-cols-3 gap-6">
        {products.map((product) => (
          <li key={product.href}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    </section>
  );
}
