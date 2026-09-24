"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentStore } from "@/lib/auth/current-store";
import { isCatalogImageMimeType, type CatalogImageMimeType } from "@/lib/storage/catalog-image-path";
import {
  createCatalogImageSignedUrls,
  removeCatalogImage,
  uploadCatalogImage,
} from "@/lib/storage/catalog-images";
import { createClient } from "@/lib/supabase/server";
import type { AdminImage } from "@/types/dashboard";
import { canDeleteStructures } from "./authorization";
import {
  CATALOG_MESSAGES,
  actionError,
  actionSuccess,
  toCatalogErrorMessage,
  toFieldErrors,
  type ActionState,
} from "./errors";
import {
  categoryInputSchema,
  collectionInputSchema,
  productInputSchema,
  tagInputSchema,
  variantInputSchema,
} from "./schemas";

/**
 * Mutations do catálogo.
 *
 * Toda ação segue a mesma ordem:
 *   1. valida a entrada com zod;
 *   2. resolve a loja pela membership autenticada (nunca por store_id do formulário);
 *   3. confere o papel quando a operação exige;
 *   4. executa com o cliente de SESSÃO, sob RLS;
 *   5. revalida as rotas afetadas.
 *
 * As camadas 3 e 4 são independentes: a checagem de papel evita uma ida inútil ao banco,
 * mas quem decide de fato é a policy. Quando a RLS recusa um UPDATE ou DELETE, nenhuma
 * linha volta — por isso as ações conferem o retorno em vez de assumir sucesso.
 *
 * Nenhuma delas usa service_role.
 */

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "");
const ids = (formData: FormData, key: string) => formData.getAll(key).map(String).filter(Boolean);
const flag = (formData: FormData, key: string) => formData.get(key) !== null;

// Criar, editar ou excluir produto muda a categoria, as tags e as coleções vinculadas —
// e por tabela essas telas mostram contagem por item (produtos por categoria/tag/coleção).
// Sem revalidar as três aqui, elas ficam com números defasados até alguma ação própria
// delas rodar, mesmo já tendo sido abertas antes pelo lojista.
function revalidateCatalog(...paths: string[]) {
  for (const path of [
    "/admin",
    "/admin/produtos",
    "/admin/estoque",
    "/admin/categorias",
    "/admin/colecoes",
    "/admin/tags",
    ...paths,
  ]) {
    revalidatePath(path);
  }
}

// ---------------------------------------------------------------------------
// Produtos
// ---------------------------------------------------------------------------

function readProductForm(formData: FormData) {
  return productInputSchema.safeParse({
    name: text(formData, "name"),
    slug: text(formData, "slug") || undefined,
    sku: text(formData, "sku"),
    shortDescription: text(formData, "shortDescription"),
    description: text(formData, "description"),
    categoryId: text(formData, "categoryId"),
    price: text(formData, "price"),
    promotionalPrice: text(formData, "promotionalPrice"),
    stock: text(formData, "stock"),
    status: text(formData, "status"),
    featured: flag(formData, "featured"),
    tagIds: ids(formData, "tagIds"),
    collectionIds: ids(formData, "collectionIds"),
  });
}

/**
 * Confirma que a categoria, as tags e as coleções escolhidas pertencem à MESMA loja do
 * produto, antes de tocar em products/product_tags/collection_products.
 *
 * A FK composta do banco (ex.: products_category_fkey (category_id, store_id)) já barra
 * o vínculo cruzado — mas só depois que a escrita já rodou parcialmente: na criação, o
 * produto já teria sido inserido antes de a FK de category_id recusar; na edição,
 * syncProductLinks já teria apagado os vínculos antigos antes de a FK do novo tag_id ou
 * collection_id recusar a reinserção. Sem esta checagem, um id de outra loja não vaza
 * dado nenhum (a FK garante isso), mas deixa um produto órfão para trás na criação, ou
 * apaga vínculos válidos sem repor na edição. Checar antes evita as duas coisas; a FK
 * continua sendo a última barreira, para uma corrida entre esta leitura e a escrita.
 */
