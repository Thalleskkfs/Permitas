"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export type CategoryShowcaseItem = {
  href: string;
  name: string;
  count: number;
  cover?: { src: string; alt: string };
};

/**
 * Índice de categorias do desktop: nomes grandes em lista e, ao lado, a foto real de um
 * produto da categoria apontada (mouse ou teclado). Sem foto — categoria ainda vazia, ou
 * a linha de todos os produtos — o painel mostra a marca sobre a superfície da paleta.
 * A troca é só de opacidade e escala, na mola padrão; sem movimento pedido, é instantânea.
 */
export function CategoryShowcase({ itens }: { itens: CategoryShowcaseItem[] }) {
  const primeiraComFoto = Math.max(
    0,
    itens.findIndex((item) => item.cover),
  );
  const [ativo, setAtivo] = useState(primeiraComFoto);
  const capaAtiva = itens[ativo]?.cover;

  return (
    <div className="hidden lg:grid lg:grid-cols-12 lg:gap-x-6 xl:gap-x-10">
      <ul className="col-span-7 flex flex-col border-b border-border">
        {itens.map((item, indice) => {
          const destacado = indice === ativo;
          return (
            <li key={item.href} className="flex flex-1 border-t border-border">
              <Link
                href={item.href}
                onMouseEnter={() => setAtivo(indice)}
                onFocus={() => setAtivo(indice)}
                className="group focus-ring flex min-h-20 w-full items-center justify-between gap-6 rounded-md py-4"
              >
                <span className="flex min-w-0 items-baseline gap-4">
                  <span
                    className={`font-display text-[2rem] leading-[1.1] font-light tracking-[-0.02em] transition-colors duration-(--duracao-estado) ease-(--ease-saida) xl:text-[2.5rem] ${
                      destacado ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {item.name}
                  </span>
                  {item.count > 0 && (
                    <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                      {item.count} {item.count === 1 ? "produto" : "produtos"}
                    </span>
                  )}
                </span>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`size-7 shrink-0 transition-[translate,color] duration-(--duracao-mola) ease-spring motion-safe:group-hover:translate-x-1 motion-safe:group-hover:-translate-y-1 ${
                    destacado ? "text-accent" : "text-muted-foreground"
                  }`}
                >
                  <path d="M7 17 17 7M9 7h8v8" />
                </svg>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="relative col-span-5 aspect-square overflow-hidden rounded-card bg-muted">
        {itens.map((item, indice) =>
          item.cover ? (
            <Image
              key={item.href}
              src={item.cover.src}
              alt={indice === ativo ? item.cover.alt : ""}
              aria-hidden={indice !== ativo}
              fill
              sizes="(min-width: 1536px) 520px, (min-width: 1280px) 480px, 40vw"
              className={`object-cover transition-[opacity,scale] duration-(--duracao-mola) ease-spring ${
                indice === ativo ? "scale-100 opacity-100" : "scale-[1.03] opacity-0"
              }`}
            />
          ) : null,
        )}
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático */}
        <img
          src="/marca/logo-branco.svg"
          alt=""
          width={1160}
          height={831}
          loading="lazy"
          className={`absolute inset-0 m-auto h-auto w-[62%] transition-opacity duration-(--duracao-mola) ease-spring ${
            capaAtiva ? "opacity-0" : "opacity-100"
          }`}
        />
      </div>
    </div>
  );
}
