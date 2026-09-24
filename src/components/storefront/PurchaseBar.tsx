"use client";

import { type RefObject, useEffect, useState } from "react";
import { Container } from "./Container";
import { ChatIcon } from "./icons";
import { estiloWhatsApp } from "./WhatsAppButton";

type PurchaseBarProps = {
  /** O bloco do botão principal: a barra aparece quando ele passa para cima da tela. */
  alvo: RefObject<HTMLElement | null>;
  /** Link `wa.me` já montado, o mesmo do botão principal. Sem ele, a barra não existe. */
  href: string | null;
  preco: string;
  /** Variante escolhida ("Tamanho M · Cor Preto") ou, sem escolha, o nome do produto. */
  legenda: string;
};

/**
 * Barra de compra do celular.
 *
 * Quem rola a página para ler a descrição perde o botão de WhatsApp de vista; a barra
 * traz o preço e o mesmo botão de volta, presos ao rodapé da tela, só enquanto o botão
 * principal estiver ACIMA da tela. Antes de chegar nele não aparece (ele ainda está por
 * vir), e some quando o rodapé do site entra na tela, para nunca cobrir o fim da página.
 *
 * Leitor de tela e teclado: a barra é um atalho visual para o polegar. O botão principal
 * continua sendo o único na ordem de foco e na árvore de acessibilidade; a barra fica
 * `aria-hidden`, fora da tabulação, e `inert` quando escondida, para não existirem dois
 * "Comprar pelo WhatsApp" competindo.
 *
 * Movimento: sobe da borda de baixo com a mola e desce pelo mesmo caminho. Só `transform`
 * e `opacity`. Com redução de movimento, os tokens de duração caem a 1ms e ela só aparece.
 */
export function PurchaseBar({ alvo, href, preco, legenda }: PurchaseBarProps) {
  const [botaoAcima, setBotaoAcima] = useState(false);
  const [rodapeNaTela, setRodapeNaTela] = useState(false);

  useEffect(() => {
    const elemento = alvo.current;
    if (!elemento) return;
    const observador = new IntersectionObserver(([entrada]) => {
      // Fora da tela E acima dela: o visitante já passou pelo botão.
      setBotaoAcima(!entrada.isIntersecting && entrada.boundingClientRect.top < 0);
    });
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [alvo]);

  useEffect(() => {
    const rodape = document.querySelector("footer");
    if (!rodape) return;
    const observador = new IntersectionObserver(([entrada]) => setRodapeNaTela(entrada.isIntersecting));
    observador.observe(rodape);
    return () => observador.disconnect();
  }, []);

  if (!href) return null;
  const visivel = botaoAcima && !rodapeNaTela;

  return (
    <div
      aria-hidden
      inert={!visivel}
      // Camada translúcida como o cabeçalho; com transparência reduzida, fundo sólido.
      // O recuo de baixo respeita a área do indicador de início do iPhone.
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-[translate,opacity] duration-(--duracao-mola) ease-spring supports-[backdrop-filter]:bg-background/75 supports-[backdrop-filter]:backdrop-blur-md lg:hidden [@media(prefers-reduced-transparency:reduce)]:bg-background [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none ${
        visivel ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"
      }`}
    >
      <Container className="flex items-center gap-3 pt-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-base leading-tight font-semibold tabular-nums">{preco}</span>
          <span className="truncate text-xs text-muted-foreground">{legenda}</span>
        </div>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={-1}
          className={`${estiloWhatsApp} shrink-0 px-4`}
        >
          <ChatIcon />
          Comprar pelo WhatsApp
        </a>
      </Container>
    </div>
  );
}
