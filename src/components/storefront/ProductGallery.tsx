"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ProductImage as ProductImageData } from "@/types/catalog";
import { ChevronLeftIcon, ChevronRightIcon, ImageIcon } from "./icons";

type ProductGalleryProps = {
  images: ProductImageData[];
  /** Nome do produto: rótulo da galeria e do estado sem foto. */
  productName: string;
};

/*
 * Tamanhos reais de cada foto, para o navegador não baixar arquivo maior que o slot:
 * - celular com várias fotos: 84% da faixa (que vai de borda a borda, menos 16px de
 *   cada lado), para a próxima foto aparecer na beirada e convidar a deslizar;
 * - celular com uma foto só: a faixa inteira;
 * - a partir de `sm`: coluna fixa de até 26rem;
 * - desktop: a altura manda (a foto cabe na tela) e a largura sai da proporção 2:3.
 */
const SIZES_VARIAS = "(min-width: 1024px) 460px, (min-width: 640px) 416px, 80vw";
const SIZES_UNICA = "(min-width: 1024px) 460px, (min-width: 640px) 416px, calc(100vw - 2rem)";

/**
 * Galeria da página de produto.
 *
 * As fotos chegam em retrato 2:3. No celular elas ficam numa faixa de rolagem nativa
 * com `scroll-snap`: o polegar arrasta, a foto acompanha o dedo, herda a velocidade do
 * gesto e assenta sozinha, sem biblioteca. Abaixo, um traço por foto mostra onde se
 * está (o mesmo indicador da hero). No desktop a mesma faixa vira a foto principal e as
 * miniaturas ficam numa coluna ao lado; tocar numa miniatura rola a faixa até a foto,
 * e é essa rolagem que dá o movimento da troca. Com redução de movimento, a troca é
 * instantânea.
 */
export function ProductGallery({ images, productName }: ProductGalleryProps) {
  // Foto sem endereço não vale como foto: ela só apareceria como um buraco na faixa.
  const fotos = images.filter((image) => Boolean(image.src));

  if (fotos.length === 0) return <SemFoto productName={productName} alt={images[0]?.alt} />;
  return <Faixa fotos={fotos} productName={productName} />;
}

function SemFoto({ productName, alt }: { productName: string; alt?: string }) {
  // Sem foto, um bloco calmo no lugar dela, sem texto de "sem imagem". No celular é
  // mais baixo que o retrato para não empurrar a compra para longe; no desktop guarda
  // o 2:3 que a foto vai ocupar quando chegar.
  return (
    <div
      role="img"
      aria-label={alt ?? productName}
      className="flex aspect-[5/4] w-full items-center justify-center rounded-card bg-muted text-muted-foreground sm:w-[26rem] sm:max-w-full lg:aspect-[2/3] lg:h-[min(44rem,calc(100dvh-8rem))] lg:w-auto"
    >
      <ImageIcon className="size-6" />
    </div>
  );
}

