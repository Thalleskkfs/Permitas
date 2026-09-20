"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentStore } from "@/lib/auth/current-store";
import { createClient } from "@/lib/supabase/server";
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

function revalidateCatalog(...paths: string[]) {
  for (const path of ["/admin", "/admin/produtos", "/admin/estoque", ...paths]) {
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

  const store = await requireCurrentStore();
  const supabase = await createClient();
  const input = parsed.data;

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
