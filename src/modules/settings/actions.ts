"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentStore } from "@/lib/auth/current-store";
import { createClient } from "@/lib/supabase/server";
import { saveStoreSettings, type SettingsActionState } from "./save";

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
