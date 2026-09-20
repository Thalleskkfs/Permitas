/**
 * Mensagens e políticas dos formulários administrativos.
 *
 * Módulo sem dependências, para as regras de segurança serem testáveis isoladamente:
 *
 *   * mensagens genéricas — nunca revelam se um e-mail existe;
 *   * 429 do Supabase — tratado e comunicado sem detalhar limites;
 *   * captcha — exigido quando configurado, validado pelo Supabase (nunca por nós);
 *   * nenhuma senha, token ou código chega a log ou mensagem.
 *
 * Limitar tentativas é responsabilidade do Supabase Auth. Aqui não há contador próprio,
 * nem bloqueio por IP: usuários legítimos compartilham IP.
 */

export const AUTH_MESSAGES = {
  /** Mesma mensagem para senha errada, e-mail inexistente ou e-mail não confirmado. */
  invalidCredentials: "E-mail ou senha inválidos.",
  rateLimited: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  captchaRequired: "Confirme a verificação de segurança e tente novamente.",
  invalidMfaCode: "Código inválido. Gere um novo código no aplicativo e tente de novo.",
  weakPassword: "Senha recusada pela política de segurança. Escolha uma senha mais forte.",
  /** Resposta única da recuperação: não confirma nem nega a existência da conta. */
  recoverySubmitted:
    "Se existir uma conta com esse e-mail, enviaremos as instruções de redefinição.",
  passwordUpdated: "Senha atualizada. Entre novamente para continuar.",
  missingFields: "Preencha todos os campos.",
  generic: "Não foi possível concluir a operação. Tente novamente.",
} as const;

export type AuthFormState = {
  status: "idle" | "error" | "success";
  message: string;
};

export const IDLE_FORM_STATE: AuthFormState = { status: "idle", message: "" };

export const errorState = (message: string): AuthFormState => ({ status: "error", message });
export const successState = (message: string): AuthFormState => ({ status: "success", message });

/** Forma mínima de um erro do supabase-js, sem depender do pacote. */
export type AuthErrorLike = {
  status?: number;
  code?: string;
  message?: string;
} | null;

export function isRateLimited(error: AuthErrorLike) {
  if (!error) return false;
  if (error.status === 429) return true;
  if (error.code && /rate_limit|too_many/i.test(error.code)) return true;
  return /rate limit|too many requests/i.test(error.message ?? "");
}

/** A política de senha é a do Supabase; aqui só repassamos a recusa dele. */
export function isWeakPassword(error: AuthErrorLike) {
  return error?.code === "weak_password";
}

export function isCaptchaError(error: AuthErrorLike) {
  if (!error) return false;
  return /captcha/i.test(error.code ?? "") || /captcha/i.test(error.message ?? "");
}

/**
 * Login: qualquer falha vira a mesma mensagem, exceto 429 e captcha, que precisam
 * orientar o usuário legítimo. Nunca distingue "senha errada" de "conta inexistente".
 */
export function toSignInMessage(error: AuthErrorLike) {
  if (isRateLimited(error)) return AUTH_MESSAGES.rateLimited;
  if (isCaptchaError(error)) return AUTH_MESSAGES.captchaRequired;
  return AUTH_MESSAGES.invalidCredentials;
}

export function toMfaMessage(error: AuthErrorLike) {
  if (isRateLimited(error)) return AUTH_MESSAGES.rateLimited;
  return AUTH_MESSAGES.invalidMfaCode;
}

export function toPasswordUpdateMessage(error: AuthErrorLike) {
  if (isRateLimited(error)) return AUTH_MESSAGES.rateLimited;
  if (isWeakPassword(error)) return AUTH_MESSAGES.weakPassword;
  return AUTH_MESSAGES.generic;
}

/**
 * Recuperação de senha: o resultado é sempre o mesmo, com ou sem conta. A única exceção
 * é o 429, porque aí o pedido não foi processado e o usuário precisa saber que deve esperar.
 */
export function toRecoveryState(error: AuthErrorLike): AuthFormState {
  if (isRateLimited(error)) return errorState(AUTH_MESSAGES.rateLimited);
  return successState(AUTH_MESSAGES.recoverySubmitted);
}

/**
 * Exige o token do captcha quando o projeto está configurado para usá-lo. Quem valida o
 * token é o Supabase; aqui só evitamos enviar uma requisição que já nasceria inválida.
 */
export function captchaGateMessage(token: string | null, captchaEnabled: boolean) {
  if (!captchaEnabled) return null;
  return token && token.trim() !== "" ? null : AUTH_MESSAGES.captchaRequired;
}

/** Depois do login, AAL1 vai para o segundo fator; AAL2 entra no painel. */
export function resolvePostSignInRedirect(level: "aal1" | "aal2" | null) {
  return level === "aal2" ? "/admin" : "/admin/mfa";
}
