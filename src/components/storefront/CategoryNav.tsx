import Link from "next/link";
import type { StorefrontPaths } from "@/lib/storefront-paths";
import type { Category } from "@/types/catalog";
import { Container } from "./Container";

type CategoryNavProps = {
  categories: Category[];
  paths: StorefrontPaths;
  activeSlug?: string;
  /** Marca "Todos" como o item atual (página com a lista completa de produtos). */
  allProductsActive?: boolean;
};

const CHIP =
  "pressionavel focus-ring inline-flex min-h-11 items-center rounded-full border px-4 text-sm whitespace-nowrap";
const CHIP_ATIVO = "border-accent bg-accent/10 font-medium text-foreground";
const CHIP_INATIVO =
  "border-border text-muted-foreground hover:border-control-border hover:text-foreground";

/**
 * Faixa de categorias em chips de pílula.
 *
 * No celular é uma faixa rolável com o dedo (rolagem nativa, com encaixe suave); o
 * chip cortado na borda da tela é o sinal de que há mais além dela (sem máscara em
 * degradê: gradiente é proibido na vitrine). O primeiro chip, "Todos", leva à lista
 * completa de produtos. A categoria atual
 * leva o rosé, a cor de "aqui você está", no contorno e num véu leve, e também peso
 * de fonte maior, para não depender só da cor.
 */
export function CategoryNav({
  categories,
  paths,
  activeSlug,
  allProductsActive = false,
}: CategoryNavProps) {
  if (categories.length === 0) return null;

  return (
    <nav aria-label="Categorias" className="hidden sm:block">
      <Container>
        {/*
          A faixa rola dentro do próprio contêiner: as margens negativas apenas anulam o
          padding do Container (nunca excedem a largura dele), então a página não rola.
        */}
        <ul className="flex flex-wrap gap-2 py-3">
          <li
            className={`shrink-0 snap-start ${allProductsActive ? "[scroll-initial-target:nearest]" : ""}`}
          >
            <Link
              href={paths.allProducts}
              aria-current={allProductsActive ? "page" : undefined}
              className={`${CHIP} ${allProductsActive ? CHIP_ATIVO : CHIP_INATIVO}`}
            >
              Todos
            </Link>
          </li>
          {categories.map((category) => {
            const isActive = category.slug === activeSlug;

            return (
              <li
                key={category.slug}
                // O chip atual já nasce visível na faixa, mesmo que esteja no fim dela
                // (navegadores com suporte; nos demais a faixa começa do início).
                className={`shrink-0 snap-start ${isActive ? "[scroll-initial-target:nearest]" : ""}`}
              >
                <Link
                  href={paths.category(category.slug)}
                  aria-current={isActive ? "page" : undefined}
                  className={`${CHIP} ${isActive ? CHIP_ATIVO : CHIP_INATIVO}`}
                >
                  {category.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </Container>
    </nav>
  );
}
