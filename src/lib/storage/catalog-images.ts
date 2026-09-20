import "server-only";

import { createStoreAccess } from "@/lib/auth/store-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { CATALOG_IMAGES_BUCKET } from "./catalog-image-path";
import { createCatalogImageOperations } from "./catalog-images-core";

/**
 * Porta de entrada única para as imagens do catálogo.
 *
 * Este é o único módulo do projeto que liga a autorização de sessão à service_role.
 * Nenhum outro arquivo deve importar `createAdminClient` nem falar com o bucket — há
 * testes que varrem o projeto para garantir isso.
 *
 * A identidade e o vínculo com a loja são lidos com o cliente de SESSÃO, sob RLS. O
 * cliente admin só é construído dentro das operações privilegiadas, que o núcleo
 * (catalog-images-core) só alcança depois da autorização.
 */

const requireStoreAccess = createStoreAccess({
  async getAuthenticatedUserId() {
    const supabase = await createSessionClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user?.id ?? null;
  },

  async getMembershipRole(storeId, userId) {
    const supabase = await createSessionClient();
    const { data, error } = await supabase
      .from("store_members")
      .select("role")
      .eq("store_id", storeId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw new Error(`Falha ao verificar o vínculo com a loja: ${error.message}`);
    return data?.role ?? null;
  },
});

const bucket = () => createAdminClient().storage.from(CATALOG_IMAGES_BUCKET);

const operations = createCatalogImageOperations({
  requireStoreAccess,

  async productBelongsToStore(storeId, productId) {
    const { data, error } = await createAdminClient()
      .from("products")
      .select("id")
      .eq("id", productId)
      .eq("store_id", storeId)
      .maybeSingle();

    if (error) throw new Error(`Falha ao verificar o produto: ${error.message}`);
    return data !== null;
  },

  async uploadObject(path, body, contentType) {
    const { error } = await bucket().upload(path, body, { contentType, upsert: false });
    if (error) throw new Error(`Falha no upload da imagem: ${error.message}`);
  },

  async removeObject(path) {
    const { error } = await bucket().remove([path]);
    if (error) throw new Error(`Falha ao remover a imagem: ${error.message}`);
  },

  async createSignedUrl(path, expiresInSeconds) {
    const { data, error } = await bucket().createSignedUrl(path, expiresInSeconds);
    if (error) throw new Error(`Falha ao gerar a URL assinada: ${error.message}`);
    return data.signedUrl;
  },
});

export const uploadCatalogImage = operations.uploadCatalogImage;
export const removeCatalogImage = operations.removeCatalogImage;
export const createCatalogImageSignedUrl = operations.createCatalogImageSignedUrl;
