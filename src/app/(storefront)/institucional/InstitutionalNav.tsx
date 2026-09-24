import Link from "next/link";
import type { StorefrontPaths } from "@/lib/storefront-paths";
import {
  getInstitutionalPagesByGroup,
  INSTITUTIONAL_GROUP_LABELS,
  type InstitutionalGroup,
} from "@/modules/storefront/institutional";

const GRUPOS: InstitutionalGroup[] = ["ajuda", "politicas"];

/**
 * Índice das páginas institucionais, agrupado como no rodapé (Ajuda, Políticas).
 *
 * Um só bloco no HTML: no celular ele vem depois do texto, como "para onde ir agora";
 * em telas largas sobe para a coluna lateral e fica preso ao rolar. A página atual
 * continua na lista, marcada, para responder "onde estou" sem depender do título.
 */
export function InstitutionalNav({
  paths,
  atual,
}: {
  paths: StorefrontPaths;
  atual: string;
}) {
  return (
    <nav
      aria-label="Páginas institucionais"
      className="grid gap-8 sm:grid-cols-2 lg:sticky lg:top-24 lg:grid-cols-1"
    >
      {GRUPOS.map((grupo) => {
        const tituloId = `institucional-grupo-${grupo}`;
        return (
          <div key={grupo} className="flex flex-col">
            <h2 id={tituloId} className="text-sm font-medium text-foreground">
              {INSTITUTIONAL_GROUP_LABELS[grupo]}
            </h2>
            <ul aria-labelledby={tituloId} className="mt-2 flex flex-col">
              {getInstitutionalPagesByGroup(grupo).map((pagina) => {
                const eAtual = pagina.slug === atual;
                return (
                  <li key={pagina.slug}>
                    <Link
                      href={paths.institutional(pagina.slug)}
                      aria-current={eAtual ? "page" : undefined}
                      className={`focus-ring -mx-2 flex min-h-11 items-center gap-2.5 rounded-md px-2 text-[0.9375rem] leading-snug transition-colors duration-(--duracao-estado) ease-(--ease-saida) ${
                        eAtual
                          ? "font-medium text-foreground"
                          : "text-muted-foreground underline decoration-control-border underline-offset-4 hover:text-foreground hover:decoration-accent"
                      }`}
                    >
                      {/*
                        Traço de "você está aqui", no mesmo vocabulário do indicador do
                        carrossel. Os demais itens reservam o espaço para o texto não
                        pular; a diferença também vem do peso e do sublinhado, não só
                        da cor.
                      */}
                      <span
                        aria-hidden
                        className={`h-0.5 w-3 shrink-0 rounded-full bg-accent ${eAtual ? "" : "invisible"}`}
                      />
                      {pagina.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