async function verifyCatalogRefsBelongToStore(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storeId: string,
  refs: { categoryId: string | null; tagIds: string[]; collectionIds: string[] },
) {
  if (refs.categoryId) {
    const { data } = await supabase
      .from("categories")
      .select("id")
      .eq("id", refs.categoryId)
      .eq("store_id", storeId)
      .maybeSingle();
    if (!data) return false;
  }

  if (refs.tagIds.length > 0) {
    const { data } = await supabase.from("tags").select("id").eq("store_id", storeId).in("id", refs.tagIds);
    if ((data?.length ?? 0) !== refs.tagIds.length) return false;
  }

  if (refs.collectionIds.length > 0) {
    const { data } = await supabase
      .from("collections")
      .select("id")
      .eq("store_id", storeId)
      .in("id", refs.collectionIds);
    if ((data?.length ?? 0) !== refs.collectionIds.length) return false;
  }

  return true;
}

/** Refaz os vínculos do produto. O store_id vem do contexto, nunca do formulário. */
async function syncProductLinks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storeId: string,
  productId: string,
  tagIds: string[],
  collectionIds: string[],
) {
  await supabase.from("product_tags").delete().eq("product_id", productId);
  await supabase.from("collection_products").delete().eq("product_id", productId);

  if (tagIds.length > 0) {
    const { error } = await supabase
      .from("product_tags")
      .insert(tagIds.map((tagId) => ({ store_id: storeId, product_id: productId, tag_id: tagId })));
    if (error) return error;
  }

  if (collectionIds.length > 0) {
    const { error } = await supabase.from("collection_products").insert(
      collectionIds.map((collectionId, index) => ({
        store_id: storeId,
        product_id: productId,
        collection_id: collectionId,
        position: index,
      })),
    );
    if (error) return error;
  }

  return null;
}

export async function createProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = readProductForm(formData);
  if (!parsed.success) return actionError(CATALOG_MESSAGES.invalidInput, toFieldErrors(parsed.error.issues));

  // Validado ANTES de criar o produto: um arquivo ruim não deve deixar pra trás um
  // produto sem foto que o lojista nem sabia que tinha sido criado.
  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const imageError = firstImageError(files);
  if (imageError) return actionError(CATALOG_MESSAGES.invalidInput, { images: imageError });

  const store = await requireCurrentStore();
  const supabase = await createClient();
  const input = parsed.data;

  const refsOk = await verifyCatalogRefsBelongToStore(supabase, store.storeId, {
    categoryId: input.categoryId,
    tagIds: input.tagIds,
    collectionIds: input.collectionIds,
  });
  if (!refsOk) return actionError(CATALOG_MESSAGES.crossStore);

  const { data, error } = await supabase
    .from("products")
    .insert({
      store_id: store.storeId,
      name: input.name,
      slug: input.slug,
      sku: input.sku,
      short_description: input.shortDescription,
      description: input.description,
      category_id: input.categoryId,
      price_cents: input.price,
      promotional_price_cents: input.promotionalPrice,
      stock: input.stock,
      status: input.status,
      featured: input.featured,
    })
    .select("id")
    .single();

  if (error || !data) return actionError(toCatalogErrorMessage(error));

  const linkError = await syncProductLinks(
    supabase,
    store.storeId,
    data.id,
    input.tagIds,
    input.collectionIds,
  );
  if (linkError) return actionError(toCatalogErrorMessage(linkError));

  // Best-effort: o produto já está criado e correto mesmo se uma foto falhar ao
  // enviar (rede, Storage fora do ar). O lojista completa pela tela de edição, que
  // abre em seguida.
  let position = 0;
  for (const file of files) {
    try {
      const { path } = await uploadCatalogImage({
        storeId: store.storeId,
        productId: data.id,
        contentType: file.type as CatalogImageMimeType,
        body: await file.arrayBuffer(),
      });
      await supabase.from("product_images").insert({ product_id: data.id, storage_path: path, position });
      position += 1;
    } catch {
      break;
    }
  }

  revalidateCatalog();
  redirect(`/admin/produtos/${data.id}`);
}

