import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  getHref: (page: number) => string;
};

type PageItem = number | "ellipsis-start" | "ellipsis-end";

function getPageItems(current: number, total: number): PageItem[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  const items: PageItem[] = [1];

  if (start > 2) items.push("ellipsis-start");
  for (let page = start; page <= end; page++) items.push(page);
  if (end < total - 1) items.push("ellipsis-end");
  items.push(total);

  return items;
}

/*
 * Até cinco páginas, os números cabem numa linha a 360px (7 alvos de 44px). Acima
 * disso o celular troca os números por "3 de 12" entre as setas: uma linha só, sem
 * quebrar, e as setas continuam do tamanho do polegar.
 */
const CABE_NO_CELULAR = 5;

// size-11 = 44px. Pílula como as demais ações; troca de página não anima, só o toque.
const alvo =
  "pressionavel focus-ring flex size-11 items-center justify-center rounded-full text-sm tabular-nums";

// Seta: botão vazado com o contorno de controle.
const seta = `${alvo} border border-control-border text-foreground hover:border-foreground hover:bg-foreground/5`;
const setaInativa = `${alvo} border border-border text-muted-foreground opacity-40`;

export function Pagination({ currentPage, totalPages, getHref }: PaginationProps) {
  if (totalPages <= 1) return null;

  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;
  const compactaNoCelular = totalPages > CABE_NO_CELULAR;

  return (
    <nav aria-label="Paginação" className="flex justify-center pt-2">
      <ul className="flex max-w-full items-center gap-1 sm:gap-1.5">
        <li>
          {hasPrevious ? (
            <Link href={getHref(currentPage - 1)} aria-label="Página anterior" className={seta}>
              <ChevronLeftIcon className="size-5" />
            </Link>
          ) : (
            <span aria-hidden="true" className={setaInativa}>
              <ChevronLeftIcon className="size-5" />
            </span>
          )}
        </li>

        {compactaNoCelular && (
          <li className="px-3 text-sm text-muted-foreground tabular-nums sm:hidden">
            <span className="sr-only">Página </span>
            <span className="font-medium text-foreground">{currentPage}</span> de {totalPages}
          </li>
        )}

        {getPageItems(currentPage, totalPages).map((item) => (
          <li key={item} className={compactaNoCelular ? "hidden sm:block" : undefined}>
            {typeof item === "string" ? (
              <span
                aria-hidden="true"
                className="flex size-11 items-center justify-center text-muted-foreground"
              >
                …
              </span>
            ) : item === currentPage ? (
              // Página atual: contorno rosé ("aqui você está"). As demais não têm
              // contorno, então a diferença se lê também pela forma, não só pela cor.
              <Link
                href={getHref(item)}
                aria-label={`Página ${item}`}
                aria-current="page"
                className={`${alvo} border border-accent font-semibold text-foreground`}
              >
                {item}
              </Link>
            ) : (
              <Link
                href={getHref(item)}
                aria-label={`Página ${item}`}
                className={`${alvo} text-muted-foreground hover:bg-foreground/5 hover:text-foreground`}
              >
                {item}
              </Link>
            )}
          </li>
        ))}

        <li>
          {hasNext ? (
            <Link href={getHref(currentPage + 1)} aria-label="Próxima página" className={seta}>
              <ChevronRightIcon className="size-5" />
            </Link>
          ) : (
            <span aria-hidden="true" className={setaInativa}>
              <ChevronRightIcon className="size-5" />
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
