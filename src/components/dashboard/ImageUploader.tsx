"use client";

import Image from "next/image";
import { useActionState, useId, useRef } from "react";
import {
  addProductImagesAction,
  moveProductImageAction,
  removeProductImageAction,
} from "@/modules/catalog/actions";
import { IDLE_ACTION_STATE } from "@/modules/catalog/errors";
import type { AdminImage } from "@/types/dashboard";
import { ChevronLeftIcon, ChevronRightIcon, ImageIcon, TrashIcon } from "./icons";
import { buttonClass } from "./ui";

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,image/avif";

/**
 * Uma imagem existente: exclusão e reordenar são ações sem estado (o próprio elemento
 * `<form>` já basta), como as demais exclusões do painel. A miniatura vem da mesma rota
 * que serve a vitrine — o painel também precisa de sessão para vê-la, porque o bucket
 * não tem nenhuma policy pública.
 */
function ExistingImage({
  image,
  productId,
  isFirst,
  isLast,
}: {
  image: AdminImage;
  productId: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <li className="flex flex-col gap-2">
      <div className="relative aspect-square overflow-hidden rounded-md border border-border bg-muted">
        <Image
          src={image.url}
          alt={image.alt}
          fill
          sizes="200px"
          unoptimized={image.url.startsWith("http")}
          className="object-cover"
        />
        {isFirst && (
          <span className="absolute left-2 top-2 rounded-sm bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
            Principal
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-1">
        <div className="flex gap-1">
          <form action={moveProductImageAction}>
            <input type="hidden" name="imageId" value={image.id} />
            <input type="hidden" name="productId" value={productId} />
            <input type="hidden" name="direction" value="up" />
            <button
              type="submit"
              disabled={isFirst}
              aria-label={`Mover "${image.alt}" para antes`}
              className={buttonClass("ghost", "px-2 py-1")}
            >
              <ChevronLeftIcon className="size-4" />
            </button>
          </form>
          <form action={moveProductImageAction}>
            <input type="hidden" name="imageId" value={image.id} />
            <input type="hidden" name="productId" value={productId} />
            <input type="hidden" name="direction" value="down" />
            <button
              type="submit"
              disabled={isLast}
              aria-label={`Mover "${image.alt}" para depois`}
              className={buttonClass("ghost", "px-2 py-1")}
            >
              <ChevronRightIcon className="size-4" />
            </button>
          </form>
        </div>

        <form action={removeProductImageAction}>
          <input type="hidden" name="imageId" value={image.id} />
          <input type="hidden" name="productId" value={productId} />
          <button
            type="submit"
            aria-label={`Excluir "${image.alt}"`}
            className={buttonClass("ghost", "px-2 py-1")}
          >
            <TrashIcon className="size-4" />
          </button>
        </form>
      </div>
    </li>
  );
}

/**
 * Imagens do produto: envio real para o bucket privado, com miniatura, reordenação e
 * exclusão. A primeira imagem (posição 0) é a principal na vitrine.
 *
 * O envio usa `useActionState` porque precisa de feedback de progresso e de erro (tipo
 * ou tamanho recusado); excluir e reordenar não precisam — são só um `<form>` com
 * `action` direto, como as demais exclusões do painel.
 */
export function ImageUploader({
  productId,
  initialImages,
}: {
  productId: string;
  initialImages: AdminImage[];
}) {
  const inputId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(addProductImagesAction, IDLE_ACTION_STATE);

  return (
    <div className="flex flex-col gap-4">
      <form
        ref={formRef}
        action={formAction}
        className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border px-6 py-10 text-center"
      >
        <input type="hidden" name="productId" value={productId} />
        <ImageIcon className="size-6 text-muted-foreground" />
        <label htmlFor={inputId} className="cursor-pointer text-sm font-medium underline-offset-2 hover:underline">
          Selecionar imagens
        </label>
        <input
          id={inputId}
          type="file"
          name="files"
          accept={ACCEPTED_TYPES}
          multiple
          className="sr-only"
          onChange={() => formRef.current?.requestSubmit()}
          disabled={pending}
        />
        <p className="text-xs text-muted-foreground">JPEG, PNG, WebP ou AVIF, até 5 MB cada.</p>
        {pending && <p className="text-xs text-muted-foreground">Enviando…</p>}
        {state.status === "error" && (
          <p role="alert" className="text-xs font-medium text-foreground">
            {state.message}
          </p>
        )}
        {state.status === "success" && (
          <p role="status" className="text-xs text-muted-foreground">
            {state.message}
          </p>
        )}
      </form>

      {initialImages.length === 0 ? (
        <p className="rounded-md border border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhuma imagem cadastrada para este produto.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {initialImages.map((image, index) => (
            <ExistingImage
              key={image.id}
              image={image}
              productId={productId}
              isFirst={index === 0}
              isLast={index === initialImages.length - 1}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
