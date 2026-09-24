"use client";

import { useParams, usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { formatPrice } from "@/lib/format";
import { storefrontPaths } from "@/lib/storefront-paths";
import { buildWhatsAppUrl } from "@/modules/storefront/whatsapp";
import type { VariantGroup } from "@/types/catalog";
import { AddToWishlistButton } from "./AddToWishlistButton";
import { ProductVariants } from "./ProductVariants";
import { PurchaseBar } from "./PurchaseBar";
import { QuantitySelector } from "./QuantitySelector";
import { WhatsAppButton } from "./WhatsAppButton";

type ProductInfoProps = {
  /** Slug da loja deste deploy (chave da lista de interesse no navegador). */
  storeSlug: string;
  name: string;
  shortDescription: string;
  price: number;
  promotionalPrice?: number;
  available: boolean;
  badge?: string;
  variants: VariantGroup[];
  /** Número de WhatsApp da loja (`store_settings.whatsapp_number`). */
  whatsappNumber?: string | null;
  /** Modelo de mensagem da loja (`store_settings.whatsapp_message_template`). */
  whatsappMessageTemplate?: string | null;
  /** Caminho da página deste produto. Na rota de produto o padrão já é o correto. */
  productHref?: string;
  /**
   * Selos curtos da loja (discrição, entrega, atendimento), os mesmos da faixa abaixo da
   * hero. Só aparecem quando a loja os cadastrou: a vitrine não inventa promessa.
   */
  highlights?: string[];
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

export function ProductInfo({
  storeSlug,
  name,
  shortDescription,
  price,
  promotionalPrice,
  available,
  badge,
  variants,
  whatsappNumber,
  whatsappMessageTemplate,
  productHref,
  highlights,
}: ProductInfoProps) {
  const compraRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const pathname = usePathname();
  // A lista de interesse guarda identificadores: a loja vem do servidor (loja do deploy),
  // o produto sai da própria rota.
  const params = useParams<{ product: string }>();

  const hasPromotion = promotionalPrice !== undefined;
  const currentPrice = promotionalPrice ?? price;
  const discount = hasPromotion ? Math.round((1 - currentPrice / price) * 100) : 0;

  // "Tamanho M · Cor Preto": mesma grafia que o carrinho usa, na ordem em que os
  // grupos aparecem na tela. Grupo ainda não escolhido simplesmente não entra.
  const variantLabel = variants
    .filter((group) => selected[group.name])
    .map((group) => `${group.name} ${selected[group.name]}`)
    .join(" · ");

  const whatsappUrl = whatsappNumber
    ? buildWhatsAppUrl({
        phone: whatsappNumber,
        template: whatsappMessageTemplate,
        items: [
          {
            name,
            quantity,
            unitPriceCents: currentPrice,
            variantLabel: variantLabel || null,
            url: toAbsoluteUrl(productHref ?? pathname),
          },
        ],
      })
    : null;

  const disabledReason = !available
    ? "Produto indisponível no momento."
    : !whatsappUrl
      ? "O WhatsApp desta loja ainda não foi configurado."
      : null;

  const precoAtual = formatPrice(currentPrice);

  return (
    <div className="flex w-full max-w-md flex-col gap-8 lg:max-w-[28rem] lg:pt-2">
      {/*
        Primeira dobra da página: nome e preço entram juntos, escalonados (o único
        movimento de entrada daqui). Preço não se anima depois disso: muda na hora.
      */}
      <div className="flex flex-col gap-4">
        {badge && (
          <span className="entrada w-fit rounded-full bg-primary px-3 py-1 text-xs font-medium tracking-[0.01em] text-primary-foreground">
            {badge}
          </span>
        )}
        <h1 className="entrada font-display text-[length:var(--texto-titulo-2)] leading-[1.15] font-normal tracking-[-0.01em] text-balance">
          {name}
        </h1>

        <div className="entrada flex flex-col gap-1.5 [--ordem:1]">
          {/*
            O preço vigente é o destaque; o anterior e o desconto ficam discretos, ao
            lado. Os rótulos escondidos dão sentido aos números para o leitor de tela.
          */}
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-xl leading-tight font-semibold tabular-nums">
              {hasPromotion && <span className="sr-only">Preço atual: </span>}
              {precoAtual}
            </span>
            {hasPromotion && (
              <>
                <s className="text-sm text-muted-foreground tabular-nums">
                  <span className="sr-only">Preço anterior: </span>
                  {formatPrice(price)}
                </s>
                <span className="text-sm text-muted-foreground">{discount}% de desconto</span>
              </>
            )}
          </p>
          <p className={`text-sm ${available ? "text-muted-foreground" : "font-medium text-foreground"}`}>
            {available ? "Disponível" : "Indisponível no momento"}
          </p>
        </div>

        {shortDescription && (
          <p className="max-w-[60ch] text-base leading-[1.55] text-pretty text-muted-foreground">
            {shortDescription}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-6">
          <ProductVariants
            groups={variants}
            selected={selected}
            onChange={(groupName, value) =>
              setSelected((current) => ({ ...current, [groupName]: value }))
            }
          />

          <div className="flex flex-col items-start gap-3">
            <span className="text-sm font-medium">Quantidade</span>
            <QuantitySelector value={quantity} onChange={setQuantity} />
          </div>
      </div>

      {/*
              Um só botão cheio: o WhatsApp é a compra. "Adicionar ao carrinho" é a alternativa,
              vazada, logo abaixo. Empilhados e com a largura da coluna em qualquer tela.
            */}
      <div className="flex flex-col gap-3">
        <div ref={compraRef}>
          <WhatsAppButton href={whatsappUrl} disabledReason={disabledReason} />
        </div>
        <AddToWishlistButton
          storeSlug={storeSlug}
          productSlug={params.product}
          productName={name}
          variants={variants}
          selected={selected}
          quantity={quantity}
          available={available}
          wishlistHref={storefrontPaths().cart}
        />
      </div>

      {highlights && highlights.length > 0 && (
        <ul className="flex flex-col gap-2 border-t border-border pt-5 text-sm text-muted-foreground">
          {highlights.map((highlight) => (
            <li key={highlight}>{highlight}</li>
          ))}
        </ul>
      )}

      <PurchaseBar
        alvo={compraRef}
        href={disabledReason ? null : whatsappUrl}
        preco={precoAtual}
        legenda={variantLabel || name}
      />
    </div>
  );
}
