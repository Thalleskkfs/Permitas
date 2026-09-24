"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { createProductAction, updateProductAction } from "@/modules/catalog/actions";
import { IDLE_ACTION_STATE, type ActionState } from "@/modules/catalog/errors";
import type { AdminCategoryNode, AdminCollection, AdminProduct, AdminTag } from "@/types/dashboard";
import { FormSection } from "./FormSection";
import { ImageIcon, TrashIcon } from "./icons";
import { Field, ToggleField, buttonClass, inputClass } from "./ui";

const STATUS_OPTIONS = [
  { value: "draft", label: "Rascunho" },
  { value: "published", label: "Publicado" },
  { value: "archived", label: "Arquivado" },
];

const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/avif";

/**
 * Imagens escolhidas ANTES de o produto existir: ficam num `<input>` comum dentro do
 * formulário (vão junto no envio) — o upload de verdade só acontece no servidor,
 * depois que o produto é criado, porque o caminho no bucket exige o id dele. Aqui é só
 * prévia local (`URL.createObjectURL`) e a chance de tirar um arquivo antes de enviar.
 */
function NewProductImagePicker({ error }: { error?: string }) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  // Uma prévia por arquivo, refeita só quando a lista muda; a anterior é liberada
  // depois, nunca antes de a nova estar pronta (senão a miniatura pisca).
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);

  /** O navegador não deixa editar um FileList direto: refaz um novo e recoloca no input. */
  function aplicar(lista: File[]) {
    const transferencia = new DataTransfer();
    lista.forEach((file) => transferencia.items.add(file));
    if (inputRef.current) inputRef.current.files = transferencia.files;
    setFiles(lista);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border px-6 py-10 text-center">
        <ImageIcon className="size-6 text-muted-foreground" />
        <label htmlFor={inputId} className="cursor-pointer text-sm font-medium underline-offset-2 hover:underline">
          Selecionar imagens
        </label>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          name="files"
          accept={ACCEPTED_IMAGE_TYPES}
          multiple
          className="sr-only"
          aria-invalid={Boolean(error)}
          // O SO substitui a seleção a cada abertura do picker; somamos ao que já tinha
          // sido escolhido, senão a segunda leva de fotos apaga a primeira em silêncio.
          onChange={(event) => {
            const escolhidos = [...(event.currentTarget.files ?? [])];
            if (escolhidos.length > 0) aplicar([...files, ...escolhidos]);
          }}
        />
        <p className="text-xs text-muted-foreground">
          JPEG, PNG, WebP ou AVIF, até 5 MB cada. A primeira é a principal.
        </p>
        {error && (
          <p role="alert" className="text-xs font-medium text-foreground">
            {error}
          </p>
        )}
      </div>

      {files.length > 0 && (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {files.map((file, index) => (
            <li key={`${file.name}-${file.lastModified}`} className="flex flex-col gap-2">
              <div className="relative aspect-square overflow-hidden rounded-md border border-border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- prévia local, nunca otimizada */}
                <img src={previews[index]} alt="" className="absolute inset-0 size-full object-cover" />
                {index === 0 && (
                  <span className="absolute left-2 top-2 rounded-sm bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                    Principal
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => aplicar(files.filter((_, i) => i !== index))}
                aria-label={`Remover "${file.name}"`}
                className={buttonClass("ghost", "px-2 py-1 self-start")}
              >
                <TrashIcon className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Campos que o servidor pode recusar, na ordem em que aparecem na tela. A ordem decide
 * qual campo recebe o foco e como o resumo de erros é listado.
 */
const FIELDS = [
  { key: "name", label: "Nome" },
  { key: "sku", label: "SKU" },
  { key: "categoryId", label: "Categoria" },
  { key: "price", label: "Preço" },
  { key: "promotionalPrice", label: "Preço promocional" },
  { key: "stock", label: "Estoque" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];

/** Centavos exibidos como "49,90", que é como o lojista digita. */
const toCurrencyInput = (cents: number | null) =>
  cents === null ? "" : (cents / 100).toFixed(2).replace(".", ",");

/** O endereço (slug) sai do nome, então um problema nele aparece no campo Nome. */
function fieldErrorsOf(state: ActionState): Partial<Record<FieldKey, string>> {
  const errors: Record<string, string> = { ...(state.fieldErrors ?? {}) };
  if (errors.slug && !errors.name) errors.name = errors.slug;
  return errors;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs font-medium text-foreground">
      {message}
    </p>
  );
}

function CheckboxGroup({
  legend,
  name,
  options,
  selected,
  error,
}: {
  legend: string;
  name: string;
  options: { id: string; label: string }[];
  selected: string[];
  error?: string;
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
            <span className="flex cursor-pointer items-center rounded-md border border-border px-3 py-1.5 text-sm hover:border-foreground peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring">
              {option.label}
            </span>
          </label>
        ))}
      </div>
      {error && <p className="text-xs font-medium text-foreground">{error}</p>}
    </fieldset>
  );
}

/**
 * Formulário do produto, ligado às Server Actions.
 *
 * O envio passa por `onSubmit` + `startTransition` em vez de `<form action>`: com
 * `action`, o React 19 limpa o formulário ao terminar a ação — inclusive quando o
 * servidor recusa a entrada —, e o lojista perdia tudo o que tinha digitado.
 *
 * A validação do navegador fica desligada (`noValidate`) para todos os problemas
 * aparecerem de uma vez, com as mensagens do servidor, em vez de um balão por vez.
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

  const errors = fieldErrorsOf(state);
  const invalidFields = FIELDS.filter((field) => errors[field.key]);
  // Tags e coleções não têm campo próprio em FIELDS (são grupos de checkbox, não um
  // input só); e qualquer chave que apareça aqui no futuro sem um campo dedicado cai
  // neste resumo em vez de sumir — o problema nunca fica invisível.
  const OUTROS_LABELS: Record<string, string> = { tagIds: "Tags", collectionIds: "Coleções", images: "Imagens" };
  const rawErrors = errors as Record<string, string>;
  const outros = Object.keys(rawErrors)
    .filter((key) => key !== "slug" && !FIELDS.some((field) => field.key === key))
    .map((key) => ({ key, label: OUTROS_LABELS[key] ?? key, message: rawErrors[key] }));
  const idOf = (key: FieldKey) => `${ids}-${key}`;
  const errorIdOf = (key: FieldKey) => `${ids}-${key}-error`;

  // Depois de uma recusa, leva o lojista direto ao primeiro campo com problema.
  useEffect(() => {
    if (state.status !== "error") return;
    const first = FIELDS.find((field) => fieldErrorsOf(state)[field.key]);
    if (first) document.getElementById(`${ids}-${first.key}`)?.focus();
  }, [state, ids]);

  /** Atributos de acessibilidade e destaque visual de um campo recusado. */
  const invalidProps = (key: FieldKey) =>
    errors[key] ? { "aria-invalid": true as const, "aria-describedby": errorIdOf(key) } : {};
  const inputClassFor = (key: FieldKey) =>
    errors[key] ? `${inputClass} border-foreground` : inputClass;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="flex flex-col gap-8"
    >
      {product && <input type="hidden" name="productId" value={product.id} />}

      {state.status === "error" && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-md border border-foreground bg-muted px-4 py-3 text-sm"
        >
          <p className="font-medium">{state.message}</p>
          {(invalidFields.length > 0 || outros.length > 0) && (
            <ul className="flex flex-col gap-1">
              {invalidFields.map((field) => (
                <li key={field.key}>
                  <a
                    href={`#${idOf(field.key)}`}
                    onClick={(event) => {
                      event.preventDefault();
                      document.getElementById(idOf(field.key))?.focus();
                    }}
                    className="focus-ring underline hover:no-underline"
                  >
                    {field.label}
                  </a>
                  <span className="text-muted-foreground">: {errors[field.key]}</span>
                </li>
              ))}
              {outros.map((item) => (
                <li key={item.key}>
                  <span className="font-medium">{item.label}</span>
                  <span className="text-muted-foreground">: {item.message}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">O que você preencheu foi mantido.</p>
        </div>
      )}

      {state.status === "success" && state.message && (
        <p role="status" className="rounded-md border border-border bg-muted px-4 py-3 text-sm">
          {state.message}
        </p>
      )}

      <FormSection title="Informações" description="Nome, identificação e como o produto é descrito na loja.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Nome *" htmlFor={idOf("name")} className="sm:col-span-2">
            <input
              id={idOf("name")}
              name="name"
              defaultValue={product?.name}
              placeholder="Ex.: Creme Roxo"
              className={inputClassFor("name")}
              {...invalidProps("name")}
            />
            <FieldError id={errorIdOf("name")} message={errors.name} />
          </Field>

          <Field label="SKU" htmlFor={idOf("sku")} hint="Opcional. Único dentro da loja.">
            <input
              id={idOf("sku")}
              name="sku"
              defaultValue={product?.sku ?? ""}
              placeholder="EX-001"
              className={inputClassFor("sku")}
              {...invalidProps("sku")}
            />
            <FieldError id={errorIdOf("sku")} message={errors.sku} />
          </Field>

          <Field label="Categoria" htmlFor={idOf("categoryId")}>
            <select
              id={idOf("categoryId")}
              name="categoryId"
              defaultValue={product?.categoryId ?? ""}
              className={inputClassFor("categoryId")}
              {...invalidProps("categoryId")}
            >
              <option value="">Sem categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {"— ".repeat(category.depth)}
                  {category.name}
                </option>
              ))}
            </select>
            <FieldError id={errorIdOf("categoryId")} message={errors.categoryId} />
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
          error={rawErrors.tagIds}
        />

        <CheckboxGroup
          legend="Coleções"
          name="collectionIds"
          options={collections.map((collection) => ({ id: collection.id, label: collection.name }))}
          selected={product?.collectionIds ?? []}
          error={rawErrors.collectionIds}
        />
      </FormSection>

      {/* Só na criação: a edição usa o ImageUploader de verdade, que já envia pro bucket
          (o produto — e o caminho dele no Storage — só existe depois de criado). */}
      {!product && (
        <FormSection
          title="Imagens"
          description="A primeira imagem é a principal, exibida na vitrine e nas listagens."
        >
          <NewProductImagePicker error={rawErrors.images} />
        </FormSection>
      )}

      <FormSection title="Preço" description="Valores em reais. O promocional não pode superar o preço.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Preço *" htmlFor={idOf("price")} hint="Use vírgula para os centavos, ex.: 49,90.">
            <input
              id={idOf("price")}
              name="price"
              inputMode="decimal"
              autoComplete="off"
              defaultValue={toCurrencyInput(product?.priceCents ?? null)}
              placeholder="0,00"
              className={inputClassFor("price")}
              {...invalidProps("price")}
            />
            <FieldError id={errorIdOf("price")} message={errors.price} />
          </Field>

          <Field label="Preço promocional" htmlFor={idOf("promotionalPrice")} hint="Deixe vazio se não houver promoção.">
            <input
              id={idOf("promotionalPrice")}
              name="promotionalPrice"
              inputMode="decimal"
              autoComplete="off"
              defaultValue={toCurrencyInput(product?.promotionalPriceCents ?? null)}
              placeholder="0,00"
              className={inputClassFor("promotionalPrice")}
              {...invalidProps("promotionalPrice")}
            />
            <FieldError id={errorIdOf("promotionalPrice")} message={errors.promotionalPrice} />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Estoque e publicação" description="Disponibilidade e visibilidade no catálogo.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Estoque" htmlFor={idOf("stock")}>
            <input
              id={idOf("stock")}
              name="stock"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              defaultValue={product?.stock ?? 0}
              className={inputClassFor("stock")}
              {...invalidProps("stock")}
            />
            <FieldError id={errorIdOf("stock")} message={errors.stock} />
          </Field>

          <Field label="Status" htmlFor={`${ids}-status`} hint="Só produtos publicados aparecem na loja.">
            <select id={`${ids}-status`} name="status" defaultValue={product?.status ?? "published"} className={inputClass}>
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

      <div className="sticky bottom-0 flex flex-col gap-3 border-t border-border bg-background py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">* Campos obrigatórios</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/admin/produtos" className={buttonClass("outline")}>
            Cancelar
          </Link>
          <button type="submit" disabled={pending} className={buttonClass("primary")}>
            {pending ? "Salvando…" : product ? "Salvar produto" : "Criar produto"}
          </button>
        </div>
      </div>
    </form>
  );
}
