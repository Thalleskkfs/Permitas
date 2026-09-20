/**
 * Loja ativa do painel, derivada dos vínculos do usuário autenticado.
 *
 * Módulo sem dependências. A loja NUNCA vem do cliente: a lista de vínculos é lida do
 * banco sob RLS e é ela que decide. Um store_id enviado numa requisição só serve para
 * ser comparado com o contexto resolvido aqui.
 *
 * Com mais de um vínculo, o resultado é um estado explícito de seleção pendente — não
 * escolhemos uma loja por conta própria. A troca de loja é uma etapa futura.
 */

export type StoreRole = "owner" | "editor";

export type StoreMembership = {
  storeId: string;
  role: StoreRole;
};

export type StoreContext =
  | { status: "ok"; storeId: string; role: StoreRole }
  | { status: "selection-required"; memberships: StoreMembership[] }
  | { status: "no-store" };

export const STORE_CONTEXT_REDIRECTS = {
  "no-store": "/admin/sem-loja",
  "selection-required": "/admin/selecionar-loja",
} as const;

export function resolveStoreContext(memberships: StoreMembership[]): StoreContext {
  if (memberships.length === 0) return { status: "no-store" };
  if (memberships.length > 1) return { status: "selection-required", memberships };

  const [membership] = memberships;
  return { status: "ok", storeId: membership.storeId, role: membership.role };
}

/** Confere que um id recebido é exatamente a loja autorizada. */
export function isAuthorizedStore(context: StoreContext, storeId: string) {
  return context.status === "ok" && context.storeId === storeId;
}
