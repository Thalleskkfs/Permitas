"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { createProductAction, updateProductAction } from "@/modules/catalog/actions";
import { IDLE_ACTION_STATE } from "@/modules/catalog/errors";
import type { AdminCategoryNode, AdminCollection, AdminProduct, AdminTag } from "@/types/dashboard";
import { FormSection } from "./FormSection";
import { ImageUploader } from "./ImageUploader";
import { Field, ToggleField, buttonClass, inputClass } from "./ui";

const STATUS_OPTIONS = [
  { value: "draft", label: "Rascunho" },
  { value: "published", label: "Publicado" },
  { value: "archived", label: "Arquivado" },
];

const toCurrencyInput = (cents: number | null) => (cents === null ? "" : (cents / 100).toFixed(2));

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-foreground">{message}</p>;
}

function CheckboxGroup({
  legend,
  name,
  options,
  selected,
}: {
  legend: string;
  name: string;
  options: { id: string; label: string }[];
  selected: string[];
}) {
  if (options.length === 0) {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{legend}</p>
        <p className="text-sm text-muted-foreground">Nenhuma opção cadastrada ainda.</p>
      </div>
    );
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option.id} className="relative">
            <input
              type="checkbox"
              name={name}
              value={option.id}
              defaultChecked={selected.includes(option.id)}
              className="peer sr-only"
            />
            <span className="flex cursor-pointer items-center rounded-md border border-border px-3 py-1.5 text-sm hover:border-foreground peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Formulário do produto, ligado às Server Actions.
 *
 * O formulário não envia store_id: a loja vem da membership autenticada no servidor.
 * As variantes têm editor próprio, fora deste formulário, porque exigem um produto já
 * criado e formulários não podem ser aninhados.
 */
export function ProductForm({
  product,
  categories,
  tags,
  collections,
}: {
  product?: AdminProduct;
  categories: AdminCategoryNode[];
  tags: AdminTag[];
  collections: AdminCollection[];
}) {
  const ids = useId();
  const [state, formAction, pending] = useActionState(
    product ? updateProductAction : createProductAction,
    IDLE_ACTION_STATE,
  );
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {product && <input type="hidden" name="productId" value={product.id} />}

      {state.status !== "idle" && state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className="rounded-md border border-border bg-muted px-3 py-2 text-sm"
        >
          {state.message}
        </p>
      )}

      <FormSection title="Informações" description="Nome, identificação e como o produto é descrito na loja.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Nome" htmlFor={`${ids}-name`} className="sm:col-span-2">
            <input
              id={`${ids}-name`}
              name="name"
              required
              defaultValue={product?.name}
              placeholder="Camiseta básica"
              className={inputClass}
            />
            <FieldError message={errors.name} />
          </Field>

          <Field label="SKU" htmlFor={`${ids}-sku`} hint="Opcional. Único dentro da loja.">
            <input id={`${ids}-sku`} name="sku" defaultValue={product?.sku ?? ""} placeholder="EX-001" className={inputClass} />
            <FieldError message={errors.sku} />
          </Field>

          <Field label="Categoria" htmlFor={`${ids}-category`}>
            <select
              id={`${ids}-category`}
              name="categoryId"
              defaultValue={product?.categoryId ?? ""}
              className={inputClass}
            >
              <option value="">Sem categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {"— ".repeat(category.depth)}
                  {category.name}
                </option>
              ))}
            </select>
            <FieldError message={errors.categoryId} />
          </Field>
        </div>

        <Field label="Descrição curta" htmlFor={`${ids}-short`} hint="Aparece na listagem e no topo da página do produto.">
          <textarea id={`${ids}-short`} name="shortDescription" rows={2} defaultValue={product?.shortDescription} className={inputClass} />
        </Field>

        <Field label="Descrição completa" htmlFor={`${ids}-description`}>
          <textarea id={`${ids}-description`} name="description" rows={6} defaultValue={product?.description} className={inputClass} />
        </Field>

        <CheckboxGroup
          legend="Tags"
          name="tagIds"
          options={tags.map((tag) => ({ id: tag.id, label: tag.name }))}
          selected={product?.tagIds ?? []}
        />

        <CheckboxGroup
          legend="Coleções"
          name="collectionIds"
          options={collections.map((collection) => ({ id: collection.id, label: collection.name }))}
          selected={product?.collectionIds ?? []}
        />
      </FormSection>

      <FormSection title="Preço" description="Valores em reais. O promocional não pode superar o preço.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Preço" htmlFor={`${ids}-price`}>
            <input
              id={`${ids}-price`}
              name="price"
              type="number"
              min="0.01"
              step="0.01"
              required
              defaultValue={toCurrencyInput(product?.priceCents ?? null)}
              placeholder="0,00"
              className={inputClass}
            />
            <FieldError message={errors.price} />
          </Field>

          <Field label="Preço promocional" htmlFor={`${ids}-promo`} hint="Deixe vazio se não houver promoção.">
            <input
              id={`${ids}-promo`}
              name="promotionalPrice"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue={toCurrencyInput(product?.promotionalPriceCents ?? null)}
              placeholder="0,00"
              className={inputClass}
            />
            <FieldError message={errors.promotionalPrice} />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Estoque e publicação" description="Disponibilidade e visibilidade no catálogo.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Estoque" htmlFor={`${ids}-stock`}>
            <input id={`${ids}-stock`} name="stock" type="number" min="0" step="1" defaultValue={product?.stock ?? 0} className={inputClass} />
            <FieldError message={errors.stock} />
          </Field>

          <Field label="Status" htmlFor={`${ids}-status`}>
            <select id={`${ids}-status`} name="status" defaultValue={product?.status ?? "draft"} className={inputClass}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <ToggleField
          name="featured"
          label="Produto em destaque"
          description="Aparece nas seções de destaque da loja."
          defaultChecked={product?.featured}
        />
      </FormSection>

      <FormSection title="Imagens" description="Imagens cadastradas neste produto.">
        <ImageUploader initialImages={product?.images ?? []} />
      </FormSection>

      <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-end">
        <Link href="/admin/produtos" className={buttonClass("outline")}>
          Cancelar
        </Link>
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? "Salvando…" : product ? "Salvar produto" : "Criar produto"}
        </button>
      </div>
    </form>
  );
}
