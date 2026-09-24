"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { WISHLIST_MAX_ITEMS, WISHLIST_MAX_QUANTITY } from "@/modules/storefront/wishlist";
import type { VariantGroup } from "@/types/catalog";
import { useWishlist } from "./useWishlist";

type AddToWishlistButtonProps = {
  storeSlug: string;
  productSlug: string;
  productName: string;
  variants: VariantGroup[];
  /** Escolha atual, por nome de grupo: `{ "Tamanho": "M" }`. */
  selected: Record<string, string>;
  quantity: number;
  available: boolean;
  wishlistHref: string;
};

/** "Tamanho", "Tamanho e Cor", "Tamanho, Cor e Estampa". */
function joinNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

/** Primeiro campo habilitado do grupo que falta escolher, para levar o foco até ele. */
function focusGroup(groupName: string) {
  const selector = `input[type="radio"][name="${CSS.escape(groupName)}"]:not(:disabled)`;
  const input = document.querySelector<HTMLInputElement>(selector);
  input?.focus();
  input?.closest("fieldset")?.scrollIntoView({ block: "center", behavior: "smooth" });
}

// Secundário vazado da direção visual: mesmo alvo do WhatsApp (48px), sem disputar com
// ele. O contorno usa `control-border` (a borda da paleta some no fundo escuro).
const styles =
  "pressionavel focus-ring inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-control-border px-7 text-[0.9375rem] leading-none font-medium whitespace-nowrap text-foreground hover:border-foreground hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-control-border disabled:hover:bg-transparent";

/**
 * "Adicionar ao carrinho": guarda o produto, com a variante e a quantidade escolhidas, na
 * lista de interesse da loja (no navegador). Preço e nome não vão junto — a página da
 * lista os busca atualizados.
 *
 * Com grupos de variante sem escolha, NÃO adiciona: diz o que falta, em alerta, e leva
 * o foco ao primeiro grupo pendente. O retorno de sucesso sai numa região `aria-live`.
 */
export function AddToWishlistButton({
  storeSlug,
  productSlug,
  productName,
  variants,
  selected,
  quantity,
  available,
  wishlistHref,
}: AddToWishlistButtonProps) {
  const wishlist = useWishlist(storeSlug);
  const [attempted, setAttempted] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const errorId = useId();

  // Derivado da escolha atual: escolher a opção que faltava some com o aviso sozinho.
  const missing = variants.filter((group) => !selected[group.name]).map((group) => group.name);
  const showMissing = attempted && missing.length > 0;

  function handleClick() {
    if (missing.length > 0) {
      setAttempted(true);
      setFeedback(null);
      focusGroup(missing[0]);
      return;
    }

    const options = Object.fromEntries(
      variants.map((group) => [group.name, selected[group.name]] as const),
    );
    const result = wishlist.add({ product: productSlug, options, quantity });

    if (result.status === "full") {
          setFeedback(
            `Seu carrinho chegou ao limite de ${WISHLIST_MAX_ITEMS} itens. Envie ou remova alguns para continuar.`,
          );
          return;
        }

        const capped = result.quantity === WISHLIST_MAX_QUANTITY ? " (quantidade máxima)" : "";
        setFeedback(
          result.status === "added"
            ? `${productName} foi adicionado ao carrinho (${result.quantity}${capped}).`
            : `${productName} já estava no carrinho: agora são ${result.quantity}${capped}.`,
        );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={!available}
        aria-describedby={showMissing ? errorId : undefined}
        className={styles}
      >
        Adicionar ao carrinho
      </button>

      {showMissing && (
        // Erro aparece na hora, sem animação, em texto claro: o vinho não tem contraste
        // para sinalizar erro no fundo escuro.
        <p id={errorId} role="alert" className="text-sm font-medium text-pretty text-foreground">
          Escolha {joinNames(missing)} antes de adicionar à lista.
        </p>
      )}

      {/* Região sempre presente: leitores de tela só anunciam mudanças numa região que já existia. */}
      <div role="status" aria-live="polite" className="text-sm">
        {feedback && (
          // A confirmação é resposta ao toque: sobe e aparece com a mola (a chave refaz
          // a entrada a cada nova confirmação). Sem movimento, só aparece.
          <p
            key={feedback}
            className="flex flex-wrap items-center gap-x-3 text-pretty text-muted-foreground motion-safe:animate-[entrar_var(--duracao-mola)_var(--ease-mola)_both]"
          >
            <span>{feedback}</span>
            <Link
              href={wishlistHref}
              className="focus-ring inline-flex min-h-11 items-center rounded-sm font-medium text-foreground underline decoration-control-border underline-offset-4 transition-[text-decoration-color] duration-(--duracao-estado) hover:decoration-accent"
            >
              Ver lista
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
