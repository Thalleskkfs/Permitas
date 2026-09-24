"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentStore } from "@/lib/auth/current-store";
import { isCatalogImageMimeType, type CatalogImageMimeType } from "@/lib/storage/catalog-image-path";
import {
  createBannerImageSignedUrl,
  removeBannerImage,
  uploadBannerImage,
} from "@/lib/storage/catalog-images";
import { storefrontPaths } from "@/lib/storefront-paths";
import { createClient } from "@/lib/supabase/server";
import { canDeleteStructures } from "@/modules/catalog/authorization";
import {
  CATALOG_MESSAGES,
  actionError,
  actionSuccess,
  toCatalogErrorMessage,
  type ActionState,
} from "@/modules/catalog/errors";
import type { AdminBanner } from "@/types/dashboard";

/**
 * Banners da hero da vitrine, geridos pelo painel.
 *
 * Server Actions são endpoints públicos: qualquer um pode chamá-las por fora da tela.
 * Por isso TODA ação começa por `requireCurrentStore()`, antes de ler qualquer entrada:
 * ele valida o usuário no servidor de autenticação, exige a verificação em duas etapas
 * (AAL2) e o vínculo com a loja; sem isso, redireciona e a ação não roda. A loja nunca
 * vem do formulário.
 *
 * Depois disso ainda valem, independentes:
 *   - a RLS de store_banners: só membro da loja lê e grava; só o proprietário exclui;
 *   - as travas do Storage: membro da loja, caminho da própria loja e do próprio banner;
 *   - as constraints do banco: título, link sempre interno, caminho da arte escopado.
 *
 * Nenhuma delas usa service_role diretamente; o upload passa pela porta única do Storage.
 */

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const PREVIEW_SECONDS = 60 * 60;
const TITULO_MAX = 120;
const ROTULO_DO_LINK = "Ver produtos";

type Sessao = Awaited<ReturnType<typeof createClient>>;
type Colunas = { image_path?: string; image_path_mobile?: string };

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

