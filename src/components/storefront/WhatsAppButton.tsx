"use client";

import { useId } from "react";
import { ChatIcon } from "./icons";

type WhatsAppButtonProps = {
  label?: string;
  /** Link `wa.me` já montado. Sem ele o botão não tem para onde levar. */
  href?: string | null;
  /**
   * Por que o botão está fora do ar (sem número cadastrado, produto indisponível,
   * lista vazia). Presente, desliga o botão e explica o motivo — a quem enxerga e a
   * quem usa leitor de tela.
   */
  disabledReason?: string | null;
};

// Botão de conversão da direção visual: pílula verde com texto ESCURO (branco sobre esse
// verde reprova no contraste, 1,75:1; escuro passa com folga, 9,8:1). No hover o verde
// escurece um pouco na direção do texto; no toque, afunda (`pressionavel`). Altura de
// 48px e largura cheia: é o alvo mais importante da tela no celular.
//
// Exportado para a barra de compra fixa, que repete o mesmo botão em versão compacta.
export const estiloWhatsApp =
  "pressionavel focus-ring inline-flex min-h-12 items-center justify-center gap-2.5 rounded-full bg-whatsapp text-[0.9375rem] leading-none font-semibold whitespace-nowrap text-whatsapp-foreground hover:bg-[color-mix(in_oklab,var(--whatsapp)_86%,var(--foreground))] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-whatsapp";

const styles = `${estiloWhatsApp} w-full px-7`;

/**
 * Único ponto de conversão da vitrine: abre a conversa no WhatsApp da loja com a
 * mensagem de interesse já escrita.
 *
 * Quem monta a mensagem é quem conhece os itens (a página de produto ou o carrinho);
 * aqui só chega o link pronto. Sem link, o botão não finge ser clicável: fica
 * desabilitado e diz o motivo, em vez de absorver o toque e não fazer nada.
 */
export function WhatsAppButton({
  label = "Comprar pelo WhatsApp",
  href,
  disabledReason,
}: WhatsAppButtonProps) {
  const reasonId = useId();

  if (href && !disabledReason) {
    // A conversa abre fora da vitrine: `noopener` impede que a aba de destino
    // alcance esta janela pela `window.opener`.
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={styles}>
        <ChatIcon />
        {label}
      </a>
    );
  }

  const reason = disabledReason ?? "O WhatsApp desta loja ainda não foi configurado.";

  return (
    <div className="flex flex-col gap-2">
      <button type="button" disabled aria-describedby={reasonId} className={styles}>
        <ChatIcon />
        {label}
      </button>
      <p id={reasonId} className="text-sm text-pretty text-muted-foreground">
        {reason}
      </p>
    </div>
  );
}
