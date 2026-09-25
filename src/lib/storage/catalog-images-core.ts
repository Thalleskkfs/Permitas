import {
  buildCatalogImagePath,
  generateCatalogImageFilename,
  parseCatalogImagePath,
  type CatalogImageMimeType,
} from "./catalog-image-path.ts";
import type { StoreAccess, StoreAction } from "../auth/store-access.ts";

/**
 * Orquestração das operações de imagem do catálogo, na ordem obrigatória:
 *
 *   usuário autenticado -> membership na loja -> produto/path -> operação privilegiada
 *
 * As operações privilegiadas chegam por injeção (`uploadObject`, `removeObject`,
 * `createSignedUrl`, `productBelongsToStore`), então este módulo não conhece o Supabase
 * nem a service_role. A raiz de composição em catalog-images.ts faz a ligação.
 *
 * Nenhuma operação privilegiada é chamada antes de `requireStoreAccess` resolver: se a
 * autorização lança, o service_role nunca é alcançado.
 */

export type CatalogImageBody = ArrayBuffer | Uint8Array | Blob;

/**
 * Leitura pública de uma imagem, para a rota que as serve ao visitante.
 *
 * Não há sessão nem membership aqui: o critério é o próprio catálogo publicado. Uma
 * imagem só sai do bucket se alguma linha VISÍVEL AO VISITANTE a referencia — foto de
 * produto publicado de loja ativa, ou banner ativo de loja ativa. Quem decide isso é
 * `isPubliclyReferenced`, que consulta como anon e portanto passa pela RLS.
 *
 * O path é validado antes de qualquer consulta, e o download privilegiado só acontece
 * depois das duas checagens. Path fora da convenção ou sem referência pública devolve
 * null, sem distinguir os casos: quem sonda não descobre se um arquivo existe.
 */
export type PublicImageReaderDeps = {
  isPubliclyReferenced: (path: string) => Promise<boolean>;
  downloadObject: (path: string) => Promise<Blob | null>;
};

export function createPublicImageReader(deps: PublicImageReaderDeps) {
  return async function readPublicImage(path: string) {
    const location = parseCatalogImagePath(path);
    if (!location) return null;
    if (!(await deps.isPubliclyReferenced(path))) return null;

    const body = await deps.downloadObject(path);
    if (!body) return null;

    const extension = location.filename.split(".").pop()!;
    return { body, contentType: IMAGE_CONTENT_TYPES[extension] };
  };
}

/** O tipo servido sai da extensão já validada, nunca do metadado guardado no bucket. */
const IMAGE_CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

export type CatalogImageOperationsDeps = {
  requireStoreAccess: (storeId: string, action: StoreAction) => Promise<StoreAccess>;
  productBelongsToStore: (storeId: string, productId: string) => Promise<boolean>;
  /** Dos ids recebidos, os que são produtos da loja (uma consulta só). */
  productsBelongingToStore: (storeId: string, productIds: string[]) => Promise<Set<string>>;
  bannerBelongsToStore: (storeId: string, bannerId: string) => Promise<boolean>;
  uploadObject: (
    path: string,
    body: CatalogImageBody,
    contentType: CatalogImageMimeType,
  ) => Promise<void>;
  removeObject: (path: string) => Promise<void>;
  createSignedUrl: (path: string, expiresInSeconds: number) => Promise<string>;
  /** URL assinada de vários arquivos de uma vez: { caminho: url }. */
  createSignedUrls: (paths: string[], expiresInSeconds: number) => Promise<Record<string, string>>;
};

