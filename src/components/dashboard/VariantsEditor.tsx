"use client";

import { useActionState, useEffect, useState } from "react";
import { formatPrice } from "@/lib/format";
import { deleteVariantAction, saveVariantAction } from "@/modules/catalog/actions";
import { IDLE_ACTION_STATE } from "@/modules/catalog/errors";
import type { AdminVariant } from "@/types/dashboard";
import { ConfirmDialog } from "./ConfirmDialog";
import { DataTable, type Column } from "./DataTable";
import { Badge } from "./StatusBadge";
import { PlusIcon } from "./icons";
import { Field, ToggleField, buttonClass, inputClass } from "./ui";

const optionsToText = (options: Record<string, string>) =>
  Object.entries(options)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

function VariantForm({
  productId,
  variant,
  position,
  onDone,
}: {
  productId: string;
  variant?: AdminVariant;
  position: number;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveVariantAction, IDLE_ACTION_STATE);
  const errors = state.fieldErrors ?? {};

  // Fecha o formulário só depois que a ação confirma a gravação.
  useEffect(() => {
    if (state.status === "success") onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-md border border-border p-4">
      <input type="hidden" name="productId" value={productId} />
      {variant && <input type="hidden" name="variantId" value={variant.id} />}
      <input type="hidden" name="position" value={position} />

      {state.status === "error" && state.message && (
        <p role="alert" className="rounded-md border border-border bg-muted px-3 py-2 text-sm">
          {state.message}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome da variante" htmlFor={`variant-name-${variant?.id ?? "nova"}`}>
          <input
            id={`variant-name-${variant?.id ?? "nova"}`}
            name="name"
            required
            defaultValue={variant?.name}
            placeholder="Tamanho M"
            className={inputClass}
          />
          {errors.name && <p className="text-xs">{errors.name}</p>}
        </Field>

        <Field label="SKU" htmlFor={`variant-sku-${variant?.id ?? "nova"}`} hint="Opcional, único na loja.">
          <input id={`variant-sku-${variant?.id ?? "nova"}`} name="sku" defaultValue={variant?.sku ?? ""} className={inputClass} />
        </Field>

        <Field label="Preço" htmlFor={`variant-price-${variant?.id ?? "nova"}`} hint="Vazio usa o preço do produto.">
          <input
            id={`variant-price-${variant?.id ?? "nova"}`}
            name="price"
            type="number"
            min="0.01"
            step="0.01"
            defaultValue={variant?.priceCents === null || variant === undefined ? "" : (variant.priceCents / 100).toFixed(2)}
            className={inputClass}
          />
          {errors.price && <p className="text-xs">{errors.price}</p>}
        </Field>

        <Field label="Estoque" htmlFor={`variant-stock-${variant?.id ?? "nova"}`}>
          <input
            id={`variant-stock-${variant?.id ?? "nova"}`}
            name="stock"
            type="number"
            min="0"
            step="1"
            defaultValue={variant?.stock ?? 0}
            className={inputClass}
          />
          {errors.stock && <p className="text-xs">{errors.stock}</p>}
        </Field>
      </div>

      <Field
        label="Opções"
        htmlFor={`variant-options-${variant?.id ?? "nova"}`}
        hint='Uma por linha, no formato "Chave: Valor". Ex.: Tamanho: M'
      >
        <textarea
          id={`variant-options-${variant?.id ?? "nova"}`}
          name="options"
          rows={3}
          defaultValue={variant ? optionsToText(variant.options) : ""}
          className={inputClass}
        />
        {errors.options && <p className="text-xs">{errors.options}</p>}
      </Field>

      <ToggleField name="active" label="Variante ativa" defaultChecked={variant?.active ?? true} />

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className={buttonClass("ghost")}>
          Cancelar
        </button>
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? "Salvando…" : "Salvar variante"}
        </button>
      </div>
    </form>
  );
}

/**
 * Variantes do produto. Genérico de propósito: o par chave/valor em `options` não impõe
 * nenhum vocabulário — a loja decide se usa tamanho, cor, volume ou outra coisa.
 */
export function VariantsEditor({
  productId,
  variants,
  canDelete,
}: {
  productId: string;
  variants: AdminVariant[];
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AdminVariant | null>(null);

  const columns: Column<AdminVariant>[] = [
    { key: "name", header: "Variante", cell: (variant) => <span className="font-medium">{variant.name}</span> },
    {
      key: "options",
      header: "Opções",
      secondary: true,
      cell: (variant) => (
        <span className="text-muted-foreground">
          {Object.entries(variant.options).map(([key, value]) => `${key}: ${value}`).join(" · ") || "—"}
        </span>
      ),
    },
    { key: "sku", header: "SKU", secondary: true, cell: (variant) => <span className="text-muted-foreground">{variant.sku ?? "—"}</span> },
    {
      key: "price",
      header: "Preço",
      align: "right",
      cell: (variant) => (
        <span className="tabular-nums text-muted-foreground">
          {variant.priceCents === null ? "Usa o preço base" : formatPrice(variant.priceCents)}
        </span>
      ),
    },
    { key: "stock", header: "Estoque", align: "right", cell: (variant) => <span className="tabular-nums">{variant.stock}</span> },
    {
      key: "active",
      header: "Status",
      cell: (variant) => <Badge tone={variant.active ? "outline" : "muted"}>{variant.active ? "Ativa" : "Inativa"}</Badge>,
    },
    {
      key: "actions",
      header: <span className="sr-only">Ações</span>,
      align: "right",
      cell: (variant) => (
        <div className="flex justify-end gap-1">
          <button type="button" onClick={() => setEditing(variant.id)} className={buttonClass("ghost")}>
            Editar
          </button>
          {canDelete && (
            <button type="button" onClick={() => setPendingDelete(variant)} className={buttonClass("ghost")}>
              Excluir
            </button>
          )}
        </div>
      ),
    },
  ];

  const editingVariant = variants.find((variant) => variant.id === editing);

  return (
    <div className="flex flex-col gap-4">
      <DataTable
        columns={columns}
        rows={variants}
        getRowKey={(variant) => variant.id}
        caption="Variantes do produto"
        empty={
          <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Produto simples: preço e estoque vêm dos campos do produto. Adicione variantes
            apenas se houver combinações.
          </p>
        }
      />

      {editingVariant && (
        <VariantForm
          productId={productId}
          variant={editingVariant}
          position={variants.findIndex((variant) => variant.id === editingVariant.id)}
          onDone={() => setEditing(null)}
        />
      )}

      {creating ? (
        <VariantForm productId={productId} position={variants.length} onDone={() => setCreating(false)} />
      ) : (
        <div>
          <button type="button" onClick={() => setCreating(true)} className={buttonClass("outline")}>
            <PlusIcon />
            Adicionar variante
          </button>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Excluir variante"
        description={pendingDelete ? `“${pendingDelete.name}” será removida do produto.` : undefined}
        confirmLabel="Excluir"
        onConfirm={() => {
          const variant = pendingDelete;
          setPendingDelete(null);
          if (!variant) return;

          const formData = new FormData();
          formData.set("variantId", variant.id);
          formData.set("productId", productId);
          void deleteVariantAction(formData);
        }}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
