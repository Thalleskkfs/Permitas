import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Leitura das configurações da loja para o painel.
 *
 * Cliente de SESSÃO: a RLS (store_settings_select_member, stores_select_member) deixa
 * qualquer membro ler. O `storeId` vem de requireCurrentStore e só restringe a consulta;
 * um id de outra loja não retorna nada.
 *
 * Não importa o helper de Storage (ver tests/storage-architecture.test.mjs: só a rota
 * de imagens e Server Actions podem) — por isso devolve o PATH cru de "Sobre nós", e é
 * a página (Server Component) que pede a URL assinada a about-actions.ts.
 */
export type StoreSettingsView = {
  storeName: string;
  storeSlug: string;
  whatsappNumber: string | null;
  whatsappMessageTemplate: string | null;
  aboutText: string | null;
  aboutImagePath: string | null;
};

export async function getStoreSettings(storeId: string): Promise<StoreSettingsView | null> {
  const supabase = await createClient();

  const [{ data: store }, { data: settings }] = await Promise.all([
    supabase.from("stores").select("name, slug").eq("id", storeId).maybeSingle(),
    supabase
      .from("store_settings")
      .select("whatsapp_number, whatsapp_message_template, about_text, about_image_path")
      .eq("store_id", storeId)
      .maybeSingle(),
  ]);

  if (!store) return null;

  // Loja sem linha em store_settings é um estado válido: ainda não configurada.
  return {
    storeName: store.name,
    storeSlug: store.slug,
    whatsappNumber: settings?.whatsapp_number ?? null,
    whatsappMessageTemplate: settings?.whatsapp_message_template ?? null,
    aboutText: settings?.about_text ?? null,
    aboutImagePath: settings?.about_image_path ?? null,
  };
}
