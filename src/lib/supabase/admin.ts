import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Cliente com service_role: ignora RLS por completo.
 *
 * O import "server-only" faz o build falhar se este módulo for alcançado por um Client
 * Component, então a chave nunca chega ao navegador. Ele não substitui os clientes de
 * client.ts e server.ts, que continuam usando a chave pública e respeitando a RLS.
 *
 * Como a RLS não protege nada aqui, toda autorização passa a ser responsabilidade
 * explícita de quem chama: verificar o vínculo do usuário com a loja antes de agir.
 * Use apenas onde a RLS não é capaz de resolver, como o Storage.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase admin não configurado: defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local (veja .env.example).",
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
