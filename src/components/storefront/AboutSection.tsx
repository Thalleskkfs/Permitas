import Image from "next/image";
import type { StoreAbout } from "@/types/catalog";
import { Container } from "./Container";

const SIZES = "(min-width: 1024px) 64vw, 100vw";

/**
 * Texto curto é uma frase de apresentação: vira a peça principal, em letra de título.
 * Texto longo (o painel aceita até 600 caracteres) nesse tamanho viraria um paredão,
 * então volta ao corpo de leitura.
 */
const FRASE_CURTA = 180;
const frase =
  "font-display text-[length:var(--texto-titulo-1)] leading-[1.12] font-light tracking-[-0.02em] text-balance text-foreground";
const textoCorrido = "max-w-[52ch] text-base leading-[1.65] text-pretty text-foreground/85 sm:text-lg";

/**
 * "Sobre nós": a foto que a loja escolheu como fundo, com o texto sobre quem ela é
 * pousado por cima. A foto se dissolve num fade (mesma técnica do fade do topo da
 * hero, só que lateral aqui) até o vermelho da página, em vez de ficar numa moldura
 * separada do texto — por isso não tem `rounded-card`/borda: a intenção é a foto
 * ocupar a seção inteira, não uma caixa dentro dela.
 *
 * Foto e texto vêm juntos de `store.about` — sem um dos dois, `toStore()`
 * (mappers.ts) já não monta a seção, então este componente nunca recebe uma metade só.
 */
export function AboutSection({ about }: { about: StoreAbout }) {
  return (
    <section aria-labelledby="sobre-nos" className="revelar relative isolate overflow-hidden">
      {/* Fade por máscara, não por véu de cor: o fundo da página é um degradê fixo à
          janela, então nenhuma cor chapada casa com ele em toda posição de rolagem. A
          máscara apaga a própria foto e deixa o degradê de verdade aparecer por trás.
          Celular: foto em cima, apagando para baixo, e o texto entra na parte apagada.
          Desktop: foto sangrando até a borda direita, apagando para a esquerda, onde
          fica o texto — a foto nunca passa por baixo das letras. */}
      <div className="relative aspect-[16/10] mask-b-from-40% sm:aspect-[2/1] lg:absolute lg:inset-y-0 lg:right-0 lg:left-[36%] lg:aspect-auto lg:mask-b-from-85% lg:mask-l-from-40%">
        <Image
          src={about.image.src}
          alt={about.image.alt}
          fill
          sizes={SIZES}
          quality={90}
          className="object-cover"
        />
      </div>

      <Container className="relative -mt-6 pb-12 lg:mt-0 lg:flex lg:min-h-[28rem] lg:items-center lg:py-16">
        <div className="flex flex-col gap-4 lg:w-[38%] lg:gap-5">
          <h2 id="sobre-nos" className="font-display text-lg leading-none text-foreground/65 lg:text-xl">
            Sobre nós
          </h2>
          <p className={about.text.length <= FRASE_CURTA ? frase : textoCorrido}>{about.text}</p>
        </div>
      </Container>
    </section>
  );
}
