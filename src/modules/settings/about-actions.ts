"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentStore } from "@/lib/auth/current-store";
import { isCatalogImageMimeType, type CatalogImageMimeType } from "@/lib/storage/catalog-image-path";
import { createAboutImageSignedUrl, removeAboutImage, uploadAboutImage } from "@/lib/storage/catalog-images";
import { createClient } from "@/lib/supabase/server";
import { actionError, type ActionState, CATALOG_MESSAGES } from "@/modules/catalog/errors";
import { canEditStoreSettings } from "./authorization";
import { ABOUT_TEXT_MAX } from "./schemas";
import { SETTINGS_MESSAGES } from "./save";

/**
 * Seção "Sobre nós" (foto + texto), acima da hero da vitrine.
 *
 * Fica num arquivo à parte de actions.ts (que só cuida do WhatsApp) porque toca o
 * Storage: só a rota pública de imagens e Server Actions podem importar o helper de
 * catalog-images (ver tests/storage-architecture.test.mjs).
 */

const MAX_ABOUT_IMAGE_BYTES = 5 * 1024 * 1024;

export type AboutSectionActionState = ActionState & {
  saved?: { text: string | null; imageUrl?: string };
};

/**
 * URL assinada da foto atual, para a prévia no painel. A loja vem da membership
 * autenticada; o path é conferido contra ela antes de qualquer URL sair.
 */
export async function getAboutImagePreviewUrl(path: string): Promise<string | undefined> {
  const store = await requireCurrentStore();
  return createAboutImageSignedUrl({ storeId: store.storeId, path, expiresInSeconds: 60 * 60 }).catch(
    () => undefined,
  );
}

/**
 * Foto e texto são gravados juntos: a foto é opcional a cada envio (o formulário só
 * troca quando um arquivo novo é escolhido), o texto sempre é regravado com o valor do
 * campo. Sem foto OU sem texto, a vitrine não mostra a seção — ver toStore() em
 * mappers.ts.
 */
export async function saveAboutSectionAction(
  _prev: AboutSectionActionState,
  formData: FormData,
): Promise<AboutSectionActionState> {
  const store = await requireCurrentStore();
  if (!canEditStoreSettings(store.role)) return actionError(SETTINGS_MESSAGES.notAllowed);

  const texto = String(formData.get("texto") ?? "").trim();
  const fotoValue = formData.get("foto");
  const foto = fotoValue instanceof File && fotoValue.size > 0 ? fotoValue : null;

  const fieldErrors: Record<string, string> = {};
  if (texto.length > ABOUT_TEXT_MAX) fieldErrors.texto = `Use até ${ABOUT_TEXT_MAX} caracteres.`;
  if (foto) {
    if (!isCatalogImageMimeType(foto.type)) fieldErrors.foto = "Use JPG, PNG, WEBP ou AVIF.";
    else if (foto.size > MAX_ABOUT_IMAGE_BYTES) fieldErrors.foto = "O arquivo passa de 5 MB.";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return actionError(CATALOG_MESSAGES.invalidInput, fieldErrors);
  }

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("store_settings")
    .select("about_image_path")
    .eq("store_id", store.storeId)
    .maybeSingle();

  let novoPath: string | undefined;
  if (foto) {
    try {
      const { path } = await uploadAboutImage({
        storeId: store.storeId,
        contentType: foto.type as CatalogImageMimeType,
        body: foto,
      });
      novoPath = path;
    } catch {
      return actionError("Não foi possível enviar a foto. Tente de novo.");
    }
  }

  const values: { about_text: string | null; about_image_path?: string; about_image_alt?: string | null } = {
    about_text: texto || null,
  };
  if (novoPath) {
    values.about_image_path = novoPath;
    values.about_image_alt = texto || null;
  }

  const { data: atualizado, error } = await supabase
    .from("store_settings")
    .update(values)
    .eq("store_id", store.storeId)
    .select("store_id");

  const salvo = atualizado && atualizado.length > 0;
  if (!error && !salvo) {
    // Loja ainda sem linha em store_settings (nunca configurou o WhatsApp, por exemplo).
    const { error: insertError } = await supabase
      .from("store_settings")
      .insert({ store_id: store.storeId, ...values });
    if (insertError) {
      if (novoPath) await removeAboutImage({ storeId: store.storeId, path: novoPath }).catch(() => {});
      return actionError("Não foi possível salvar. Tente de novo.");
    }
  } else if (error) {
    if (novoPath) await removeAboutImage({ storeId: store.storeId, path: novoPath }).catch(() => {});
    return actionError("Não foi possível salvar. Tente de novo.");
  }

  // A arte substituída sai do Storage depois que a nova já está gravada.
  if (novoPath && atual?.about_image_path) {
    await removeAboutImage({ storeId: store.storeId, path: atual.about_image_path }).catch(() => {});
  }

  const imageUrl = novoPath ? await getAboutImagePreviewUrl(novoPath) : undefined;

  revalidatePath("/admin/configuracoes");
  revalidatePath("/(storefront)", "layout");

  return {
    status: "success",
    message: "Seção salva.",
    saved: { text: texto || null, imageUrl },
  };
}
