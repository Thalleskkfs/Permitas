"use client";

import Link from "next/link";
import { BagIcon } from "./icons";
import { useWishlistCount } from "./useWishlist";

/**
 * Link "Carrinho" do cabeçalho, com o número de itens.
 *
 * É a única parte do cabeçalho que roda no navegador: a lista mora no `localStorage`,
 * então o resto do cabeçalho continua sendo renderizado no servidor.
 *
 * - Antes da hidratação o hook devolve `null` e nada aparece (nem "0"), para não piscar.
 * - A quantidade entra no nome acessível do link ("Carrinho, 3 itens"). Não há região
 *   `aria-live`: o número é lido quando o visitante chega ao link, sem anúncio a cada
 *   renderização.
 * - A troca de número é instantânea, como pede a direção de movimento (contador não anima).
 */
export function LinkDaLista({ href, storeSlug, className }: { href: string; storeSlug: string; className: string }) {
  const total = useWishlistCount(storeSlug);
  const temItens = total !== null && total > 0;

  return (
    // Folga extra entre ícone e rótulo para o selo não encostar no texto no desktop.
    <Link href={href} className={`${className} sm:gap-3`}>
      <span className="relative inline-flex">
        <BagIcon />
        {temItens && (
          <span
            aria-hidden
            className="absolute -top-2 -right-2.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-xs leading-none font-semibold text-background tabular-nums"
          >
            {total > 99 ? "99+" : total}
          </span>
        )}
      </span>
      <span className="sr-only sm:not-sr-only">Carrinho</span>
      {temItens && <span className="sr-only">{`, ${total} ${total === 1 ? "item" : "itens"}`}</span>}
    </Link>
  );
}
