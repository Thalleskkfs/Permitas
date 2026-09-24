"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import {
  createBannerAction,
  deleteBannerAction,
  moveBannerAction,
  toggleBannerAction,
  updateBannerAction,
} from "@/modules/banners/actions";
import { IDLE_ACTION_STATE } from "@/modules/catalog/errors";
import type { AdminBanner } from "@/types/dashboard";
import { ConfirmDialog } from "./ConfirmDialog";
import { Badge } from "./StatusBadge";
import { ChevronDownIcon, ChevronUpIcon, ImageIcon, TrashIcon } from "./icons";
import { Field, buttonClass, inputClass } from "./ui";

export type DestinoDoBanner = { value: string; label: string };

/**
 * Banners da vitrine: a lista na ordem em que giram na página inicial, e o cadastro.
 * Cada banner tem até duas artes (computador e celular); o texto já vem desenhado nelas.
 */
export function BannerManager({
  banners,
  destinos,
  canDelete,
}: {
  banners: AdminBanner[];
  destinos: DestinoDoBanner[];
  canDelete: boolean;
}) {
  const [criando, setCriando] = useState(banners.length === 0);

  return (
    <div className="flex flex-col gap-6">
      {criando ? (
        <div className="rounded-md border border-border bg-muted/40 p-5">
          <BannerForm destinos={destinos} onDone={() => setCriando(false)} />
        </div>
      ) : (
        <div>
          <button type="button" onClick={() => setCriando(true)} className={buttonClass("primary")}>
            Novo banner
          </button>
        </div>
      )}

      {banners.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum banner ainda. Sem banner, a vitrine mostra o logo da loja no topo.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {banners.map((banner, indice) => (
            <BannerItem
              key={banner.id}
              banner={banner}
              posicao={indice + 1}
              primeiro={indice === 0}
              ultimo={indice === banners.length - 1}
              destinos={destinos}
              canDelete={canDelete}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function Previa({ url, alt, className }: { url?: string; alt: string; className: string }) {
  return (
    <div className={`relative flex items-center justify-center overflow-hidden rounded-md border border-border bg-muted ${className}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária do Storage
        <img src={url} alt={alt} className="absolute inset-0 size-full object-cover" />
      ) : (
        <ImageIcon className="size-5 text-muted-foreground" />
      )}
    </div>
  );
}

function BannerItem({
  banner,
  posicao,
  primeiro,
  ultimo,
  destinos,
  canDelete,
}: {
  banner: AdminBanner;
  posicao: number;
  primeiro: boolean;
  ultimo: boolean;
  destinos: DestinoDoBanner[];
  canDelete: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const destino = destinos.find((option) => option.value === banner.href)?.label ?? "Sem link";

  return (
    <li className="rounded-md border border-border p-4">
      <div className="flex flex-wrap items-start gap-4">
        <span className="w-6 pt-1 text-sm text-muted-foreground tabular-nums">{posicao}</span>

        <div className="flex gap-2">
          <div className="flex flex-col gap-1">
            <Previa url={banner.desktopUrl} alt={`Arte do computador: ${banner.title}`} className="h-16 w-40" />
            <span className="text-xs text-muted-foreground">Computador</span>
          </div>
          <div className="flex flex-col gap-1">
            <Previa url={banner.mobileUrl} alt={`Arte do celular: ${banner.title}`} className="h-16 w-[3.2rem]" />
            <span className="text-xs text-muted-foreground">Celular</span>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{banner.title}</span>
            <Badge tone={banner.active ? "solid" : "muted"}>{banner.active ? "Ativo" : "Inativo"}</Badge>
          </div>
          <span className="text-sm text-muted-foreground">Ao clicar: {destino}</span>
          {!banner.desktopUrl && (
            <span className="text-xs text-muted-foreground">Sem arte de computador: não aparece em telas largas.</span>
          )}
          {!banner.mobileUrl && (
            <span className="text-xs text-muted-foreground">Sem arte de celular: não aparece no celular.</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <form action={moveBannerAction}>
            <input type="hidden" name="id" value={banner.id} />
            <input type="hidden" name="direction" value="up" />
            <button type="submit" disabled={primeiro} aria-label="Mover para antes" className={buttonClass("ghost", "px-2")}>
              <ChevronUpIcon className="size-4" />
            </button>
          </form>
          <form action={moveBannerAction}>
            <input type="hidden" name="id" value={banner.id} />
            <input type="hidden" name="direction" value="down" />
            <button type="submit" disabled={ultimo} aria-label="Mover para depois" className={buttonClass("ghost", "px-2")}>
              <ChevronDownIcon className="size-4" />
            </button>
          </form>
          <form action={toggleBannerAction}>
            <input type="hidden" name="id" value={banner.id} />
            <input type="hidden" name="active" value={banner.active ? "false" : "true"} />
            <button type="submit" className={buttonClass("outline")}>
              {banner.active ? "Desativar" : "Ativar"}
            </button>
          </form>
          <button type="button" onClick={() => setEditando((value) => !value)} className={buttonClass("outline")}>
            {editando ? "Fechar" : "Editar"}
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              aria-label={`Excluir ${banner.title}`}
              className={buttonClass("ghost", "px-2")}
            >
              <TrashIcon className="size-4" />
            </button>
          )}
        </div>
      </div>

      {editando && (
        <div className="mt-4 border-t border-border pt-4">
          <BannerForm banner={banner} destinos={destinos} onDone={() => setEditando(false)} />
        </div>
      )}

      <ConfirmDialog
        open={confirmando}
        title="Excluir banner"
        description={`“${banner.title}” sai da vitrine e as artes são apagadas.`}
        note="A ação não pode ser desfeita. Para tirar só por um tempo, use Desativar."
        confirmLabel="Excluir"
        onClose={() => setConfirmando(false)}
        onConfirm={() => {
          setConfirmando(false);
          const formData = new FormData();
          formData.set("id", banner.id);
          startTransition(() => deleteBannerAction(formData));
        }}
      />
    </li>
  );
}

function BannerForm({
  banner,
  destinos,
  onDone,
}: {
  banner?: AdminBanner;
  destinos: DestinoDoBanner[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    banner ? updateBannerAction : createBannerAction,
    IDLE_ACTION_STATE,
  );
  const erros = state.fieldErrors ?? {};
  const prefixo = banner ? `banner-${banner.id}` : "banner-novo";

  // Deu certo: o formulário fecha (a lista já volta atualizada pela revalidação).
  useEffect(() => {
    if (state.status === "success") onDone();
  }, [state, onDone]);

  return (
    <form
      noValidate
      // onSubmit + startTransition, e não `action`: assim o React não limpa o que foi
      // digitado quando o servidor devolve um erro de validação.
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="flex flex-col gap-4"
    >
      {banner && <input type="hidden" name="id" value={banner.id} />}

      {state.status === "error" && (
        <p role="alert" className="rounded-md border border-control-border px-3 py-2 text-sm">
          {state.message}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome do banner" htmlFor={`${prefixo}-title`} hint="Uso interno e leitor de tela: a arte já traz o texto.">
          <input
            id={`${prefixo}-title`}
            name="title"
            defaultValue={banner?.title}
            maxLength={120}
            aria-invalid={Boolean(erros.title)}
            className={inputClass}
          />
          {erros.title && <span className="text-xs text-accent">{erros.title}</span>}
        </Field>

        <Field label="Ao clicar, leva para" htmlFor={`${prefixo}-href`}>
          <select id={`${prefixo}-href`} name="href" defaultValue={banner?.href ?? ""} className={inputClass}>
            {destinos.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {erros.href && <span className="text-xs text-accent">{erros.href}</span>}
        </Field>

        <Field
          label={banner ? "Trocar arte do computador" : "Arte do computador"}
          htmlFor={`${prefixo}-desktop`}
          hint="Deitada, 12:5 (ex.: 3600×1500). JPG, PNG, WEBP ou AVIF, até 5 MB."
        >
          <input
            id={`${prefixo}-desktop`}
            name="desktop"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            aria-invalid={Boolean(erros.desktop)}
            className={`${inputClass} file:mr-3 file:rounded-sm file:border-0 file:bg-muted file:px-2 file:py-1 file:text-foreground`}
          />
          {erros.desktop && <span className="text-xs text-accent">{erros.desktop}</span>}
        </Field>

        <Field
          label={banner ? "Trocar arte do celular" : "Arte do celular"}
          htmlFor={`${prefixo}-mobile`}
          hint="Em pé, 4:5 (ex.: 1080×1350). JPG, PNG, WEBP ou AVIF, até 5 MB."
        >
          <input
            id={`${prefixo}-mobile`}
            name="mobile"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            aria-invalid={Boolean(erros.mobile)}
            className={`${inputClass} file:mr-3 file:rounded-sm file:border-0 file:bg-muted file:px-2 file:py-1 file:text-foreground`}
          />
          {erros.mobile && <span className="text-xs text-accent">{erros.mobile}</span>}
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={banner?.active ?? true}
          className="focus-ring size-4 accent-[var(--primary)]"
        />
        Ativo (aparece na vitrine)
      </label>

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? "Salvando…" : banner ? "Salvar banner" : "Criar banner"}
        </button>
        <button type="button" onClick={onDone} className={buttonClass("ghost")}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
