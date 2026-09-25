import "server-only";

import { createStoreAccess } from "@/lib/auth/store-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { CATALOG_IMAGES_BUCKET } from "./catalog-image-path";
import { createCatalogImageOperations, createPublicImageReader } from "./catalog-images-core";
import { createPublicClient } from "@/modules/storefront/supabase-public";

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

  async productsBelongingToStore(storeId, productIds) {
    const { data, error } = await createAdminClient()
      .from("products")
      .select("id")
      .eq("store_id", storeId)
      .in("id", productIds);

    if (error) throw new Error(`Falha ao verificar os produtos: ${error.message}`);
    return new Set((data ?? []).map((row) => row.id));
  },

  async bannerBelongsToStore(storeId, bannerId) {
    const { data, error } = await createAdminClient()
      .from("store_banners")
      .select("id")
      .eq("id", bannerId)
      .eq("store_id", storeId)
      .maybeSingle();

    if (error) throw new Error(`Falha ao verificar o banner: ${error.message}`);
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

  async createSignedUrls(paths, expiresInSeconds) {
    const { data, error } = await bucket().createSignedUrls(paths, expiresInSeconds);
    if (error) throw new Error(`Falha ao gerar as URLs assinadas: ${error.message}`);
    const urls: Record<string, string> = {};
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) urls[entry.path] = entry.signedUrl;
    }
    return urls;
  },
});

export const uploadCatalogImage = operations.uploadCatalogImage;
export const removeCatalogImage = operations.removeCatalogImage;
export const createCatalogImageSignedUrl = operations.createCatalogImageSignedUrl;
export const uploadBannerImage = operations.uploadBannerImage;
export const removeBannerImage = operations.removeBannerImage;
export const createBannerImageSignedUrl = operations.createBannerImageSignedUrl;
export const createCatalogImageSignedUrls = operations.createCatalogImageSignedUrls;
export const uploadAboutImage = operations.uploadAboutImage;
export const removeAboutImage = operations.removeAboutImage;
export const createAboutImageSignedUrl = operations.createAboutImageSignedUrl;

/**
 * Leitura para a rota pública de imagens.
 *
 * A pergunta "este arquivo pode ser mostrado?" é feita como VISITANTE (cliente anônimo,
 * sem sessão, sob RLS): só enxerga a linha quem a enxergaria na vitrine. Uma foto de
 * rascunho, de produto arquivado, de banner inativo ou de loja desativada não é
 * referenciada por nenhuma linha visível, e portanto não sai do bucket. A service_role
 * entra só depois, para o download.
 */
export const readPublicImage = createPublicImageReader({
  async isPubliclyReferenced(path) {
    const visitor = createPublicClient();
    // Consultas separadas com `.eq`, e não um `.or()` montado com o caminho: o valor vem
    // da URL, e texto interpolado num filtro do PostgREST é superfície de injeção mesmo
    // com o caminho já validado antes.
    const [images, banners, mobileBanners, about] = await Promise.all([
      visitor.from("product_images").select("id").eq("storage_path", path).limit(1),
      visitor.from("store_banners").select("id").eq("image_path", path).limit(1),
      visitor.from("store_banners").select("id").eq("image_path_mobile", path).limit(1),
      visitor.from("store_settings").select("store_id").eq("about_image_path", path).limit(1),
    ]);

    for (const result of [images, banners, mobileBanners, about]) {
      if (result.error) throw new Error(`Falha ao verificar a imagem: ${result.error.message}`);
    }
    return [images, banners, mobileBanners, about].some((result) => (result.data?.length ?? 0) > 0);
  },

  async downloadObject(path) {
    const { data, error } = await bucket().download(path);
    if (error) return null;
    return data;
  },
});
