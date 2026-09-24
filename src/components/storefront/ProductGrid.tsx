import type { ProductCardData } from "@/types/catalog";
import { ProductCard } from "./ProductCard";

export function ProductGrid({ products }: { products: ProductCardData[] }) {
  if (products.length === 0) {
    // Reserva: as páginas mostram o próprio estado vazio, com a saída certa para cada
    // caso. Aqui fica só a frase, alinhada como o resto do conteúdo.
    return <p className="text-base text-muted-foreground">Nenhum produto por aqui ainda.</p>;
  }

  // 2 colunas no celular, 3 no tablet, 4 no desktop. Os vãos são os da direção e
  // entram na conta dos `sizes` do ProductCard: mudou aqui, muda lá.
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-3 md:gap-x-4 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-12">
      {products.map((product) => (
        <li key={product.href}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}

/* Peças comuns às páginas de lista (categoria, todos, busca, coleção). */

/** Botão cheio vinho: a ação da área quando não há WhatsApp nela. */
export const botaoVinho =
  "pressionavel focus-ring inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-7 text-[0.9375rem] font-medium whitespace-nowrap text-primary-foreground hover:bg-primary-hover";

/** Botão vazado: a ação secundária que convive com uma cheia. */
export const botaoVazado =
  "pressionavel focus-ring inline-flex min-h-12 items-center justify-center rounded-full border border-control-border px-7 text-[0.9375rem] font-medium whitespace-nowrap text-foreground hover:border-foreground hover:bg-foreground/5";

/** Botão do WhatsApp: verde com texto escuro, sempre. */
export const botaoWhatsApp =
  "pressionavel focus-ring inline-flex min-h-12 items-center justify-center gap-2.5 rounded-full bg-whatsapp px-7 text-[0.9375rem] font-semibold whitespace-nowrap text-whatsapp-foreground hover:bg-[color-mix(in_oklab,var(--whatsapp)_86%,var(--foreground))]";

/** Campo de formulário: fundo `muted`, contorno de controle e 16px (sem zoom no iOS). */
export const campo =
  "focus-ring min-h-12 min-w-0 rounded-md border border-control-border bg-muted px-4 text-base text-foreground placeholder:text-muted-foreground transition-[border-color] duration-(--duracao-estado) ease-(--ease-saida) focus:border-accent";

export const tituloDePagina =
  "font-display text-[length:var(--texto-titulo-1)] leading-[1.08] font-light tracking-[-0.02em] text-balance";

export const tituloDeSecao =
  "font-display text-[length:var(--texto-titulo-2)] leading-[1.15] font-normal tracking-[-0.01em] text-balance";

/** Título de seção da página inicial: no desktop ganha a voz de exibição (Jost leve, maior). */
export const tituloDeVitrine = `${tituloDeSecao} lg:text-[length:var(--texto-secao)] lg:font-light lg:leading-[1.05] lg:tracking-[-0.02em]`;

/**
 * Cabeçalho de uma lista: título, apoio opcional e a contagem. O que vier em `children`
 * (a ordenação) fica à direita no desktop e abaixo no celular. Entra na primeira
 * pintura, por ser o primeiro bloco da página.
 */
export function CabecalhoDaLista({
  titulo,
  descricao,
  total,
  children,
}: {
  titulo: string;
  descricao?: string;
  total?: number;
  children?: React.ReactNode;
}) {
  return (
    <header className="entrada flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
      <div className="flex flex-col gap-3">
        <h1 className={tituloDePagina}>{titulo}</h1>
        {descricao && (
          <p className="max-w-[60ch] text-base leading-[1.55] text-pretty text-muted-foreground">
            {descricao}
          </p>
        )}
        {total !== undefined && total > 0 && (
          <p className="text-sm text-muted-foreground tabular-nums">
            {total} {total === 1 ? "produto" : "produtos"}
          </p>
        )}
      </div>
      {children}
    </header>
  );
}

/**
 * Estado vazio da direção: diz o que aconteceu e o que fazer, com uma ação só,
 * alinhado à esquerda. Sem ilustração e sem caixa tracejada.
 */
export function EstadoVazio({
  titulo,
  texto,
  children,
}: {
  titulo: string;
  texto: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-8 py-2">
      <div className="flex flex-col gap-3">
        <h2 className={tituloDeSecao}>{titulo}</h2>
        <p className="max-w-[48ch] text-base leading-[1.55] text-pretty text-muted-foreground">
          {texto}
        </p>
      </div>
      {children && <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">{children}</div>}
    </div>
  );
}
