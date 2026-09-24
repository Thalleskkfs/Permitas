"use client";

import { usePathname } from "next/navigation";
import { ChatIcon } from "./icons";

/**
 * Bolha de contato pelo WhatsApp, fixa no canto da tela em todas as páginas da loja.
 *
 * É o atalho para quem quer falar com a loja sem montar lista nenhuma. Não substitui o
 * "Comprar pelo WhatsApp" da página de produto, que leva a mensagem com o item pronto.
 *
 * No celular, na página de produto, existe a barra de compra fixa no rodapé: ali a bolha
 * sobe para não ficar em cima dela. A área segura do iPhone (o traço de gesto) é
 * respeitada em todos os casos.
 */
export function WhatsAppBubble({ href, label = "Falar com a loja no WhatsApp" }: { href?: string; label?: string }) {
  const pathname = usePathname();
  if (!href) return null;

  const naPaginaDeProduto = pathname.startsWith("/produto/");

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className={`pressionavel focus-ring fixed right-4 z-30 inline-flex size-14 items-center justify-center rounded-full bg-whatsapp text-whatsapp-foreground shadow-lg shadow-black/40 hover:bg-[color-mix(in_oklab,var(--whatsapp)_86%,var(--foreground))] sm:right-6 ${
        naPaginaDeProduto
          // A barra de compra (PurchaseBar) só some em `lg:`; usar `md:` aqui fazia a bolha
          // descer cedo demais e sobrepor a barra no tablet (768–1023px).
          ? "bottom-[calc(6rem+env(safe-area-inset-bottom))] lg:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]"
          : "bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]"
      }`}
    >
      <ChatIcon className="size-7" />
    </a>
  );
}
