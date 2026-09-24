"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/format";
import { wishlistItemKey, type WishlistEntry } from "@/modules/storefront/wishlist";
import { resolveWishlist } from "@/modules/storefront/wishlist-actions";
import type {
  RemovedWishlistItem,
  ResolvedWishlistItem,
} from "@/modules/storefront/wishlist-resolve";
import { buildWhatsAppUrl } from "@/modules/storefront/whatsapp";
import { ProductImage } from "./ProductImage";
import { QuantitySelector } from "./QuantitySelector";
import { useWishlist } from "./useWishlist";
import { WhatsAppButton } from "./WhatsAppButton";

type CartProps = {
  storeSlug: string;
  continueShoppingHref: string;
  /** Número de WhatsApp da loja (`store_settings.whatsapp_number`). */
  whatsappNumber?: string | null;
  /** Modelo de mensagem da loja (`store_settings.whatsapp_message_template`). */
  whatsappMessageTemplate?: string | null;
};

/**
 * Caminho vira endereço público. É esse link que faz o WhatsApp exibir o cartão de
 * prévia do produto, montado a partir das meta tags da página.
 *
 * Em desenvolvimento a variável costuma estar vazia: aí segue o caminho relativo, que
 * não gera prévia mas preserva a informação na mensagem — e, principalmente, não
 * derruba a página.
 */
function toAbsoluteUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");

  return base ? `${base}${path}` : path;
}

function removalNotice(item: RemovedWishlistItem) {
  if (item.reason === "variant" && item.name) {
    return `${item.name} saiu da sua lista: a opção escolhida não está mais disponível. Escolha outra na página do produto.`;
  }
  return "Um item saiu da sua lista porque não está mais à venda.";
}

type LoadError = { payload: string };

/** Tempo da saída de um item removido: o mesmo `--duracao-estado` do CSS (220ms). */
const SAIDA_MS = 220;

// Botões da direção visual usados aqui (DESIGN-permitaseprazer.md, seção 6).
const botaoVinho =
  "pressionavel focus-ring inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-7 text-[0.9375rem] leading-none font-medium whitespace-nowrap text-primary-foreground hover:bg-primary-hover sm:w-auto";
const botaoVazado =
  "pressionavel focus-ring inline-flex min-h-12 shrink-0 items-center justify-center rounded-full border border-control-border px-7 text-[0.9375rem] leading-none font-medium whitespace-nowrap text-foreground hover:border-foreground hover:bg-foreground/5";
const linkDeTexto =
  "focus-ring inline-flex min-h-11 items-center rounded-sm underline decoration-control-border underline-offset-4 transition-[text-decoration-color,color] duration-(--duracao-estado) hover:decoration-accent";

/**
 * Página da lista de interesse.
 *
 * O navegador guarda só identificadores (ver wishlist.ts). Nome, preço, disponibilidade
 * e link vêm da Server Action `resolveWishlist`, lidos AGORA do catálogo publicado: é
 * isso que vai para a tela e para a mensagem do WhatsApp — nunca um preço guardado.
 *
 * Só os itens ainda não resolvidos nesta visita são consultados: mudar quantidade ou
 * remover não refaz a leitura. Item que deixou de estar publicado, ou cuja variante
 * sumiu, sai da lista com um aviso.
 */