export async function updateProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const productId = text(formData, "productId");
  if (!productId) return actionError(CATALOG_MESSAGES.notFound);

  const parsed = readProductForm(formData);
  if (!parsed.success) return actionError(CATALOG_MESSAGES.invalidInput, toFieldErrors(parsed.error.issues));

  const store = await requireCurrentStore();
  const supabase = await createClient();
  const input = parsed.data;

  const refsOk = await verifyCatalogRefsBelongToStore(supabase, store.storeId, {
    categoryId: input.categoryId,
    tagIds: input.tagIds,
    collectionIds: input.collectionIds,
  });
  if (!refsOk) return actionError(CATALOG_MESSAGES.crossStore);

  // store_id nunca é atualizado: mover produto entre lojas não é uma operação existente.
  const { data, error } = await supabase
    .from("products")
    .update({
      name: input.name,
      slug: input.slug,
      sku: input.sku,
      short_description: input.shortDescription,
      description: input.description,
      category_id: input.categoryId,
      price_cents: input.price,
      promotional_price_cents: input.promotionalPrice,
      stock: input.stock,
      status: input.status,
      featured: input.featured,
    })
    .eq("id", productId)
    .eq("store_id", store.storeId)
    .select("id");

  if (error) return actionError(toCatalogErrorMessage(error));
  if (!data || data.length === 0) return actionError(CATALOG_MESSAGES.notFound);

  const linkError = await syncProductLinks(
    supabase,
    store.storeId,
    productId,
    input.tagIds,
    input.collectionIds,
  );
  if (linkError) return actionError(toCatalogErrorMessage(linkError));

  revalidateCatalog(`/admin/produtos/${productId}`);
  return actionSuccess("Produto salvo.");
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  const productId = text(formData, "productId");
  const store = await requireCurrentStore();

  // Primeira barreira. A policy products_delete_owner é a que decide de fato.
  if (!canDeleteStructures(store.role) || !productId) {
    redirect("/admin/produtos?erro=permissao");
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("store_id", store.storeId)
    .select("id");

  revalidateCatalog();
  redirect(data && data.length > 0 ? "/admin/produtos" : "/admin/produtos?erro=permissao");
}

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

export async function saveCategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = categoryInputSchema.safeParse({
    name: text(formData, "name"),
    slug: text(formData, "slug") || undefined,
    parentId: text(formData, "parentId"),
    description: text(formData, "description"),
    active: flag(formData, "active"),
    sortOrder: text(formData, "sortOrder") || 0,
  });
  if (!parsed.success) return actionError(CATALOG_MESSAGES.invalidInput, toFieldErrors(parsed.error.issues));

  const categoryId = text(formData, "categoryId");
  const store = await requireCurrentStore();
  const supabase = await createClient();
  const input = parsed.data;

  const values = {
    name: input.name,
    slug: input.slug,
    parent_id: input.parentId,
    description: input.description,
    active: input.active,
    sort_order: input.sortOrder,
  };

  if (categoryId) {
    const { data, error } = await supabase
      .from("categories")
      .update(values)
      .eq("id", categoryId)
      .eq("store_id", store.storeId)
      .select("id");

    if (error) return actionError(toCatalogErrorMessage(error));
    if (!data || data.length === 0) return actionError(CATALOG_MESSAGES.notFound);
  } else {
    const { error } = await supabase.from("categories").insert({ store_id: store.storeId, ...values });
    if (error) return actionError(toCatalogErrorMessage(error));
  }

  revalidateCatalog("/admin/categorias");
  return actionSuccess(categoryId ? "Categoria salva." : "Categoria criada.");
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const categoryId = text(formData, "categoryId");
  const store = await requireCurrentStore();

  if (canDeleteStructures(store.role) && categoryId) {
    const supabase = await createClient();
    await supabase.from("categories").delete().eq("id", categoryId).eq("store_id", store.storeId);
  }

  revalidateCatalog("/admin/categorias");
  redirect("/admin/categorias");
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export async function saveTagAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = tagInputSchema.safeParse({
    name: text(formData, "name"),
    slug: text(formData, "slug") || undefined,
  });
  if (!parsed.success) return actionError(CATALOG_MESSAGES.invalidInput, toFieldErrors(parsed.error.issues));

  const tagId = text(formData, "tagId");
  const store = await requireCurrentStore();
  const supabase = await createClient();
  const values = { name: parsed.data.name, slug: parsed.data.slug };

  if (tagId) {
    const { data, error } = await supabase
      .from("tags")
      .update(values)
      .eq("id", tagId)
      .eq("store_id", store.storeId)
      .select("id");

    if (error) return actionError(toCatalogErrorMessage(error));
    if (!data || data.length === 0) return actionError(CATALOG_MESSAGES.notFound);
  } else {
    const { error } = await supabase.from("tags").insert({ store_id: store.storeId, ...values });
    if (error) return actionError(toCatalogErrorMessage(error));
  }

  revalidateCatalog("/admin/tags");
  return actionSuccess(tagId ? "Tag salva." : "Tag criada.");
}

