/**
 * Convenção de path das imagens do catálogo e sanitização de nome de arquivo.
 *
 * Módulo puro e sem dependências: não fala com o Supabase e não lê variáveis de
 * ambiente. Fica separado de catalog-images.ts (que é server-only) para poder ser
 * testado isoladamente.
 *
 * Convenção: {store_id}/{product_id}/{filename}
 */

export const CATALOG_IMAGES_BUCKET = "catalog-images";

/** Mesmos tipos aceitos por allowed_mime_types do bucket. */
export const CATALOG_IMAGE_MIME_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
} as const;

export type CatalogImageMimeType = keyof typeof CATALOG_IMAGE_MIME_TYPES;

/** jpeg aceita duas extensões na leitura; a geração usa sempre "jpg". */
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "avif"]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FILENAME = /^[a-z0-9][a-z0-9_-]{0,99}\.([a-z0-9]+)$/;

export type CatalogImageLocation = {
  storeId: string;
  productId: string;
  filename: string;
};

export function isCatalogImageMimeType(value: string): value is CatalogImageMimeType {
  return Object.hasOwn(CATALOG_IMAGE_MIME_TYPES, value);
}

export function isValidCatalogImageFilename(filename: string) {
  const match = FILENAME.exec(filename);
  return match !== null && ALLOWED_EXTENSIONS.has(match[1]);
}

/**
 * Gera o nome do arquivo no servidor a partir do tipo real do conteúdo. O nome enviado
 * pelo usuário nunca é usado: ele pode carregar path traversal, maiúsculas, acentos ou
 * uma extensão que não corresponde ao conteúdo.
 */
export function generateCatalogImageFilename(contentType: CatalogImageMimeType) {
  return `${crypto.randomUUID()}.${CATALOG_IMAGE_MIME_TYPES[contentType]}`;
}

/**
 * Monta o path a partir de partes já separadas. Lança se qualquer parte for inválida,
 * então nunca produz um path fora da convenção.
 */
export function buildCatalogImagePath({ storeId, productId, filename }: CatalogImageLocation) {
  if (!UUID.test(storeId)) throw new Error(`storeId inválido: ${JSON.stringify(storeId)}`);
  if (!UUID.test(productId)) throw new Error(`productId inválido: ${JSON.stringify(productId)}`);
  if (!isValidCatalogImageFilename(filename)) {
    throw new Error(`filename inválido: ${JSON.stringify(filename)}`);
  }

  return `${storeId}/${productId}/${filename}`;
}

/**
 * Interpreta um path já existente. Retorna null quando ele não segue a convenção, para
 * que um path vindo do banco ou de uma requisição nunca seja usado às cegas.
 */
export function parseCatalogImagePath(path: string): CatalogImageLocation | null {
  const parts = path.split("/");
  if (parts.length !== 3) return null;

  const [storeId, productId, filename] = parts;
  if (!UUID.test(storeId) || !UUID.test(productId)) return null;
  if (!isValidCatalogImageFilename(filename)) return null;

  return { storeId, productId, filename };
}
