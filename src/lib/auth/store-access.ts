/**
 * Autorização de acesso a uma loja.
 *
 * Módulo sem dependências, de propósito: ele não conhece o Supabase e não lê ambiente.
 * Quem liga isto às consultas reais é a raiz de composição em
 * src/lib/storage/catalog-images.ts. Assim a regra pode ser testada isoladamente e não
 * há como um caminho alternativo "esquecer" a verificação.
 *
 * A identidade vem SEMPRE da sessão (`getAuthenticatedUserId`). O `storeId` recebido do
 * chamador é apenas o alvo a ser verificado, nunca uma credencial.
 */

export type StoreRole = "owner" | "editor";

export type StoreAction = "storage:read" | "storage:write" | "storage:delete";

/**
 * No Storage, owner e editor têm as mesmas operações: o editor pode enviar, substituir
 * e remover mídia. A distinção entre os papéis vive nas tabelas do catálogo, via RLS
 * (só owner apaga estruturas). A tabela existe para que essa regra fique explícita e
 * num lugar só, caso os papéis divirjam depois.
 */
export const STORE_ROLE_ACTIONS: Record<StoreRole, readonly StoreAction[]> = {
  owner: ["storage:read", "storage:write", "storage:delete"],
  editor: ["storage:read", "storage:write", "storage:delete"],
};

export type StoreAccessDenialReason = "unauthenticated" | "not-a-member" | "forbidden-action";

export class StoreAccessError extends Error {
  readonly reason: StoreAccessDenialReason;

  constructor(reason: StoreAccessDenialReason, message: string) {
    super(message);
    this.name = "StoreAccessError";
    this.reason = reason;
  }
}

export type StoreAccess = {
  userId: string;
  storeId: string;
  role: StoreRole;
};

export type StoreAccessDeps = {
  /** Identidade autenticada da sessão. Nunca um id vindo do cliente. */
  getAuthenticatedUserId: () => Promise<string | null>;
  /** Vínculo lido com o cliente de sessão, sob RLS — nunca com service_role. */
  getMembershipRole: (storeId: string, userId: string) => Promise<StoreRole | null>;
};

export function createStoreAccess(deps: StoreAccessDeps) {
  return async function requireStoreAccess(
    storeId: string,
    action: StoreAction,
  ): Promise<StoreAccess> {
    const userId = await deps.getAuthenticatedUserId();
    if (!userId) {
      throw new StoreAccessError("unauthenticated", "É necessário estar autenticado.");
    }

    const role = await deps.getMembershipRole(storeId, userId);
    if (!role) {
      throw new StoreAccessError("not-a-member", "Usuário não é membro desta loja.");
    }

    if (!STORE_ROLE_ACTIONS[role].includes(action)) {
      throw new StoreAccessError(
        "forbidden-action",
        `O papel ${role} não pode executar ${action}.`,
      );
    }

    return { userId, storeId, role };
  };
}
