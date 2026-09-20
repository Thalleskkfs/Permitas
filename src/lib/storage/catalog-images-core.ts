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

export type CatalogImageOperationsDeps = {
  requireStoreAccess: (storeId: string, action: StoreAction) => Promise<StoreAccess>;
  productBelongsToStore: (storeId: string, productId: string) => Promise<boolean>;
  uploadObject: (
    path: string,
    body: CatalogImageBody,
    contentType: CatalogImageMimeType,
  ) => Promise<void>;
  removeObject: (path: string) => Promise<void>;
  createSignedUrl: (path: string, expiresInSeconds: number) => Promise<string>;
};

export function createCatalogImageOperations(deps: CatalogImageOperationsDeps) {
  async function assertProduct(storeId: string, productId: string) {
    if (!(await deps.productBelongsToStore(storeId, productId))) {
      throw new Error("Produto não pertence à loja informada.");
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