function arquivo(formData: FormData, key: string): File | null {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

function revalidateBanners() {
  revalidatePath("/admin/banners");
  revalidatePath("/");
}

function conferirArte(image: File | null, rotulo: string): string | null {
  if (!image) return null;
  if (!isCatalogImageMimeType(image.type)) return `${rotulo}: use JPG, PNG, WEBP ou AVIF.`;
  if (image.size > MAX_IMAGE_BYTES) return `${rotulo}: o arquivo passa de 5 MB.`;
  return null;
}

/** Destinos aceitos para o clique: a lista completa ou uma categoria ativa da loja. */
async function destinosPermitidos(supabase: Sessao, storeId: string) {
  const paths = storefrontPaths();
  const { data } = await supabase
    .from("categories")
    .select("slug")
    .eq("store_id", storeId)
    .eq("active", true);
  return new Set([paths.allProducts, ...(data ?? []).map((category) => paths.category(category.slug))]);
}

/**
 * Validação comum a criar e editar. A arte é obrigatória só na criação.
 *
 * `hrefAtual` é o link já salvo do banner (na edição): uma categoria pode ser
 * desativada depois de um banner apontar pra ela, e sem isso o campo "Ao clicar, leva
 * para" ficaria de fora da lista de destinos e seria recusado mesmo sem o lojista ter
 * mexido nele — ou pior, seria salvo como "Sem link" por engano.
 */
async function lerFormulario(
  formData: FormData,
  supabase: Sessao,
  storeId: string,
  exigirArte: boolean,
  hrefAtual: string | null = null,
) {
  const title = text(formData, "title");
  const href = text(formData, "href");
  const active = formData.get("active") !== null;
  const desktop = arquivo(formData, "desktop");
  const mobile = arquivo(formData, "mobile");

  const fieldErrors: Record<string, string> = {};
  if (!title) fieldErrors.title = "Dê um nome ao banner.";
  else if (title.length > TITULO_MAX) fieldErrors.title = `Use até ${TITULO_MAX} caracteres.`;
  if (exigirArte && !desktop && !mobile) fieldErrors.desktop = "Envie ao menos uma arte (computador ou celular).";
  const erroDesktop = conferirArte(desktop, "Arte do computador");
  if (erroDesktop) fieldErrors.desktop = erroDesktop;
  const erroMobile = conferirArte(mobile, "Arte do celular");
  if (erroMobile) fieldErrors.mobile = erroMobile;
  if (href && href !== hrefAtual && !(await destinosPermitidos(supabase, storeId)).has(href)) {
    fieldErrors.href = "Escolha um destino da lista.";
  }

  return { title, href, active, desktop, mobile, fieldErrors };
}

/** Envia as artes; se uma falhar, apaga as que já tinham subido. */
async function enviarArtes(storeId: string, bannerId: string, desktop: File | null, mobile: File | null) {
  const enviados: string[] = [];
  const colunas: Colunas = {};
  try {
    for (const [coluna, image] of [
      ["image_path", desktop],
      ["image_path_mobile", mobile],
    ] as const) {
      if (!image) continue;
      const { path } = await uploadBannerImage({
        storeId,
        bannerId,
        contentType: image.type as CatalogImageMimeType,
        body: image,
      });
      enviados.push(path);
      colunas[coluna] = path;
    }
    return colunas;
  } catch (error) {
    await Promise.allSettled(enviados.map((path) => removeBannerImage({ storeId, path })));
    throw error;
  }
}

/** Banners da loja para o painel, com prévia por URL assinada (banner inativo não é público). */
export async function loadBannersForPanel(): Promise<AdminBanner[]> {
  const store = await requireCurrentStore();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("store_banners")
    .select("id, title, cta_href, image_path, image_path_mobile, active, position")
    .eq("store_id", store.storeId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Falha ao listar os banners: ${error.message}`);

  const previa = async (path: string | null) =>
    path
      ? createBannerImageSignedUrl({ storeId: store.storeId, path, expiresInSeconds: PREVIEW_SECONDS }).catch(
          () => undefined,
        )
      : undefined;

  return Promise.all(
    (data ?? []).map(async (row) => ({
      id: row.id,
      title: row.title,
      href: row.cta_href ?? "",
      active: row.active,
      desktopUrl: await previa(row.image_path),
      mobileUrl: await previa(row.image_path_mobile),
    })),
  );
}

export async function createBannerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const store = await requireCurrentStore();
  const supabase = await createClient();

  const form = await lerFormulario(formData, supabase, store.storeId, true);
  if (Object.keys(form.fieldErrors).length > 0) {
    return actionError(CATALOG_MESSAGES.invalidInput, form.fieldErrors);
  }

  // Entra no fim da fila.
  const { data: ultimo } = await supabase
    .from("store_banners")
    .select("position")
    .eq("store_id", store.storeId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: banner, error } = await supabase
    .from("store_banners")
    .insert({
      store_id: store.storeId,
      title: form.title,
      image_alt: form.title,
      active: form.active,
      cta_label: form.href ? ROTULO_DO_LINK : null,
      cta_href: form.href || null,
      position: Math.min(1000, (ultimo?.position ?? -1) + 1),
    })
    .select("id")
    .single();
  if (error || !banner) return actionError(toCatalogErrorMessage(error));

  try {
    const colunas = await enviarArtes(store.storeId, banner.id, form.desktop, form.mobile);
    const { error: erroArte } = await supabase
      .from("store_banners")
      .update(colunas)
      .eq("id", banner.id)
      .eq("store_id", store.storeId);
    if (erroArte) throw new Error(erroArte.message);
  } catch {
    // Sem arte o banner não aparece em lugar nenhum: desfaz o cadastro.
    await supabase.from("store_banners").delete().eq("id", banner.id).eq("store_id", store.storeId);
    return actionError("Não foi possível enviar a arte. Tente de novo.");
  }

  revalidateBanners();
  return actionSuccess("Banner criado.");
}

export async function updateBannerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const store = await requireCurrentStore();
  const supabase = await createClient();

  const id = text(formData, "id");
  const { data: atual } = await supabase
    .from("store_banners")
    .select("id, image_path, image_path_mobile, cta_href")
    .eq("id", id)
    .eq("store_id", store.storeId)
    .maybeSingle();
  if (!atual) return actionError(CATALOG_MESSAGES.notFound);

  const form = await lerFormulario(formData, supabase, store.storeId, false, atual.cta_href);
  if (Object.keys(form.fieldErrors).length > 0) {
    return actionError(CATALOG_MESSAGES.invalidInput, form.fieldErrors);
  }

  let novas: Colunas;
  try {
    novas = await enviarArtes(store.storeId, atual.id, form.desktop, form.mobile);
  } catch {
    return actionError("Não foi possível enviar a arte. Tente de novo.");
  }

  const { data: salvo, error } = await supabase
    .from("store_banners")
    .update({
      title: form.title,
      image_alt: form.title,
      active: form.active,
      cta_label: form.href ? ROTULO_DO_LINK : null,
      cta_href: form.href || null,
      ...novas,
    })
    .eq("id", atual.id)
    .eq("store_id", store.storeId)
    .select("id");

  const trocadas = [novas.image_path, novas.image_path_mobile].filter((path): path is string => Boolean(path));
  if (error || !salvo || salvo.length === 0) {
    await Promise.allSettled(trocadas.map((path) => removeBannerImage({ storeId: store.storeId, path })));
    return actionError(error ? toCatalogErrorMessage(error) : CATALOG_MESSAGES.notFound);
  }

  // A arte substituída sai do Storage depois que a nova já está gravada.
  const antigas = [
    novas.image_path ? atual.image_path : null,
    novas.image_path_mobile ? atual.image_path_mobile : null,
  ].filter((path): path is string => Boolean(path));
  await Promise.allSettled(antigas.map((path) => removeBannerImage({ storeId: store.storeId, path })));

  revalidateBanners();
  return actionSuccess("Banner salvo.");
}

export async function toggleBannerAction(formData: FormData): Promise<void> {
  const store = await requireCurrentStore();
  const supabase = await createClient();

  await supabase
    .from("store_banners")
    .update({ active: text(formData, "active") === "true" })
    .eq("id", text(formData, "id"))
    .eq("store_id", store.storeId);

  revalidateBanners();
}

export async function moveBannerAction(formData: FormData): Promise<void> {
  const store = await requireCurrentStore();
  const supabase = await createClient();

  const id = text(formData, "id");
  const direction = text(formData, "direction");
  if (direction !== "up" && direction !== "down") return;

  const { data } = await supabase
    .from("store_banners")
    .select("id, position")
    .eq("store_id", store.storeId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  const ordem = (data ?? []).map((row) => row.id);
  const indice = ordem.indexOf(id);
  const alvo = direction === "up" ? indice - 1 : indice + 1;
  if (indice < 0 || alvo < 0 || alvo >= ordem.length) return;

  [ordem[indice], ordem[alvo]] = [ordem[alvo], ordem[indice]];
  // Renumera a fila inteira (0, 1, 2…): posições repetidas deixam de empatar a ordem.
  await Promise.all(
    ordem.map((bannerId, position) =>
      supabase.from("store_banners").update({ position }).eq("id", bannerId).eq("store_id", store.storeId),
    ),
  );

  revalidateBanners();
}

export async function deleteBannerAction(formData: FormData): Promise<void> {
  const store = await requireCurrentStore();
  // Só o proprietário exclui (a RLS diz o mesmo); o editor pode desativar.
  if (!canDeleteStructures(store.role)) return;

  const supabase = await createClient();
  const { data: banner } = await supabase
    .from("store_banners")
    .select("id, image_path, image_path_mobile")
    .eq("id", text(formData, "id"))
    .eq("store_id", store.storeId)
    .maybeSingle();
  if (!banner) return;

  // As artes saem antes da linha: a trava do Storage confere que o banner ainda existe.
  const artes = [banner.image_path, banner.image_path_mobile].filter((path): path is string => Boolean(path));
  await Promise.allSettled(artes.map((path) => removeBannerImage({ storeId: store.storeId, path })));
  await supabase.from("store_banners").delete().eq("id", banner.id).eq("store_id", store.storeId);

  revalidateBanners();
}
