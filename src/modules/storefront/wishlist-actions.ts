"use server";

import { getCurrentStoreSlug } from "@/lib/current-store-slug";
import { createPublicClient } from "./supabase-public";
import { resolveWishlistWith, type WishlistResolution } from "./wishlist-resolve";

/**
 * Server Action da página da lista de interesse.
 *
 * Toda Server Action é um endpoint POST público: a entrada chega como `unknown` e é
 * validada com zod dentro de `resolveWishlistWith` antes de qualquer consulta. A leitura
 * usa o cliente anônimo SEM sessão — o mesmo catálogo publicado que qualquer visitante
 * vê — e nunca service_role. Só lê; não grava nada. A loja é a deste deploy
 * (`STORE_SLUG`), lida no servidor: o navegador não escolhe de qual loja ler.
 */
export async function resolveWishlist(items: unknown): Promise<WishlistResolution> {
  return resolveWishlistWith(createPublicClient(), { storeSlug: getCurrentStoreSlug(), items });
}