export async function deleteTagAction(formData: FormData): Promise<void> {
  const tagId = text(formData, "tagId");
  const store = await requireCurrentStore();

  if (canDeleteStructures(store.role) && tagId) {
    const supabase = await createClient();
    await supabase.from("tags").delete().eq("id", tagId).eq("store_id", store.storeId);
  }

  revalidateCatalog("/admin/tags");
  redirect("/admin/tags");
}

// ---------------------------------------------------------------------------
// Coleções
// ---------------------------------------------------------------------------

export async function saveCollectionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = collectionInputSchema.safeParse({
    name: text(formData, "name"),
    slug: text(formData, "slug") || undefined,
    description: text(formData, "description"),
    active: flag(formData, "active"),
    position: text(formData, "position") || 0,
  });
  if (!parsed.success) return actionError(CATALOG_MESSAGES.invalidInput, toFieldErrors(parsed.error.issues));

  const collectionId = text(formData, "collectionId");
  const store = await requireCurrentStore();
  const supabase = await createClient();
  const input = parsed.data;

  const values = {
    name: input.name,
    slug: input.slug,
    description: input.description,
    active: input.active,
    sort_order: input.position,
  };

  if (collectionId) {
    const { data, error } = await supabase
      .from("collections")
      .update(values)
      .eq("id", collectionId)
      .eq("store_id", store.storeId)
      .select("id");

    if (error) return actionError(toCatalogErrorMessage(error));
    if (!data || data.length === 0) return actionError(CATALOG_MESSAGES.notFound);
  } else {
    const { error } = await supabase.from("collections").insert({ store_id: store.storeId, ...values });
    if (error) return actionError(toCatalogErrorMessage(error));
  }

  revalidateCatalog("/admin/colecoes");
  return actionSuccess(collectionId ? "Coleção salva." : "Coleção criada.");
}

export async function deleteCollectionAction(formData: FormData): Promise<void> {
  const collectionId = text(formData, "collectionId");
  const store = await requireCurrentStore();

  if (canDeleteStructures(store.role) && collectionId) {
    const supabase = await createClient();
    await supabase.from("collections").delete().eq("id", collectionId).eq("store_id", store.storeId);
  }

  revalidateCatalog("/admin/colecoes");
  redirect("/admin/colecoes");
}

// ---------------------------------------------------------------------------
// Variantes
// ---------------------------------------------------------------------------

