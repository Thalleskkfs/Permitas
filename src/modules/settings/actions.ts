"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentStore } from "@/lib/auth/current-store";
import { createClient } from "@/lib/supabase/server";
import {
  saveStoreDescription,
  saveStoreSettings,
  type SettingsActionState,
  type StoreDescriptionActionState,
} from "./save";

/**
 * Server Action da tela Configurações.
 *
 * O formulário envia só o número e a mensagem: a loja sai da membership autenticada
 * (requireCurrentStore) e a gravação usa o cliente de SESSÃO, sob RLS. Nenhum store_id
 * vindo do cliente é lido. Sem service_role.
 */
export async function saveStoreSettingsAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const result = await saveStoreSettings(
    { getStore: requireCurrentStore, getClient: createClient },
    {
      whatsappNumber: String(formData.get("whatsappNumber") ?? ""),
      whatsappMessageTemplate: String(formData.get("whatsappMessageTemplate") ?? ""),
    },
  );

  if (result.status === "success") {
    revalidatePath("/admin/configuracoes");
    // O botão de compra da vitrine depende do número: todas as páginas da loja mudam.
    revalidatePath("/(storefront)", "layout");
  }

  return result;
}

/**
 * Descrição da loja: aparece em toda página da vitrine (`<meta description>`, cartão de
 * prévia do WhatsApp/Instagram), por isso invalida o layout inteiro, como o número de
 * WhatsApp acima.
 */
export async function saveStoreDescriptionAction(
  _prev: StoreDescriptionActionState,
  formData: FormData,
): Promise<StoreDescriptionActionState> {
  const result = await saveStoreDescription(
    { getStore: requireCurrentStore, getClient: createClient },
    { storeDescription: String(formData.get("storeDescription") ?? "") },
  );

  if (result.status === "success") {
    revalidatePath("/admin/configuracoes");
    revalidatePath("/(storefront)", "layout");
  }

  return result;
}
