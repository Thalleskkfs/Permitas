"use client";

import { getImageProps } from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HeroSlide, StoreHero } from "@/types/catalog";
import { Container } from "./Container";
import { ChatIcon, ChevronLeftIcon, ChevronRightIcon, PackageIcon, ShieldIcon } from "./icons";

/** Tempo de cada banner. Arte de banner se lê de relance; mais que isso, ninguém espera. */
const INTERVALO_MS = 5000;

/**
 * Onde a arte muda de versão. Abaixo disso é celular em pé (4:5); a partir daqui, a
 * arte deitada (16:9). O mesmo corte vale para o CSS (`md:`) e para o `<picture>`.
 */
const LARGURA_DESKTOP = "(min-width: 768px)";

/**
 * Primeira tela da loja: os banners da marca, girando.
 *
 * A arte vem pronta do designer (texto e composição embutidos), então nada é escrito
 * por cima dela: sem título sobre a foto, sem véu, sem degradê. Cada banner tem até duas
 * artes — deitada para telas largas e em pé para o celular — e só aparece onde tem a
 * arte certa: um banner só com arte de celular não é esticado numa faixa deitada.
 *
 * O giro é rolagem nativa com `scroll-snap`: o dedo arrasta de graça, o teclado
 * funciona, e o avanço automático só empurra a rolagem. O indicador lê a posição real
 * do trilho, então nunca diverge do que está na tela.
 *
 * `lateral`: conteúdo da coluna ao lado do banner, só no desktop (os produtos da
 * primeira tela). Sem ele, o banner segue de ponta a ponta como no tablet.
 */
export function Hero({ lateral, ...props }: StoreHero & { lateral?: React.ReactNode }) {
  const exibiveis = props.slides.filter((slide) => slide.image?.src || slide.imageMobile?.src);
  if (exibiveis.length === 0) return <HeroSemArte />;
  return <Carrossel {...props} slides={exibiveis} lateral={lateral} />;
}

/** Em que larguras o banner aparece: só onde ele tem a arte daquele formato. */
function visibilidade(slide: HeroSlide) {
  const noCelular = Boolean(slide.imageMobile?.src);
  const noDesktop = Boolean(slide.image?.src);
  return `${noCelular ? "block" : "hidden"} ${noDesktop ? "md:block" : "md:hidden"}`;
}