export async function saveVariantAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const productId = text(formData, "productId");
  if (!productId) return actionError(CATALOG_MESSAGES.notFound);

  const parsed = variantInputSchema.safeParse({
    name: text(formData, "name"),
    sku: text(formData, "sku"),
    price: text(formData, "price"),
    stock: text(formData, "stock"),
    options: text(formData, "options"),
    active: flag(formData, "active"),
    position: text(formData, "position") || 0,
  });
  if (!parsed.success) return actionError(CATALOG_MESSAGES.invalidInput, toFieldErrors(parsed.error.issues));

  const variantId = text(formData, "variantId");
  const store = await requireCurrentStore();
  const supabase = await createClient();
  const input = parsed.data;

  // O produto precisa ser desta loja; a FK composta (id, store_id) reforça no banco.
  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("store_id", store.storeId)
    .maybeSingle();
  if (!product) return actionError(CATALOG_MESSAGES.notFound);

  const values = {
    name: input.name,
    sku: input.sku,
    price_cents: input.price,
    stock: input.stock,
    options: input.options,
    active: input.active,
    position: input.position,
  };

  if (variantId) {
    const { data, error } = await supabase
      .from("product_variants")
      .update(values)
      .eq("id", variantId)
      .eq("product_id", productId)
      .eq("store_id", store.storeId)
      .select("id");

    if (error) return actionError(toCatalogErrorMessage(error));
    if (!data || data.length === 0) return actionError(CATALOG_MESSAGES.notFound);
  } else {
    const { error } = await supabase
      .from("product_variants")
      .insert({ store_id: store.storeId, product_id: productId, ...values });
    if (error) return actionError(toCatalogErrorMessage(error));
  }

  revalidateCatalog(`/admin/produtos/${productId}`);
  return actionSuccess(variantId ? "Variante salva." : "Variante criada.");
}

export async function deleteVariantAction(formData: FormData): Promise<void> {
  const variantId = text(formData, "variantId");
  const productId = text(formData, "productId");
  const store = await requireCurrentStore();

  if (canDeleteStructures(store.role) && variantId) {
    const supabase = await createClient();
    await supabase
      .from("product_variants")
      .delete()
      .eq("id", variantId)
      .eq("store_id", store.storeId);
  }

  revalidateCatalog(`/admin/produtos/${productId}`);
  redirect(`/admin/produtos/${productId}`);
}

// ---------------------------------------------------------------------------
// Imagens do produto
//
// O upload em si (validar loja/produto, gerar o nome, gravar no bucket) já é feito por
// uploadCatalogImage/removeCatalogImage, que fazem sua PRÓPRIA checagem de sessão e
// membership — independente da que a ação já fez. Esta camada só cuida do que é
// específico do formulário: ler os arquivos, validar tipo e tamanho, e manter a linha
// de product_images (que é metadado nosso, não faz parte do contrato do Storage).
// ---------------------------------------------------------------------------

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // mesmo teto do bucket catalog-images

/** Primeiro arquivo fora das regras do bucket (tipo ou tamanho), já com a mensagem pronta. */
function firstImageError(files: File[]): string | null {
  for (const file of files) {
    if (!isCatalogImageMimeType(file.type)) {
      return `"${file.name}" não é um tipo aceito. Use JPEG, PNG, WebP ou AVIF.`;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return `"${file.name}" passa de 5 MB.`;
    }
  }
  return null;
}

export async function addProductImagesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const productId = text(formData, "productId");
  if (!productId) return actionError(CATALOG_MESSAGES.notFound);

  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length === 0) return actionError("Selecione ao menos uma imagem.");

  const imageError = firstImageError(files);
  if (imageError) return actionError(imageError);

  const store = await requireCurrentStore();
  const supabase = await createClient();

  // Confirma que o produto é desta loja antes de gastar upload com um id que a
  // página nunca deveria ter deixado chegar aqui.
  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("store_id", store.storeId)
    .maybeSingle();
  if (!product) return actionError(CATALOG_MESSAGES.notFound);

  const { data: last } = await supabase
    .from("product_images")
    .select("position")
    .eq("product_id", productId)
    .order("position", { ascending: false })
    .limit(1);
  let nextPosition = (last?.[0]?.position ?? -1) + 1;

  for (const file of files) {
    const contentType = file.type as CatalogImageMimeType;
    const body = await file.arrayBuffer();

    let path: string;
    try {
      ({ path } = await uploadCatalogImage({ storeId: store.storeId, productId, contentType, body }));
    } catch (error) {
      return actionError(error instanceof Error ? error.message : CATALOG_MESSAGES.generic);
    }

    const { error } = await supabase
      .from("product_images")
      .insert({ product_id: productId, storage_path: path, position: nextPosition });
    if (error) return actionError(toCatalogErrorMessage(error));
    nextPosition += 1;
  }

  revalidateCatalog(`/admin/produtos/${productId}`);
  return actionSuccess(files.length === 1 ? "Imagem enviada." : `${files.length} imagens enviadas.`);
}

