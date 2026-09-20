"use client";

import Link from "next/link";
import { useState } from "react";
import { formatPrice } from "@/lib/format";
import type { CartItem } from "@/types/catalog";
import { ProductImage } from "./ProductImage";
import { QuantitySelector } from "./QuantitySelector";
import { WhatsAppButton } from "./WhatsAppButton";

type CartProps = {
  initialItems: CartItem[];
  continueShoppingHref: string;
};

export function Cart({ initialItems, continueShoppingHref }: CartProps) {
  const [items, setItems] = useState(initialItems);

  const subtotal = items.reduce((total, item) => total + item.unitPrice * item.quantity, 0);
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);

  function updateQuantity(id: string, quantity: number) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, quantity } : item)));
  }

  function removeItem(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-md border border-dashed border-border px-4 py-16 text-center">
        <p className="text-muted-foreground">Seu carrinho está vazio.</p>
        <Link
          href={continueShoppingHref}
          className="focus-ring rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Continuar comprando
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <ul className="flex flex-col divide-y divide-border border-y border-border">
        {items.map((item) => (
          <li key={item.id} className="flex gap-4 py-5">
            <ProductImage
              image={item.image}
              sizes="96px"
              className="w-20 shrink-0 rounded-md border border-border sm:w-24"
            />

            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link href={item.href} className="focus-ring font-medium hover:underline">
                    {item.name}
                  </Link>
                  {item.variantLabel && (
                    <p className="text-sm text-muted-foreground">{item.variantLabel}</p>
                  )}
                </div>
                <p className="shrink-0 font-medium">{formatPrice(item.unitPrice * item.quantity)}</p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <QuantitySelector
                  value={item.quantity}
                  onChange={(quantity) => updateQuantity(item.id, quantity)}
                  label={`Quantidade de ${item.name}`}
                />
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="focus-ring text-sm text-muted-foreground underline hover:text-foreground"
                >
                  Remover
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <aside className="flex h-fit flex-col gap-4 rounded-md border border-border p-5">
        <h2 className="font-semibold">Resumo</h2>
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">
              {itemCount} {itemCount === 1 ? "item" : "itens"}
            </dt>
            <dd className="font-medium">{formatPrice(subtotal)}</dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          Valores, entrega e pagamento serão combinados na conversa.
        </p>
        <WhatsAppButton label="Enviar pedido pelo WhatsApp" />
        <Link
          href={continueShoppingHref}
          className="focus-ring text-center text-sm text-muted-foreground underline hover:text-foreground"
        >
          Continuar comprando
        </Link>
      </aside>
    </div>
  );
}
