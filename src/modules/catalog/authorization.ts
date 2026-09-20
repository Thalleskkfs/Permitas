import type { StoreRole } from "@/lib/auth/store-context";

/**
 * Quem pode fazer o quê no catálogo, do lado da aplicação.
 *
 * Isto é a PRIMEIRA barreira, não a única: as policies de RLS continuam valendo em cada
 * consulta e são elas que decidem de fato. Se esta tabela e a RLS discordarem, a RLS
 * ganha — e há testes de banco provando o comportamento real.
 *
 * Espelha as policies da migration do catálogo: membros criam, leem e editam; só o owner
 * exclui estruturas (produto, categoria, tag, coleção, variante). Vínculos e mídia podem
 * ser removidos por qualquer membro.
 */
export type CatalogAction =
  | "catalog:read"
  | "catalog:create"
  | "catalog:update"
  | "catalog:delete-structure"
  | "catalog:delete-link";

const ROLE_ACTIONS: Record<StoreRole, readonly CatalogAction[]> = {
  owner: [
    "catalog:read",
    "catalog:create",
    "catalog:update",
    "catalog:delete-structure",
    "catalog:delete-link",
  ],
  editor: ["catalog:read", "catalog:create", "catalog:update", "catalog:delete-link"],
};

export function roleAllows(role: StoreRole, action: CatalogAction) {
  return ROLE_ACTIONS[role].includes(action);
}

export function canDeleteStructures(role: StoreRole) {
  return roleAllows(role, "catalog:delete-structure");
}