export async function removeProductImageAction(formData: FormData): Promise<void> {
  const imageId = text(formData, "imageId");
  const productId = text(formData, "productId");
  const store = await requireCurrentStore();

  if (imageId && productId) {
    const supabase = await createClient();
    const { data: image } = await supabase
      .from("product_images")
      .select("storage_path")
      .eq("id", imageId)
      .eq("product_id", productId)
      .maybeSingle();

    if (image) {
      // A ordem importa: só apaga a linha se o arquivo saiu do bucket primeiro. Uma
      // falha no Storage deixa o metadado intacto em vez de apontar para nada.
      try {
        await removeCatalogImage({ storeId: store.storeId, path: image.storage_path });
        await supabase.from("product_images").delete().eq("id", imageId);
      } catch {
        // Sem toast em uma ação sem estado; a imagem some da lista quando o
        // problema for corrigido e a ação for repetida.
      }
    }
  }

  revalidateCatalog(`/admin/produtos/${productId}`);
  redirect(`/admin/produtos/${productId}`);
}

export async function moveProductImageAction(formData: FormData): Promise<void> {
  const imageId = text(formData, "imageId");
  const productId = text(formData, "productId");
  const direction = text(formData, "direction");
  const store = await requireCurrentStore();

  if (imageId && productId && (direction === "up" || direction === "down")) {
    const supabase = await createClient();

    // product_images não tem store_id próprio; confirmamos a loja pelo produto, como
    // reforço explícito além da RLS — mesmo padrão das demais ações desta loja.
    const { data: product } = await supabase
      .from("products")
      .select("id")
      .eq("id", productId)
      .eq("store_id", store.storeId)
      .maybeSingle();

    if (product) {
      const { data: images } = await supabase
        .from("product_images")
        .select("id, position")
        .eq("product_id", productId)
        .order("position", { ascending: true });

      const index = images?.findIndex((image) => image.id === imageId) ?? -1;
      const swapWith = direction === "up" ? index - 1 : index + 1;

      if (images && index >= 0 && swapWith >= 0 && swapWith < images.length) {
        const current = images[index];
        const neighbor = images[swapWith];
        // Duas linhas distintas, sem chave única em position: trocar os valores não
        // esbarra em conflito, mesmo momentaneamente.
        await supabase.from("product_images").update({ position: neighbor.position }).eq("id", current.id);
        await supabase.from("product_images").update({ position: current.position }).eq("id", neighbor.id);
      }
    }
  }

  revalidateCatalog(`/admin/produtos/${productId}`);
  redirect(`/admin/produtos/${productId}`);
}

// ---------------------------------------------------------------------------
// Prévias do painel
// ---------------------------------------------------------------------------

/**
 * A rota pública /imagens só serve foto de produto PUBLICADO. No painel, o produto em
 * rascunho ou arquivado ficaria sem prévia; para esses, o endereço vira uma URL assinada
 * e temporária. Só assina caminho de produto da própria loja (a porta do Storage confere);
 * produto publicado segue pela rota pública, que tem cache.
 */
export async function withProductPreviews<T extends { status: string; images: AdminImage[] }>(
  products: T[],
): Promise<T[]> {
  const store = await requireCurrentStore();

  const paths = products
    .filter((product) => product.status !== "published")
    .flatMap((product) => product.images.map((image) => image.storagePath));
  if (paths.length === 0) return products;

  const urls = await createCatalogImageSignedUrls({
    storeId: store.storeId,
    paths,
    expiresInSeconds: 60 * 60,
  }).catch(() => ({}) as Record<string, string>);

  return products.map((product) =>
    product.status === "published"
      ? product
      : { ...product, images: product.images.map((image) => ({ ...image, url: urls[image.storagePath] ?? image.url })) },
  );
}
