"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { declareAdult } from "@/modules/storefront/age-gate-actions";

const EXIT_URL = "https://www.google.com";

/**
 * Limite de espera pela saída. A saída termina no `transitionend` do véu; se o evento
 * não vier (aba em segundo plano, transição interrompida), o portão some mesmo assim.
 */
const SAIDA_LIMITE_MS = 900;

/**
 * Portão de idade (declaratório). Envolve todo o conteúdo da loja.
 *
 * Quem decide se ele abre é o servidor (`open`, lido do cookie no layout), então o
 * portão já vem no HTML do primeiro quadro, ou não vem. O conteúdo continua no HTML,
 * mas fica `inert` enquanto o portão está aberto. O invólucro é sempre o mesmo, aberto
 * ou não, para que confirmar não remonte a loja por baixo.
 *
 * Visual: é a primeira tela de todo visitante, então é a marca inteira em poucos
 * elementos. Campo vinho em tela cheia, o logo, um título leve na família de exibição
 * e uma única ação cheia. Sem cartão: o portão é a própria página.
 *
 * Movimento: o fundo já nasce pintado (se ele surgisse aos poucos, a loja apareceria
 * por trás); logo, texto e botões sobem em sequência com a mola de entrada. Ao
 * confirmar, a loja é liberada na hora e o véu se dissolve por cima dela, sem segurar
 * nenhum toque. Com menos movimento pedido pelo sistema, nada se desloca e a saída é
 * imediata (as durações dos tokens caem para 1ms).
 */
export function AgeGate({
  open: initialOpen,
  termsHref,
  children,
}: {
  open: boolean;
  termsHref: string;
  children: ReactNode;
}) {
  const [declared, setDeclared] = useState(!initialOpen);
  // Entre a confirmação e o fim da dissolução: a loja já está livre, o véu ainda pinta.
  const [saindo, setSaindo] = useState(false);
  const pathname = usePathname();
  // Os Termos de Uso ficam legíveis sem declarar: o portão aponta para eles.
  const open = !declared && pathname !== termsHref;
  const bloqueando = open && !saindo;
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  // Rede de segurança da saída, caso o `transitionend` não chegue.
  useEffect(() => {
    if (!saindo) return;
    const id = setTimeout(() => setDeclared(true), SAIDA_LIMITE_MS);
    return () => clearTimeout(id);
  }, [saindo]);

  // Foco preso no diálogo. Esc não fecha: fechar sem declarar derrotaria o portão.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>("a[href], button");
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !dialogRef.current?.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <div inert={bloqueando} className="flex flex-1 flex-col">
        {children}
      </div>

      {open ? (
        <>
          {/* Trava a rolagem desde o HTML do servidor, sem depender de JavaScript. */}
          {bloqueando && <style>{"html{overflow:hidden}"}</style>}
          <div
            // Saindo, o véu fica `inert` e não recebe toque: a loja por baixo já responde.
            inert={saindo}
            onTransitionEnd={(event) => {
              if (saindo && event.target === event.currentTarget) setDeclared(true);
            }}
            className={`campo-vinho fixed inset-0 z-50 overflow-y-auto overscroll-contain text-foreground transition-[opacity,transform] duration-(--duracao-mola) ease-(--ease-saida) ${
              saindo ? "pointer-events-none scale-[1.015] opacity-0" : ""
            }`}
          >
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="age-gate-title"
              aria-describedby="age-gate-description"
              onKeyDown={handleKeyDown}
              // No celular o texto e os botões ficam no terço de baixo, ao alcance do
              // polegar, com o logo no alto; em telas maiores o bloco se centraliza.
              className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:justify-center sm:px-8"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático, sem otimização a fazer */}
              <img
                src="/marca/logo-branco.svg"
                alt=""
                width={1160}
                height={831}
                // 64px no celular, 80px no desktop: acima de 48px a assinatura do logo
                // continua legível.
                className="entrada h-16 w-auto self-start sm:h-20"
              />

              <div className="entrada mt-auto pt-16 [--ordem:1] sm:mt-14 sm:pt-0">
                <h2
                  id="age-gate-title"
                  className="font-display text-[length:var(--texto-titulo-1)] leading-[1.08] font-light tracking-[-0.02em] text-balance"
                >
                  Conteúdo para maiores de 18 anos
                </h2>
                <p
                  id="age-gate-description"
                  className="mt-5 max-w-[40ch] text-base leading-[1.55] text-pretty text-muted-foreground"
                >
                  Este site contém produtos destinados a maiores de 18 anos. Ao entrar, você
                  declara ter 18 anos ou mais.
                </p>
              </div>

              <div className="entrada mt-8 flex flex-col [--ordem:2]">
                {/* Um só botão cheio: confirmar. Sair é a saída vazada, ao lado. */}
                <div className="flex flex-col gap-3 sm:flex-row">
                  <form action={declareAdult} onSubmit={() => setSaindo(true)} className="sm:flex-1">
                    <button
                      ref={confirmRef}
                      type="submit"
                      className="pressionavel focus-ring inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-7 text-[0.9375rem] font-medium whitespace-nowrap text-primary-foreground hover:bg-primary-hover"
                    >
                      Tenho 18 anos ou mais
                    </button>
                  </form>
                  <a
                    href={EXIT_URL}
                    rel="noreferrer"
                    className="pressionavel focus-ring inline-flex min-h-12 items-center justify-center rounded-full border border-control-border px-7 text-[0.9375rem] font-medium text-foreground hover:border-foreground hover:bg-foreground/5"
                  >
                    Sair
                  </a>
                </div>
                <a
                  href={termsHref}
                  className="focus-ring -mx-2 mt-4 inline-flex min-h-11 items-center self-start rounded-md px-2 text-sm text-muted-foreground underline decoration-control-border underline-offset-4 transition-colors duration-(--duracao-estado) ease-(--ease-saida) hover:text-foreground hover:decoration-accent"
                >
                  Termos de Uso
                </a>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