function Faixa({ fotos, productName }: { fotos: ProductImageData[]; productName: string }) {
  const trilhoRef = useRef<HTMLDivElement>(null);
  const quadroRef = useRef<number | null>(null);
  const [atual, setAtual] = useState(0);
  const [semMovimento, setSemMovimento] = useState(false);
  const varias = fotos.length > 1;

  useEffect(() => {
    const consulta = window.matchMedia("(prefers-reduced-motion: reduce)");
    const aplicar = () => setSemMovimento(consulta.matches);
    aplicar();
    consulta.addEventListener("change", aplicar);
    return () => consulta.removeEventListener("change", aplicar);
  }, []);

  useEffect(
    () => () => {
      if (quadroRef.current !== null) cancelAnimationFrame(quadroRef.current);
    },
    [],
  );

  // A foto atual sai da posição real da faixa, inclusive a rolada com o dedo. As fotos
  // não ocupam a faixa inteira no celular (a próxima aparece na beirada), então a conta
  // é pela foto cujo início está mais perto do início visível; no fim da rolagem, a
  // última vale mesmo sem alinhar.
  const medir = useCallback(() => {
    quadroRef.current = null;
    const trilho = trilhoRef.current;
    if (!trilho) return;
    const slides = Array.from(trilho.children) as HTMLElement[];
    const fim = trilho.scrollWidth - trilho.clientWidth;
    if (fim > 0 && trilho.scrollLeft >= fim - 2) {
      setAtual(slides.length - 1);
      return;
    }
    const inicio = trilho.scrollLeft + slides[0].offsetLeft;
    let maisPerto = 0;
    slides.forEach((slide, indice) => {
      if (Math.abs(slide.offsetLeft - inicio) < Math.abs(slides[maisPerto].offsetLeft - inicio)) {
        maisPerto = indice;
      }
    });
    setAtual(maisPerto);
  }, []);

  // Uma medição por quadro, no máximo: a rolagem dispara bem mais eventos que isso.
  const aoRolar = () => {
    if (quadroRef.current === null) quadroRef.current = requestAnimationFrame(medir);
  };

  const irPara = (indice: number) => {
    const trilho = trilhoRef.current;
    const slide = trilho?.children[indice] as HTMLElement | undefined;
    if (!trilho || !slide) return;
    trilho.scrollTo({
      left: slide.offsetLeft - (trilho.children[0] as HTMLElement).offsetLeft,
      behavior: semMovimento ? "auto" : "smooth",
    });
  };

  /** Um passo para o lado, dando a volta nas pontas — como as setas da hero. */
  const irRelativo = (direcao: 1 | -1) => {
    const total = fotos.length;
    irPara((atual + direcao + total) % total);
  };

  return (
    <div
      role="region"
      aria-roledescription="galeria"
      aria-label={`Fotos de ${productName}`}
      className="flex flex-col gap-1 lg:flex-row-reverse lg:items-start lg:gap-3"
    >
      {/*
        No desktop a foto grande não tinha nenhum jeito óbvio de trocar: só a coluna de
        miniaturas, pequena e ao lado. Quem tentava clicar na própria foto (o alvo mais
        natural) não via nada acontecer. As setas aqui vivem FORA da faixa que rola —
        senão, sendo `position: absolute` dentro dela, andariam junto com a rolagem em
        vez de ficar coladas na borda da foto.
      */}
      <div className="relative lg:aspect-[2/3] lg:h-[min(44rem,calc(100dvh-8rem))] lg:w-auto lg:shrink-0">
      <div
        ref={trilhoRef}
        onScroll={varias ? aoRolar : undefined}
        // Rolável pelo teclado (setas) quando há mais de uma foto.
        tabIndex={varias ? 0 : undefined}
        // No celular a faixa vai de borda a borda (sai do respiro do Container) e o
        // respiro volta como recuo interno: a primeira foto alinha com o texto e a
        // próxima encosta na borda da tela, como numa vitrine.
        className="focus-ring -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto overscroll-x-contain px-4 [scrollbar-width:none] sm:mx-0 sm:scroll-px-0 sm:px-0 lg:aspect-[2/3] lg:h-[min(44rem,calc(100dvh-8rem))] lg:w-auto lg:shrink-0 lg:gap-0 lg:rounded-card [&::-webkit-scrollbar]:hidden"
      >
        {fotos.map((foto, indice) => (
          <div
            key={`${foto.src}-${indice}`}
            role="group"
            aria-roledescription="foto"
            aria-label={`${indice + 1} de ${fotos.length}`}
            className={`relative aspect-[2/3] shrink-0 snap-start overflow-hidden rounded-card bg-muted sm:w-[26rem] sm:max-w-full lg:h-full lg:w-full lg:max-w-none lg:rounded-none ${
              varias ? "w-[84%]" : "w-full"
            } ${
              // No celular a foto que está na beirada fica apagada: diz que há mais e
              // não disputa atenção com a atual. Só a opacidade muda, com a curva de saída.
              varias && indice !== atual
                ? "opacity-55 transition-opacity duration-(--duracao-estado) ease-(--ease-saida) lg:opacity-100"
                : "transition-opacity duration-(--duracao-estado) ease-(--ease-saida)"
            }`}
          >
            <Image
              src={foto.src!}
              alt={foto.alt}
              fill
              // Só a primeira é candidata a maior elemento da tela.
              priority={indice === 0}
              sizes={varias ? SIZES_VARIAS : SIZES_UNICA}
              className="object-cover"
            />
          </div>
        ))}
      </div>

      {/* Setas só no desktop: no celular já existe o arrasto e os traços abaixo. */}
      {varias && (
        <>
          <button
            type="button"
            onClick={() => irRelativo(-1)}
            aria-label="Foto anterior"
            className="pressionavel focus-ring absolute top-1/2 left-3 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur-sm hover:bg-background lg:flex"
          >
            <ChevronLeftIcon className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => irRelativo(1)}
            aria-label="Próxima foto"
            className="pressionavel focus-ring absolute top-1/2 right-3 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur-sm hover:bg-background lg:flex"
          >
            <ChevronRightIcon className="size-5" />
          </button>
        </>
      )}
      </div>

      {varias && (
        <>
          {/* Celular: um traço por foto, o atual inteiro em rosé, os demais menores. */}
          <ul className="-ml-2 flex items-center lg:hidden">
            {fotos.map((foto, indice) => (
              <li key={`traco-${foto.src}-${indice}`}>
                <button
                  type="button"
                  onClick={() => irPara(indice)}
                  aria-label={`Ver foto ${indice + 1} de ${fotos.length}`}
                  aria-current={indice === atual}
                  className="focus-ring flex size-11 items-center justify-center rounded-full"
                >
                  <span
                    aria-hidden
                    className={`block h-0.5 w-7 rounded-full transition-[scale,background-color] duration-(--duracao-mola) ease-spring ${
                      indice === atual ? "scale-x-100 bg-accent" : "scale-x-[0.4] bg-muted-foreground/60"
                    }`}
                  />
                </button>
              </li>
            ))}
          </ul>

          {/* Desktop: miniaturas em coluna, ao lado da foto. */}
          <ul className="hidden flex-col gap-3 lg:flex">
            {fotos.map((foto, indice) => (
              <li key={`mini-${foto.src}-${indice}`}>
                <button
                  type="button"
                  onClick={() => irPara(indice)}
                  aria-label={`Ver foto ${indice + 1} de ${fotos.length}`}
                  aria-current={indice === atual}
                  // A atual ganha um anel rosé afastado da foto e opacidade cheia; as
                  // demais ficam apagadas até o ponteiro passar. Anel e opacidade juntos
                  // funcionam para quem não distingue a cor.
                  className={`pressionavel focus-ring relative block aspect-[2/3] w-16 overflow-hidden rounded-md bg-muted ${
                    indice === atual
                      ? "opacity-100 ring-1 ring-accent ring-offset-2 ring-offset-background"
                      : "opacity-55 hover:opacity-100"
                  }`}
                >
                  <Image src={foto.src!} alt="" fill sizes="64px" className="object-cover" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
