"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/format";
import type { VariantGroup } from "@/types/catalog";
import { ProductVariants } from "./ProductVariants";
import { QuantitySelector } from "./QuantitySelector";
import { WhatsAppButton } from "./WhatsAppButton";

type ProductInfoProps = {
  name: string;
  shortDescription: string;
  price: number;
  promotionalPrice?: number;
  available: boolean;
  badge?: string;
  variants: VariantGroup[];
};

export function ProductInfo({
  name,
  shortDescription,
  price,
  promotionalPrice,
  available,
  badge,
  variants,
}: ProductInfoProps) {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);

  const hasPromotion = promotionalPrice !== undefined;
  const currentPrice = promotionalPrice ?? price;
  const discount = hasPromotion ? Math.round((1 - currentPrice / price) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {badge && (
          <span className="w-fit rounded-sm bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
            {badge}
          </span>
        )}
        <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">{name}</h1>

        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-2xl font-semibold">{formatPrice(currentPrice)}</span>
          {hasPromotion && (
            <>
              <s className="text-muted-foreground">{formatPrice(price)}</s>
              <span className="text-sm text-muted-foreground">{discount}% de desconto</span>
            </>
          )}
        </p>

        <p className="text-muted-foreground">{shortDescription}</p>
      </div>

      <ProductVariants
        groups={variants}
        selected={selected}
        onChange={(groupName, value) =>
          setSelected((current) => ({ ...current, [groupName]: value }))
        }
      />

      <div className="flex flex-col items-start gap-2">
        <span className="text-sm font-medium">Quantidade</span>
        <QuantitySelector value={quantity} onChange={setQuantity} />
      </div>

      <p className="flex items-center gap-2 text-sm">
        <span
          aria-hidden="true"
          className={`size-2 rounded-full ${available ? "bg-foreground" : "bg-muted-foreground"}`}
        />
        {available ? "Disponível" : "Indisponível no momento"}
      </p>

      <WhatsAppButton disabled={!available} />
    </div>
  );
}
