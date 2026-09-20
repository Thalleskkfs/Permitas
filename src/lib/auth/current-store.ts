import "server-only";

import { redirect } from "next/navigation";
import { requireAdminAccess } from "./admin-guard";
import { STORE_CONTEXT_REDIRECTS, resolveStoreContext, type StoreContext } from "./store-context";

/**
 * Loja ativa do painel.
 *
 * O contexto sai sempre da membership do usuário autenticado, lida sob RLS. Nenhum
 * store_id vindo de formulário, URL ou props participa desta decisão.
 */
export async function getCurrentStore(): Promise<StoreContext> {
  const access = await requireAdminAccess();
  return resolveStoreContext(access.memberships);
}

/** Usado pelas páginas e ações do catálogo: exige uma loja resolvida sem ambiguidade. */
export async function requireCurrentStore() {
  const context = await getCurrentStore();
  if (context.status !== "ok") redirect(STORE_CONTEXT_REDIRECTS[context.status]);
  return context;
}