export function Cart({
  storeSlug,
  continueShoppingHref,
  whatsappNumber,
  whatsappMessageTemplate,
}: CartProps) {
  const wishlist = useWishlist(storeSlug);
  const [resolved, setResolved] = useState<ReadonlyMap<string, ResolvedWishlistItem>>(
    () => new Map(),
  );
  const [notices, setNotices] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Itens em saída: somem com um movimento curto e só então deixam a lista. Enquanto
  // saem, não recebem toque de novo (nada de remover duas vezes).
  const [saindo, setSaindo] = useState<ReadonlySet<string>>(() => new Set());
  const [anuncio, setAnuncio] = useState("");
  const listaRef = useRef<HTMLUListElement>(null);
  const vazioRef = useRef<HTMLHeadingElement>(null);
  const temporizadores = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pendentes = temporizadores.current;
    return () => pendentes.forEach(clearTimeout);
  }, []);

  function removerItem(key: string, name: string) {
    if (saindo.has(key)) return;

    // A regra é a mesma de antes (`wishlist.remove`); só o momento espera a saída.
    const concluir = () => {
      wishlist.remove(key);
      setSaindo((atual) => {
        const proximo = new Set(atual);
        proximo.delete(key);
        return proximo;
      });
      setAnuncio(`${name} saiu da sua lista.`);
      // O botão tocado deixou de existir: o foco vai para a lista (ou, se ela esvaziou,
      // para o aviso de lista vazia), e não volta ao topo da página. Espera a tela
      // refletir a remoção antes de procurar para onde ir.
      setTimeout(() => {
        (listaRef.current ?? vazioRef.current)?.focus({ preventScroll: true });
      }, 0);
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      concluir();
      return;
    }
    setSaindo((atual) => new Set(atual).add(key));
    const id = setTimeout(() => {
      temporizadores.current.delete(id);
      concluir();
    }, SAIDA_MS);
    temporizadores.current.add(id);
  }

  const entries = wishlist.items.map((entry) => ({ entry, key: wishlistItemKey(entry) }));
  const pending = entries.filter(({ key }) => !resolved.has(key)).map(({ entry }) => entry);

  // Texto estável do que falta resolver: é a dependência do efeito, para que só uma
  // mudança real no conjunto de itens pendentes dispare uma nova leitura.
  const pendingPayload = pending.length > 0 ? JSON.stringify(pending) : "";
  const failed = loadError !== null && loadError.payload === pendingPayload;

  useEffect(() => {
    if (!wishlist.ready || !pendingPayload) return;

    let cancelled = false;
    const items = JSON.parse(pendingPayload) as WishlistEntry[];

    // A loja é a do deploy, decidida no servidor; o navegador só manda os itens.
    resolveWishlist(items)
      .then((result) => {
        if (cancelled) return;

        if (!result.ok) {
          setLoadError({ payload: pendingPayload });
          return;
        }

        setLoadError(null);
        setResolved((current) => {
          const next = new Map(current);
          for (const item of result.items) next.set(item.key, item);
          return next;
        });

        if (result.removed.length > 0) {
          wishlist.remove(result.removed.map((item) => item.key));
          setNotices((current) => [...current, ...result.removed.map(removalNotice)]);
        }
      })
      .catch(() => {
        // Rede fora, servidor fora do ar: mesma saída do erro de leitura.
        if (!cancelled) setLoadError({ payload: pendingPayload });
      });

    return () => {
      cancelled = true;
    };
    // `wishlist.remove` é estável por loja; `attempt` força a nova tentativa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wishlist.ready, pendingPayload, storeSlug, attempt]);

  const loading = !wishlist.ready || (pending.length > 0 && !failed);

  const rows = entries.flatMap(({ entry, key }) => {
    const item = resolved.get(key);
    return item ? [{ ...item, quantity: entry.quantity }] : [];
  });

  const sendable = rows.filter((row) => row.available);
  const subtotal = sendable.reduce((total, row) => total + row.unitPrice * row.quantity, 0);
  const itemCount = sendable.reduce((total, row) => total + row.quantity, 0);
  const hasUnavailable = rows.length > sendable.length;

  // A lista inteira vai na mensagem, com os preços que acabaram de vir do banco. O link
  // de cada item acompanha a linha: o WhatsApp monta a prévia a partir dele.
  const whatsappUrl =
    whatsappNumber && sendable.length > 0
      ? buildWhatsAppUrl({
          phone: whatsappNumber,
          template: whatsappMessageTemplate,
          items: sendable.map((row) => ({
            name: row.name,
            quantity: row.quantity,
            unitPriceCents: row.unitPrice,
            variantLabel: row.variantLabel ?? null,
            url: toAbsoluteUrl(row.href),
          })),
        })
      : null;

  const disabledReason = loading
    ? "Atualizando os preços da sua lista…"
    : failed
      ? "Não foi possível conferir os preços atuais."
      : sendable.length === 0
        ? "Nenhum item da lista está disponível no momento."
        : !whatsappNumber || !whatsappUrl
          ? "O WhatsApp desta loja ainda não foi configurado."
          : null;

  const noticeRegion = (
    <div role="status" aria-live="polite">
      {notices.length > 0 && (
        <div className="flex items-start justify-between gap-3 rounded-md bg-muted px-4 py-3 text-sm text-pretty">
          <ul className="flex flex-col gap-1 py-2">
            {notices.map((notice, index) => (
              <li key={index}>{notice}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setNotices([])}
            className={`${linkDeTexto} -my-1 min-w-11 shrink-0 justify-center px-2 text-foreground`}
          >
            Fechar
          </button>
        </div>
      )}
    </div>
  );

  // Anúncio da remoção para o leitor de tela: a linha some da lista sem dizer nada.
  const removalRegion = (
    <p role="status" aria-live="polite" className="sr-only">
      {anuncio}
    </p>
  );

  if (wishlist.ready && entries.length === 0) {
    // Estado vazio da direção visual: o que aconteceu, o que fazer, uma ação só.
    return (
      <div className="flex flex-col gap-6">
        {noticeRegion}
        {removalRegion}
        <div className="flex max-w-[44ch] flex-col items-start gap-5 border-t border-border pt-8">
          <h2
                      ref={vazioRef}
                      tabIndex={-1}
                      className="font-display text-[length:var(--texto-titulo-2)] leading-[1.15] font-normal tracking-[-0.01em] text-balance outline-none"
                    >
                      Carrinho está vazio.
          </h2>
          <p className="text-base leading-[1.55] text-pretty text-muted-foreground">
                      Na página de cada produto, toque em “Adicionar ao carrinho” para juntar o que você quer
                      e enviar tudo de uma vez pelo WhatsApp.
                    </p>
          <Link href={continueShoppingHref} className={`${botaoVinho} mt-3`}>
            Ver produtos
          </Link>
        </div>
      </div>
    );
  }

  // Esqueleto: uma linha por item conhecido (duas antes de ler o navegador), com a
  // mesma altura das linhas reais, para a página não pular quando os dados chegarem.
  // Parado de propósito: nada fica em laço na vitrine.
  const skeletonCount = wishlist.ready ? pending.length : 2;

  return (
    <div className="flex flex-col gap-6">
      {noticeRegion}
      {removalRegion}

      {failed && (
        // Erro aparece na hora, sem animação.
        <div
          role="alert"
          className="flex flex-col gap-4 rounded-md bg-muted px-4 py-4 text-sm text-pretty sm:flex-row sm:items-center sm:justify-between"
        >
          <p>Não foi possível carregar os preços atualizados da sua lista.</p>
          <button
            type="button"
            onClick={() => {
              setLoadError(null);
              setAttempt((current) => current + 1);
            }}
            className={botaoVazado}
          >
            Tentar de novo
          </button>
        </div>
      )}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-16">
        <ul
          ref={listaRef}
          tabIndex={-1}
          aria-busy={loading}
          aria-label="Itens da lista"
          className="flex min-w-0 flex-col divide-y divide-border border-t border-border outline-none"
        >
          {rows.map((row) => {
            const saindoAgora = saindo.has(row.key);
            return (
              <li
                key={row.key}
                // Remoção contida: a linha recua um pouco e se apaga pela curva de saída;
                // só depois deixa a lista. Sem movimento pedido, sai na hora.
                className={`flex gap-4 py-5 transition-[translate,opacity] duration-(--duracao-estado) ease-(--ease-saida) sm:gap-5 ${
                  saindoAgora ? "pointer-events-none -translate-x-3 opacity-0" : ""
                }`}
              >
                {/* A foto repete o link do nome: fica fora do foco e do leitor de tela. */}
                <Link href={row.href} tabIndex={-1} aria-hidden className="block w-20 shrink-0 sm:w-24">
                  <ProductImage
                    image={row.image}
                    sizes="(min-width: 640px) 96px, 80px"
                    className="aspect-[2/3] w-full rounded-md"
                  />
                </Link>

                <div className="flex min-w-0 flex-1 flex-col justify-between gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-col gap-1">
                      <Link
                        href={row.href}
                        className="focus-ring rounded-sm text-base leading-snug font-medium break-words text-foreground underline decoration-transparent underline-offset-4 transition-[text-decoration-color] duration-(--duracao-estado) hover:decoration-accent"
                      >
                        {row.name}
                      </Link>
                      {row.variantLabel && (
                        <p className="text-sm text-muted-foreground">{row.variantLabel}</p>
                      )}
                      {!row.available && (
                        <p className="text-sm font-medium text-foreground">Indisponível no momento</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-base font-semibold tabular-nums">
                        {formatPrice(row.unitPrice * row.quantity)}
                      </p>
                      {row.quantity > 1 && (
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {formatPrice(row.unitPrice)} cada
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                    <QuantitySelector
                      value={row.quantity}
                      onChange={(quantity) => wishlist.setQuantity(row.key, quantity)}
                      label={`Quantidade de ${row.name}`}
                    />
                    <button
                      type="button"
                      onClick={() => removerItem(row.key, row.name)}
                      aria-label={`Remover ${row.name} da lista`}
                      className={`${linkDeTexto} px-1 text-sm text-muted-foreground hover:text-foreground`}
                    >
                      Remover
                    </button>
                  </div>
                </div>
              </li>
            );
          })}

          {!failed &&
            Array.from({ length: skeletonCount }, (_, index) => (
              <li key={`carregando-${index}`} aria-hidden="true" className="flex gap-4 py-5 sm:gap-5">
                <div className="aspect-[2/3] w-20 shrink-0 rounded-md bg-muted sm:w-24" />
                <div className="flex min-w-0 flex-1 flex-col justify-between gap-4">
                  <div className="flex flex-col gap-2">
                    <div className="h-5 w-2/3 rounded-sm bg-muted" />
                    <div className="h-4 w-1/3 rounded-sm bg-muted" />
                  </div>
                  <div className="h-12 w-32 rounded-full bg-muted" />
                </div>
              </li>
            ))}
        </ul>

        {/*
          Resumo: a única superfície elevada da página (card sobre o fundo). No desktop
          fica preso ao lado da lista enquanto ela rola.
        */}
        <aside
          aria-labelledby="resumo-da-lista"
          className="flex flex-col gap-5 rounded-card bg-card p-5 sm:p-6 lg:sticky lg:top-24"
        >
          <h2
            id="resumo-da-lista"
            className="font-display text-[length:var(--texto-titulo-2)] leading-[1.15] font-normal tracking-[-0.01em]"
          >
            Resumo
          </h2>
          <dl className="flex items-baseline justify-between gap-4">
            <dt className="text-sm text-muted-foreground">
              {loading ? "Calculando…" : `${itemCount} ${itemCount === 1 ? "item" : "itens"}`}
            </dt>
            <dd className="text-lg leading-tight font-semibold tabular-nums">
              {loading ? (
                // Reserva o lugar do total para ele não empurrar nada ao chegar.
                <span aria-hidden className="inline-block h-5 w-24 rounded-sm bg-muted align-middle" />
              ) : (
                formatPrice(subtotal)
              )}
            </dd>
          </dl>
          <div className="flex flex-col gap-1.5 text-sm text-pretty text-muted-foreground">
            {hasUnavailable && <p>Itens indisponíveis ficam na lista, mas não entram na mensagem.</p>}
            <p>Valores, entrega e pagamento serão combinados na conversa.</p>
          </div>
          <WhatsAppButton
            label="Enviar lista pelo WhatsApp"
            href={whatsappUrl}
            disabledReason={disabledReason}
          />
          <Link
            href={continueShoppingHref}
            className={`${linkDeTexto} justify-center self-center text-sm text-muted-foreground hover:text-foreground`}
          >
            Continuar vendo produtos
          </Link>
        </aside>
      </div>
    </div>
  );
}
