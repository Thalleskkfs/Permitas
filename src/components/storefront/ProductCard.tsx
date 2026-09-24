import Link from "next/link";
import { formatPrice } from "@/lib/format";
import type { ProductCardData } from "@/types/catalog";
import { ProductImage } from "./ProductImage";

/**
 * Largura real do card em cada faixa, para o navegador baixar só o necessário.
 * Conta: (largura útil do Container - vãos) / colunas, com as mesmas medidas da grade.
 *   < 640px   2 colunas, margem 16px, vão 12px  -> (100vw - 32 - 12) / 2
 *   640-767   2 colunas, margem 24px, vão 12px  -> (100vw - 48 - 12) / 2
 *   768-1023  3 colunas, margem 24px, vão 16px  -> (100vw - 48 - 32) / 3
 *   1024-1151 4 colunas, margem 24px, vão 24px  -> (100vw - 48 - 72) / 4
 *   1152-1279 Container travado em 1104px úteis -> (1104 - 72) / 4 = 258px
 *   1280-1535 Container de 1280px, margem 40px  -> (1200 - 72) / 4 = 282px
 *   >= 1536   Container de 1408px, margem 40px  -> (1328 - 72) / 4 = 314px
 * Se a grade mudar em ProductGrid, esta conta muda junto.
 */
const TAMANHOS_DO_CARD =
  "(min-width: 1536px) 314px, (min-width: 1280px) 282px, (min-width: 1152px) 258px, (min-width: 1024px) calc(25vw - 30px), (min-width: 768px) calc(33.34vw - 27px), (min-width: 640px) calc(50vw - 30px), calc(50vw - 22px)";

export function ProductCard({ product }: { product: ProductCardData }) {
  const disponivel = product.available;
  const emPromocao = product.promotionalPrice !== undefined;
  const precoAtual = product.promotionalPrice ?? product.price;
  // Indisponível fala mais alto que qualquer selo: promoção de algo que não dá para
  // pedir só frustra.
  const selo = disponivel ? product.badge : undefined;

  return (
    // O card inteiro é o alvo: afunda no toque (`pressionavel`) e recebe o anel de foco
    // quando o link dentro dele é focado pelo teclado.
    <article className="group pressionavel relative flex flex-col gap-3 lg:gap-4 rounded-card has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-4 has-[a:focus-visible]:outline-ring">
      {/*
        Retrato 2:3, o formato em que as fotos chegam (1024x1536). A proporção fica
        reservada antes de a foto carregar, então nada salta. Sem foto, a mesma área
        fica em `muted` com o ícone discreto. No hover a foto cresce um pouco dentro da
        moldura, com a mola padrão; o card em si não levanta nem ganha sombra.
      */}
      <ProductImage
        image={product.image}
        sizes={TAMANHOS_DO_CARD}
        className={`aspect-[2/3] rounded-card [&_svg]:size-6 [&_svg]:opacity-60 [&>*]:transition-transform [&>*]:duration-(--duracao-mola) [&>*]:ease-spring motion-safe:group-hover:[&>*]:scale-[1.03] ${
          disponivel ? "" : "[&>*]:opacity-45"
        }`}
      />

      <div className="flex flex-col gap-1.5">
        {/* O ::after cobre o card inteiro: a área de toque é o card, não só o nome. */}
        {/* No desktop o nome reserva duas linhas: os preços da fileira ficam na mesma altura. */}
        <h3 className="line-clamp-2 text-sm leading-[1.5] font-medium text-pretty lg:min-h-[3em] lg:font-normal">
          <Link
            href={product.href}
            className="decoration-accent underline-offset-4 outline-none after:absolute after:inset-0 after:rounded-card group-hover:underline"
          >
            {product.name}
          </Link>
        </h3>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          {/* Preço vigente em destaque; o anterior, riscado e discreto, só como referência. */}
          <p className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
            <span
              className={`text-base leading-[1.2] font-semibold ${
                disponivel ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {emPromocao && <span className="sr-only">Por </span>}
              {formatPrice(precoAtual)}
            </span>
            {emPromocao && (
              <s className="text-sm text-muted-foreground decoration-muted-foreground/70">
                <span className="sr-only">antes </span>
                {formatPrice(product.price)}
              </s>
            )}
          </p>

          {selo && (
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs leading-[1.4] font-medium tracking-[0.01em] text-primary-foreground">
              {selo}
            </span>
          )}

          {!disponivel && (
            // Contorno, não cor: o estado se lê pela palavra e pela forma vazada.
            <span className="rounded-full border border-control-border px-2.5 py-0.5 text-xs leading-[1.4] font-medium tracking-[0.01em] text-foreground">
              Indisponível
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
