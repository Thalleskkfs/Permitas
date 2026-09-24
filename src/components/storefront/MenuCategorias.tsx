"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CloseIcon, MenuIcon } from "./icons";

export type ItemDoMenu = {
  href: string;
  label: string;
  count: number;
};

/**
 * Categorias no celular: um botão no cabeçalho abre uma aba que entra pela lateral
 * esquerda. Do tablet em diante as categorias ficam nas pílulas das listas e no índice
 * da página inicial, então o botão some (nada de navegação duplicada).
 *
 * Cada categoria leva a contagem real de produtos (a que ainda não tem produto fica só
 * com o nome). Embaixo, a lista completa. O WhatsApp fica só na bolha, que já está em
 * toda página.
 *
 * É um `<dialog>` nativo: foco preso dentro, Esc fecha, o resto da página fica inerte.
 * Toque fora da aba, no botão de fechar ou num link também fecham.
 *
 * A entrada e a saída são feitas à mão (duas classes de `translate`, alternadas por
 * estado do React), em vez de `@starting-style`/`transition-discrete`: esse par depende
 * de suporte recente do navegador para transição em elemento de `<dialog>` (a "top
 * layer"), e falhou silenciosamente em teste real — a aba abria, media e continha o
 * texto certo, mas não pintava nada além do botão de fechar. Aqui a aba já nasce
 * deslocada para fora da tela (classe -translate-x-full), e dois quadros depois
 * (`requestAnimationFrame` duplo, para o navegador pintar o estado de fora antes de
 * animar) o estado muda para dentro — uma transição comum de `transform`, sem
 * depender de recurso nenhum específico de `<dialog>`. Fechar faz o caminho inverso:
 * anima para fora e só then chama `close()` de verdade.
 */
export function MenuCategorias({
  itens,
  todos,
  logo,
  classeDoBotao,
}: {
  itens: ItemDoMenu[];
  todos: { href: string; count: number };
  logo: { src: string; alt: string };
  classeDoBotao: string;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [aberto, setAberto] = useState(false);
  const [dentro, setDentro] = useState(false);
  const pathname = usePathname();

  // Com a aba aberta, a página por trás não rola.
  useEffect(() => {
    if (!aberto) return;
    const raiz = document.documentElement;
    raiz.style.overflow = "hidden";
    return () => {
      raiz.style.overflow = "";
    };
  }, [aberto]);

  // Chegou em outra página: a aba sai de cena.
  useEffect(() => {
    dialogo.current?.close();
  }, [pathname]);

  if (itens.length === 0) return null;

  const abrir = () => {
    dialogo.current?.showModal();
    setAberto(true);
    // Um quadro só não basta: o navegador precisa terminar de pintar o estado "fora da
    // tela" antes de a transição para "dentro" começar, senão ela não roda.
    requestAnimationFrame(() => requestAnimationFrame(() => setDentro(true)));
  };

  const fechar = () => {
    setDentro(false);
    window.setTimeout(() => dialogo.current?.close(), 260);
  };

  const todosAtual = pathname === todos.href;

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-controls="menu-categorias"
        className={`${classeDoBotao} sm:hidden`}
      >
        <MenuIcon />
        <span className="sr-only">Categorias</span>
      </button>

      <dialog
        id="menu-categorias"
        ref={dialogo}
        aria-label="Categorias"
        onClose={() => {
          setAberto(false);
          setDentro(false);
        }}
        // Esc dispara "cancel": anima para fora em vez de sumir na hora.
        onCancel={(evento) => {
          evento.preventDefault();
          fechar();
        }}
        // Toque no fundo escurecido (fora da aba) fecha.
        onClick={(evento) => {
          if (evento.target === evento.currentTarget) fechar();
        }}
        className={`fixed inset-y-0 right-auto left-0 m-0 h-dvh max-h-none w-[min(22rem,88vw)] max-w-none rounded-r-3xl border-0 border-r border-border bg-background p-0 text-foreground backdrop:bg-background/80 transition-transform duration-(--duracao-mola) ease-spring motion-reduce:transition-none ${
          dentro ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Topo: a marca, como no cabeçalho, e o fechar. */}
          <div className="flex h-[5.5rem] shrink-0 items-center justify-between border-b border-border pr-3 pl-5">
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático */}
            <img src={logo.src} alt={logo.alt} width={543} height={194} className="h-11 w-auto" />
            <button type="button" onClick={fechar} aria-label="Fechar" className={classeDoBotao}>
              <CloseIcon />
            </button>
          </div>

          <nav aria-label="Categorias" className="flex-1 overflow-y-auto overscroll-contain px-3 py-5">
            <p className="px-3 pb-3 text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
              Categorias
            </p>
            <ul className="flex flex-col gap-1">
              {itens.map((item, indice) => {
                const atual = pathname === item.href;
                return (
                  <li
                    key={item.href}
                    className="entrada"
                    style={{ "--ordem": indice + 1 } as React.CSSProperties}
                  >
                    <Link
                      href={item.href}
                      onClick={fechar}
                      aria-current={atual ? "page" : undefined}
                      className={`pressionavel group focus-ring flex min-h-16 items-center gap-4 rounded-2xl px-3 py-3 hover:bg-card ${
                        atual ? "bg-card" : ""
                      }`}
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span
                          className={`font-display text-xl leading-[1.2] tracking-[-0.01em] ${
                            atual ? "font-normal text-foreground" : "font-light text-foreground"
                          }`}
                        >
                          {item.label}
                        </span>
                        {item.count > 0 && (
                          <span className="text-sm text-muted-foreground tabular-nums">
                            {item.count} {item.count === 1 ? "produto" : "produtos"}
                          </span>
                        )}
                      </span>
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`size-5 shrink-0 ${atual ? "text-accent" : "text-muted-foreground group-hover:text-accent"}`}
                      >
                        <path d="M7 17 17 7M9 7h8v8" />
                      </svg>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Pé da aba: a lista completa. */}
          <div
            className="entrada flex shrink-0 flex-col border-t border-border px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            style={{ "--ordem": itens.length + 1 } as React.CSSProperties}
          >
            <Link
              href={todos.href}
              onClick={fechar}
              aria-current={todosAtual ? "page" : undefined}
              className="pressionavel focus-ring inline-flex min-h-12 items-center justify-between gap-3 rounded-full border border-control-border px-6 text-[0.9375rem] font-medium hover:border-foreground hover:bg-foreground/5"
            >
              Ver todos os produtos
              <span className="text-sm text-muted-foreground tabular-nums">{todos.count}</span>
            </Link>
          </div>
        </div>
      </dialog>
    </>
  );
}
