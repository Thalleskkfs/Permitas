import Link from "next/link";
import { useId } from "react";
import React from "react";
import type { StorefrontPaths } from "@/lib/storefront-paths";
import type { Category } from "@/types/catalog";
import { CategoryShowcase, type CategoryShowcaseItem } from "./CategoryShowcase";
import { Container } from "./Container";

/**
 * Índice de categorias da página inicial.
 * Desktop (lg+): índice editorial com foto (CategoryShowcase), quando a página manda os
 * dados dele. Tablet: grade de cartões. No celular a seção não aparece: as categorias
 * ficam na aba do cabeçalho (MenuCategorias).
 */
export function CategoryIndex({
  categories,
  paths,
  showcase,
}: {
  categories: Category[];
  paths: StorefrontPaths;
  showcase?: CategoryShowcaseItem[];
}) {
  const comIndice = Boolean(showcase && showcase.length > 0);

  const titleId = useId();

  if (categories.length === 0) return null;

  return (
    <nav aria-labelledby={titleId} className="revelar">
      <Container className="flex flex-col gap-4 sm:gap-5 lg:gap-8">
        <div className="flex items-baseline justify-between gap-4">
          <h2
            id={titleId}
            className="font-display text-[length:var(--texto-titulo-2)] leading-[1.15] font-normal tracking-[-0.01em] lg:text-[length:var(--texto-secao)] lg:leading-[1.05] lg:font-light lg:tracking-[-0.02em]"
          >
            Categorias
          </h2>
          <Link
            href={paths.allProducts}
            className={`${comIndice ? "lg:hidden " : ""}focus-ring -mx-2 inline-flex min-h-11 shrink-0 items-center rounded-md px-2 text-sm text-foreground underline decoration-control-border underline-offset-4 transition-[text-decoration-color] duration-(--duracao-estado) ease-(--ease-saida) hover:decoration-accent`}
          >
            Ver todos
          </Link>
        </div>

        <ul className={`grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-3 ${comIndice ? "lg:hidden" : ""}`}>
          {categories.map((category) => (
            <li key={category.slug} className="flex">
              <Link
                href={paths.category(category.slug)}
                className={`pressionavel group focus-ring flex min-h-16 w-full flex-col justify-between rounded-2xl p-2 bg-card text-foreground transition-colors duration-(--duracao-estado) ease-(--ease-saida) hover:bg-primary sm:min-h-20 sm:p-3`}
              >
                <SetaIcon />
                <div className="w-full flex flex-col items-start justify-end h-full text-left font-display text-base leading-snug font-normal tracking-[-0.01em] sm:text-lg">
                  {category.name.split(' & ').map((part, i) => (
                    <React.Fragment key={i}>
                      {i === 0 ? part + ' &' : part}
                      {i === 0 && <br />}
                    </React.Fragment>
                  ))}
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {comIndice && showcase && <CategoryShowcase itens={showcase} />}
      </Container>
    </nav>
  );
}

function SetaIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5 self-end text-accent transition-[translate,color] duration-(--duracao-mola) ease-spring group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground"
    >
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}
