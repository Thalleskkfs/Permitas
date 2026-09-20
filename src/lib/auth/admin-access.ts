/**
 * Decisão de acesso à área administrativa.
 *
 * Módulo sem dependências: não conhece Supabase, Next nem ambiente. A raiz de composição
 * (admin-guard.ts) liga às consultas reais e executa o redirect.
 *
 * As três camadas são independentes e cumulativas:
 *   1. autenticação  — identidade validada no servidor com getUser();
 *   2. AAL           — nível de garantia da sessão (MFA);
 *   3. membership    — vínculo com alguma loja, lido sob RLS.
 *
 * MFA não substitui autorização: mesmo em AAL2, sem membership não há acesso, e a RLS
 * continua valendo em toda consulta.
 */

export type AssuranceLevel = "aal1" | "aal2";

/** Área administrativa exige segundo fator. */
export const ADMIN_REQUIRED_AAL: AssuranceLevel = "aal2";

export type AdminMembership = {
  storeId: string;
  role: "owner" | "editor";
};

export type AdminDenialReason = "unauthenticated" | "mfa-required" | "no-membership";

export const ADMIN_DENIAL_REDIRECTS: Record<AdminDenialReason, string> = {
  unauthenticated: "/admin/login",
  "mfa-required": "/admin/mfa",
  "no-membership": "/admin/sem-loja",
};

export type AdminAccessDecision =
  | {
      allowed: true;
      userId: string;
      email: string | null;
      memberships: AdminMembership[];
    }
  | {
      allowed: false;
      reason: AdminDenialReason;
      redirectTo: string;
    };

export type AdminAccessDeps = {
  /** Identidade já validada no servidor. Nunca derivada de dado enviado pelo cliente. */
  getAuthenticatedUser: () => Promise<{ id: string; email: string | null } | null>;
  /** Nível de garantia da sessão, lido depois de a identidade ser validada. */
  getAssuranceLevel: () => Promise<AssuranceLevel | null>;
  /** Vínculos lidos com o cliente de sessão, sob RLS — nunca com service_role. */
  getMemberships: (userId: string) => Promise<AdminMembership[]>;
};

const deny = (reason: AdminDenialReason): AdminAccessDecision => ({
  allowed: false,
  reason,
  redirectTo: ADMIN_DENIAL_REDIRECTS[reason],
});

export function createResolveAdminAccess(
  deps: AdminAccessDeps,
  requiredLevel: AssuranceLevel = ADMIN_REQUIRED_AAL,
) {
  return async function resolveAdminAccess(): Promise<AdminAccessDecision> {
    const user = await deps.getAuthenticatedUser();
    if (!user) return deny("unauthenticated");

    if (requiredLevel === "aal2") {
      const level = await deps.getAssuranceLevel();
      if (level !== "aal2") return deny("mfa-required");
    }

    const memberships = await deps.getMemberships(user.id);
    if (memberships.length === 0) return deny("no-membership");

    return { allowed: true, userId: user.id, email: user.email, memberships };
  };
}