function Carrossel({ slides, lateral }: StoreHero & { lateral?: React.ReactNode }) {
  const emGrade = Boolean(lateral);
  const trilhoRef = useRef<HTMLDivElement>(null);
  // Texto, e não a lista: a lista chega nova a cada renderização, e depender dela
  // recriaria a medição (e o observador) o tempo todo.
  const primeiroId = slides[0].id;
  const [atualId, setAtualId] = useState(primeiroId);
  const [quantosVisiveis, setQuantosVisiveis] = useState(0);
  // Conteúdo que gira sozinho por mais de cinco segundos precisa de um jeito de parar
  // (WCAG 2.2.2). Não há botão de pausa: o próprio gesto para. Quem arrasta o banner com
  // o dedo ou toca num indicador assumiu o controle, e o giro automático não volta
  // (`pausadoPeloVisitante`). Mouse em cima ou foco dentro pausam só enquanto duram.
  const [pausadoPeloVisitante, setPausadoPeloVisitante] = useState(false);
  const [pausadoPorInteracao, setPausadoPorInteracao] = useState(false);
  const [semMovimento, setSemMovimento] = useState(false);

  const varios = quantosVisiveis > 1;
  const girando = varios && !semMovimento && !pausadoPeloVisitante && !pausadoPorInteracao;

  /** Banners exibidos na largura atual: os escondidos por CSS saem da conta. */
  const visiveis = useCallback(() => {
    const trilho = trilhoRef.current;
    if (!trilho) return [];
    return (Array.from(trilho.children) as HTMLElement[]).filter((el) => el.offsetParent !== null);
  }, []);

  const medir = useCallback(() => {
    const trilho = trilhoRef.current;
    const lista = visiveis();
    setQuantosVisiveis(lista.length);
    if (!trilho || lista.length === 0) return;
    const maisPerto = lista.reduce((melhor, el) =>
      Math.abs(el.offsetLeft - trilho.scrollLeft) < Math.abs(melhor.offsetLeft - trilho.scrollLeft)
        ? el
        : melhor,
    );
    setAtualId(maisPerto.dataset.id ?? primeiroId);
  }, [visiveis, primeiroId]);

  // Quem pediu menos movimento no sistema não recebe banner girando sozinho.
  useEffect(() => {
    const consulta = window.matchMedia("(prefers-reduced-motion: reduce)");
    const aplicar = () => setSemMovimento(consulta.matches);
    aplicar();
    consulta.addEventListener("change", aplicar);
    return () => consulta.removeEventListener("change", aplicar);
  }, []);

  // Primeira medição no primeiro quadro depois de montar; depois, a cada mudança de
  // tamanho — girar o celular ou redimensionar a janela muda quais banners existem.
  // Não dá para contar só com o aviso inicial do observador: ele se perde se o efeito
  // for refeito antes de chegar, e aí o carrossel ficaria sem indicadores e sem giro.
  useEffect(() => {
    const primeira = requestAnimationFrame(medir);
    const observador = new ResizeObserver(() => medir());
    if (trilhoRef.current) observador.observe(trilhoRef.current);
    return () => {
      cancelAnimationFrame(primeira);
      observador.disconnect();
    };
  }, [medir]);

  const irPara = useCallback(
    (alvo: HTMLElement) => {
      trilhoRef.current?.scrollTo({ left: alvo.offsetLeft, behavior: semMovimento ? "auto" : "smooth" });
    },
    [semMovimento],
  );

  useEffect(() => {
    if (!girando) return;
    const id = setInterval(() => {
      const lista = visiveis();
      const atual = lista.findIndex((el) => el.dataset.id === atualId);
      const proximo = lista[(atual + 1) % lista.length];
      if (proximo) irPara(proximo);
    }, INTERVALO_MS);
    return () => clearInterval(id);
  }, [girando, atualId, visiveis, irPara]);

  // Uma medição por quadro, no máximo: a rolagem dispara bem mais eventos que isso.
  const quadro = useRef<number | null>(null);
  const aoRolar = () => {
    if (quadro.current !== null) return;
    quadro.current = requestAnimationFrame(() => {
      quadro.current = null;
      medir();
    });
  };

  /** Um passo para o lado, dando a volta nas pontas. Quem usa as setas assumiu o controle. */
  const passo = (direcao: 1 | -1) => {
    const lista = visiveis();
    if (lista.length < 2) return;
    const atual = lista.findIndex((el) => el.dataset.id === atualId);
    const alvo = lista[(atual + direcao + lista.length) % lista.length];
    if (alvo) irPara(alvo);
    setPausadoPeloVisitante(true);
  };

  const tracos = (
    <ul className="flex items-center">
      {slides.map((slide, indice) => {
        const ativo = slide.id === atualId;
        return (
          <li key={slide.id} className={visibilidade(slide)}>
            <button
              type="button"
              onClick={() => {
                const alvo = visiveis().find((el) => el.dataset.id === slide.id);
                if (alvo) irPara(alvo);
                setPausadoPeloVisitante(true);
              }}
              aria-label={`Ir para o banner ${indice + 1}: ${slide.title}`}
              aria-current={ativo}
              className="focus-ring flex size-11 items-center justify-center rounded-full"
            >
              {/* Traço inteiro em rosé no atual; os demais, curtos e apagados.
                  A diferença de comprimento se lê sem depender da cor. */}
              <span
                aria-hidden
                className={`block h-0.5 w-7 origin-center rounded-full transition-[scale,background-color] duration-(--duracao-mola) ease-spring ${
                  ativo ? "scale-x-100 bg-accent" : "scale-x-[0.4] bg-muted-foreground/60"
                }`}
              />
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <section aria-label="Destaques da loja">
      {/*
        Celular e tablet: o banner de ponta a ponta. Desktop com produtos: banner e
        produtos lado a lado, na largura do conteúdo (as mesmas medidas do Container),
        para a primeira tela vender e não ser só uma imagem enorme.
      */}
      <div
        className={
          emGrade
            ? "lg:mx-auto lg:grid lg:w-full lg:max-w-6xl lg:grid-cols-12 lg:gap-6 lg:px-6 lg:pt-6 xl:max-w-7xl xl:px-10 2xl:max-w-[88rem]"
            : undefined
        }
      >
      <div
        role="region"
        aria-roledescription="carrossel"
        aria-label="Banners da loja"
        className={emGrade ? "w-full lg:col-span-8" : "w-full"}
        // Só mouse de verdade pausa ao passar por cima. No toque, o navegador dispara o
        // "entrar" e nunca o "sair", e o carrossel ficaria parado depois do 1º toque.
        onPointerEnter={(e) => e.pointerType === "mouse" && setPausadoPorInteracao(true)}
        onPointerLeave={(e) => e.pointerType === "mouse" && setPausadoPorInteracao(false)}
        onFocus={() => setPausadoPorInteracao(true)}
        onBlur={() => setPausadoPorInteracao(false)}
      >
        <div
          ref={trilhoRef}
          onScroll={aoRolar}
          onPointerDown={(e) => e.pointerType !== "mouse" && setPausadoPeloVisitante(true)}
          // `relative`: o trilho é a referência de posição dos banners. Sem isso o
          // `offsetLeft` de cada um incluiria a margem lateral, e o giro pararia torto.
          // Os cantos arredondados ficam aqui, na moldura, e não em cada arte: é o trilho
          // que recorta a área visível, então durante a troca as bordas continuam curvas.
          className="relative flex snap-x snap-mandatory overflow-x-auto rounded-2xl overscroll-x-contain [scrollbar-width:none] md:rounded-3xl [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((slide, indice) => (
            <Banner
              key={slide.id}
              slide={slide}
              posicao={indice + 1}
              total={slides.length}
              isFirstDesktop={indice === 0}
              prioritario={indice === 0}
              emGrade={emGrade}
            />
          ))}
        </div>
      </div>

      {emGrade && <div className="hidden lg:col-span-4 lg:grid lg:grid-rows-2 lg:gap-6">{lateral}</div>}
      </div>

      {varios && (
        <Container className="flex justify-center py-2 md:py-3 lg:hidden">{tracos}</Container>
      )}

      <InfoFaixa />

      {/* Desktop: controles e selos numa linha só, alinhada à coluna do conteúdo. */}
      <div className="hidden lg:block">
        <Container className="flex items-center justify-between gap-8 py-3">
          <div className="-ml-3 flex items-center">
            {varios && (
              <>
                <button type="button" onClick={() => passo(-1)} aria-label="Banner anterior" className={SETA}>
                  <ChevronLeftIcon className="size-5" />
                </button>
                {tracos}
                <button type="button" onClick={() => passo(1)} aria-label="Próximo banner" className={SETA}>
                  <ChevronRightIcon className="size-5" />
                </button>
              </>
            )}
          </div>
          <ul className="flex items-center gap-8 text-sm text-muted-foreground xl:gap-10">
            {INFO_FAIXA_ITENS.map(({ Icone, texto }) => (
              <li key={texto} className="flex items-center gap-2">
                <Icone className="size-5 text-accent" />
                <span>{texto}</span>
              </li>
            ))}
          </ul>
        </Container>
      </div>
    </section>
  );
}

const SETA =
  "pressionavel focus-ring inline-flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/5 hover:text-foreground";

const INFO_FAIXA_ITENS = [
  { Icone: PackageIcon, texto: "Entrega discreta" },
  { Icone: ChatIcon, texto: "Atendimento via WhatsApp" },
  { Icone: ShieldIcon, texto: "Pagamento seguro" },
];

/**
 * Selo de confiança logo abaixo do banner — só no desktop, onde a hero mais baixa
 * sobra altura que no celular não existe. No tablet fica sozinho; a partir de lg divide
 * a linha com os controles do carrossel. Sem caixa nem fundo próprio: só um
 * traço fino separando do banner, do mesmo jeito que o cabeçalho separa do conteúdo.
 */
function InfoFaixa() {
  return (
    <div className="hidden border-t border-border/60 md:block lg:hidden">
      <Container className="flex items-center justify-center gap-10 py-4 text-sm text-muted-foreground lg:gap-16">
        {INFO_FAIXA_ITENS.map(({ Icone, texto }) => (
          <div key={texto} className="flex items-center gap-2">
            <Icone className="size-5 text-accent" />
            <span>{texto}</span>
          </div>
        ))}
      </Container>
    </div>
  );
}

function Banner({
  slide,
  posicao,
  total,
  isFirstDesktop,
  prioritario,
  emGrade,
}: {
  slide: HeroSlide;
  posicao: number;
  total: number;
  isFirstDesktop: boolean;
  prioritario: boolean;
  emGrade: boolean;
}) {
  const arte = (
    <Arte slide={slide} prioritario={prioritario} isFirstDesktop={isFirstDesktop} emGrade={emGrade} />
  );

  return (
    <div
      data-id={slide.id}
      role="group"
      aria-roledescription="banner"
      aria-label={`${posicao} de ${total}: ${slide.title}`}
      className={`${visibilidade(slide)} relative w-full shrink-0 snap-start`}
    >
      {/* O título não aparece: a arte já traz a mensagem. Fica para leitor de tela. */}
      <h2 className="sr-only">{slide.title}</h2>
      {slide.actionHref ? (
        <Link
          href={slide.actionHref}
          aria-label={slide.actionLabel ? `${slide.actionLabel}: ${slide.title}` : slide.title}
          className="focus-ring block"
        >
          {arte}
        </Link>
      ) : (
        arte
      )}
    </div>
  );
}

/**
 * A arte na moldura certa. Celular: quadrado, um pouco mais baixo que a arte em pé (4:5),
 * para o banner não tomar a tela toda; o recorte leva só as sobras de cima e de baixo. Tablet: uma faixa baixa e larga
 * (16:5). Desktop com produtos ao lado: um quadro 16:10 com os quatro cantos arredondados,
 * perto da proporção da arte (16:9), então quase nada dela é cortado. A arte fica centrada
 * um pouco acima do meio, onde o designer pôs a marca.
 */
function Arte({
  slide,
  prioritario,
  isFirstDesktop,
  emGrade,
}: {
  slide: HeroSlide;
  prioritario: boolean;
  isFirstDesktop: boolean;
  emGrade: boolean;
}) {
  const alt = (slide.imageMobile ?? slide.image)?.alt ?? "";
  const sizes = emGrade ? "(min-width: 1024px) 64vw, 100vw" : "100vw";
  const comum = { alt, sizes, priority: prioritario, quality: 82 };

  // Com as duas artes, o `<picture>` faz o navegador baixar só a da largura atual.
  const desktop = slide.image?.src
    ? getImageProps({ ...comum, src: slide.image.src, width: 2560, height: 1440 }).props
    : null;
  const celular = slide.imageMobile?.src
    ? getImageProps({ ...comum, src: slide.imageMobile.src, width: 1080, height: 1350 }).props
    : null;
  const base = celular ?? desktop;
  if (!base) return null;

  const objectPosition = isFirstDesktop ? "50% 50%" : "50% 40%"; // Desktop: meio. Mobile: posição padrão.

  return (
    <div
      className={`relative aspect-square w-full overflow-hidden bg-muted md:aspect-[16/5] md:max-h-[78svh] ${
        emGrade ? "lg:aspect-[16/10] lg:max-h-none" : ""
      }`}
    >
      <picture>
        {desktop && celular && <source media={LARGURA_DESKTOP} srcSet={desktop.srcSet} sizes={sizes} />}
        {/* eslint-disable-next-line jsx-a11y/alt-text -- o alt vem em `base` */}
        <img
          {...base}
          className="absolute inset-0 size-full object-cover [object-position:var(--posicao)]"
          style={{ "--posicao": objectPosition } as React.CSSProperties}
        />
      </picture>
    </div>
  );
}

/**
 * Loja sem nenhum banner com arte: a marca ocupa a primeira tela sozinha, sobre a
 * superfície da paleta, com o logo grande o bastante para a assinatura "Por Karol
 * Basilio" ser lida. O contato fica com a bolha de WhatsApp, presente em toda página.
 */
function HeroSemArte() {
  return (
    <section aria-label="Apresentação da loja" className="bg-muted">
      <Container className="flex justify-center py-14 sm:py-20">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático */}
        <img src="/marca/logo-branco.svg" alt="" width={1160} height={831} className="h-auto w-[min(78vw,26rem)]" />
      </Container>
    </section>
  );
}
