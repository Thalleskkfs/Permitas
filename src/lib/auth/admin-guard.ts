import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createResolveAdminAccess, type AdminMembership } from "./admin-access";

/**
 * Raiz de composição do guarda administrativo.
 *
 * A identidade vem de `getUser()`, que valida o token no servidor de autenticação — não
 * de `getSession()`, que apenas lê o cookie. Só depois dessa validação o AAL da sessão é
 * consultado, e o vínculo com a loja é lido com o cliente de SESSÃO, sob RLS.
 *
 * O service_role não participa de nada disto.
 */
export const resolveAdminAccess = createResolveAdminAccess({
  async getAuthenticatedUser() {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  },

  async getAssuranceLevel() {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) return null;
    return data.currentLevel === "aal2" ? "aal2" : data.currentLevel === "aal1" ? "aal1" : null;
  },

  async getMemberships(userId): Promise<AdminMembership[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("store_members")
      .select("store_id, role")
      .eq("user_id", userId);

    if (error || !data) return [];
    return data.map((row) => ({ storeId: row.store_id, role: row.role }));
  },
});

/** Usado pelos layouts protegidos: decide e redireciona. */
export async function requireAdminAccess() {
  const decision = await resolveAdminAccess();
  if (!decision.allowed) redirect(decision.redirectTo);
  return decision;
}
