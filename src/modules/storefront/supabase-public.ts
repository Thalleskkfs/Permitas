import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.types.ts";
import { getSupabaseEnv } from "../../lib/supabase/env.ts";

/**
 * Cliente da vitrine: chave anônima e NENHUMA sessão.
 *
 * Isto é deliberado, não um esquecimento — não troque por `@/lib/supabase/server`.
 *
 * As policies de leitura pública do catálogo valem para o papel `anon`. O cliente de
 * servidor lê os cookies e, com um administrador logado, a requisição chegaria ao banco
 * como `authenticated`: as policies de membro entrariam no lugar das públicas e a mesma
 * página mostraria coisas diferentes dependendo de quem abriu — o dono veria rascunhos
 * da própria loja e nada das outras. A vitrine é pública, então todo visitante, logado
 * ou não, precisa ler exatamente o mesmo catálogo publicado. De quebra, uma resposta que
 * não depende de cookie é cacheável.
 *
 * `persistSession` e `autoRefreshToken` desligados porque não há sessão a guardar: o
 * cliente é criado por requisição e descartado.
 *
 * A chave é a mesma que já vai para o navegador (`NEXT_PUBLIC_SUPABASE_ANON_KEY`), e a
 * RLS continua valendo. `service_role` não tem lugar nenhum na vitrine.
 */
export function createPublicClient() {
  const { url, anonKey } = getSupabaseEnv();

  return createSupabaseClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