export function createCatalogImageOperations(deps: CatalogImageOperationsDeps) {
  async function assertProduct(storeId: string, productId: string) {
    if (!(await deps.productBelongsToStore(storeId, productId))) {
      throw new Error("Produto não pertence à loja informada.");
    }
  }

  async function assertBanner(storeId: string, bannerId: string) {
    if (!(await deps.bannerBelongsToStore(storeId, bannerId))) {
      throw new Error("Banner não pertence à loja informada.");
    }
  }

  /** Autoriza primeiro e só então interpreta o path recebido. */
  async function authorizeExisting(storeId: string, path: string, action: StoreAction) {
    await deps.requireStoreAccess(storeId, action);

    const location = parseCatalogImagePath(path);
    if (!location) throw new Error("Path fora da convenção do catálogo.");
    if (location.storeId !== storeId) throw new Error("Path pertence a outra loja.");

    await assertProduct(storeId, location.productId);
    return location;
  }

  return {
    async uploadCatalogImage({
      storeId,
      productId,
      contentType,
      body,
    }: {
      storeId: string;
      productId: string;
      contentType: CatalogImageMimeType;
      body: CatalogImageBody;
    }) {
      await deps.requireStoreAccess(storeId, "storage:write");
      await assertProduct(storeId, productId);

      const path = buildCatalogImagePath({
        storeId,
        productId,
        filename: generateCatalogImageFilename(contentType),
      });

      await deps.uploadObject(path, body, contentType);
      return { path };
    },

    async removeCatalogImage({ storeId, path }: { storeId: string; path: string }) {
      await authorizeExisting(storeId, path, "storage:delete");
      await deps.removeObject(path);
    },

    /**
     * Imagem de banner da hero. Mesma convenção de path das fotos de produto, com o id
     * do banner no lugar do produto: {store_id}/{banner_id}/{arquivo}. O banco também
     * exige isso (store_banners_image_path_scoped), então as duas pontas concordam.
     */
    async uploadBannerImage({
      storeId,
      bannerId,
      contentType,
      body,
    }: {
      storeId: string;
      bannerId: string;
      contentType: CatalogImageMimeType;
      body: CatalogImageBody;
    }) {
      await deps.requireStoreAccess(storeId, "storage:write");
      await assertBanner(storeId, bannerId);

      const path = buildCatalogImagePath({
        storeId,
        productId: bannerId,
        filename: generateCatalogImageFilename(contentType),
      });

      await deps.uploadObject(path, body, contentType);
      return { path };
    },

    async removeBannerImage({ storeId, path }: { storeId: string; path: string }) {
      await deps.requireStoreAccess(storeId, "storage:delete");

      const location = parseCatalogImagePath(path);
      if (!location) throw new Error("Path fora da convenção do catálogo.");
      if (location.storeId !== storeId) throw new Error("Path pertence a outra loja.");

      await assertBanner(storeId, location.productId);
      await deps.removeObject(path);
    },

    /**
     * Foto da seção "Sobre nós", uma por loja. Mesma convenção de path das demais
     * imagens do catálogo, usando o próprio store_id como "entidade" (a seção não tem
     * id além do da loja): {store_id}/{store_id}/{arquivo}.
     */
    async uploadAboutImage({
      storeId,
      contentType,
      body,
    }: {
      storeId: string;
      contentType: CatalogImageMimeType;
      body: CatalogImageBody;
    }) {
      await deps.requireStoreAccess(storeId, "storage:write");

      const path = buildCatalogImagePath({
        storeId,
        productId: storeId,
        filename: generateCatalogImageFilename(contentType),
      });

      await deps.uploadObject(path, body, contentType);
      return { path };
    },

    async removeAboutImage({ storeId, path }: { storeId: string; path: string }) {
      await deps.requireStoreAccess(storeId, "storage:delete");

      const location = parseCatalogImagePath(path);
      if (!location) throw new Error("Path fora da convenção do catálogo.");
      if (location.storeId !== storeId || location.productId !== storeId) {
        throw new Error("Path pertence a outra loja.");
      }

      await deps.removeObject(path);
    },

    /**
     * URLs temporárias de várias fotos de produto, para as prévias do painel (produto em
     * rascunho não é servido pela rota pública). Uma checagem de acesso para o lote; o
     * caminho de outra loja ou de produto que não é da loja fica de fora, sem erro.
     */
    async createCatalogImageSignedUrls({
      storeId,
      paths,
      expiresInSeconds = 60,
    }: {
      storeId: string;
      paths: string[];
      expiresInSeconds?: number;
    }): Promise<Record<string, string>> {
      await deps.requireStoreAccess(storeId, "storage:read");

      const porProduto = new Map<string, string[]>();
      for (const path of paths) {
        const location = parseCatalogImagePath(path);
        if (!location || location.storeId !== storeId) continue;
        porProduto.set(location.productId, [...(porProduto.get(location.productId) ?? []), path]);
      }
      if (porProduto.size === 0) return {};

      const daLoja = await deps.productsBelongingToStore(storeId, [...porProduto.keys()]);
      const permitidos = [...porProduto].filter(([productId]) => daLoja.has(productId)).flatMap(([, list]) => list);
      if (permitidos.length === 0) return {};

      return deps.createSignedUrls(permitidos, expiresInSeconds);
    },

    /**
     * URL temporária da arte de um banner, para a prévia no painel: banner inativo não é
     * servido pela rota pública. Mesmas travas da remoção — membro da loja, caminho da
     * própria loja e banner que pertence a ela.
     */
    async createBannerImageSignedUrl({
      storeId,
      path,
      expiresInSeconds = 60,
    }: {
      storeId: string;
      path: string;
      expiresInSeconds?: number;
    }) {
      await deps.requireStoreAccess(storeId, "storage:read");

      const location = parseCatalogImagePath(path);
      if (!location) throw new Error("Path fora da convenção do catálogo.");
      if (location.storeId !== storeId) throw new Error("Path pertence a outra loja.");

      await assertBanner(storeId, location.productId);
      return deps.createSignedUrl(path, expiresInSeconds);
    },

    /** URL temporária da foto de "Sobre nós", para a prévia no painel. */
    async createAboutImageSignedUrl({
      storeId,
      path,
      expiresInSeconds = 60,
    }: {
      storeId: string;
      path: string;
      expiresInSeconds?: number;
    }) {
      await deps.requireStoreAccess(storeId, "storage:read");

      const location = parseCatalogImagePath(path);
      if (!location) throw new Error("Path fora da convenção do catálogo.");
      if (location.storeId !== storeId || location.productId !== storeId) {
        throw new Error("Path pertence a outra loja.");
      }

      return deps.createSignedUrl(path, expiresInSeconds);
    },

    /**
     * URL temporária para uso autenticado no servidor. A exposição pública das imagens
     * depende da arquitetura de controle de idade, ainda não definida.
     */
    async createCatalogImageSignedUrl({
      storeId,
      path,
      expiresInSeconds = 60,
    }: {
      storeId: string;
      path: string;
      expiresInSeconds?: number;
    }) {
      await authorizeExisting(storeId, path, "storage:read");
      return deps.createSignedUrl(path, expiresInSeconds);
    },
  };
}
