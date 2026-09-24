"use server";

import { redirect } from "next/navigation";
import { CAPTCHA_ENABLED } from "@/config/auth";
import {
  AUTH_MESSAGES,
  captchaGateMessage,
  errorState,
  resolvePostSignInRedirect,
  successState,
  toMfaMessage,
  toPasswordUpdateMessage,
  toRecoveryState,
  toSignInMessage,
  type AuthFormState,
} from "@/lib/auth/admin-auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Ações de autenticação administrativa.
 *
 * Tudo passa pelo Supabase Auth: não existe endpoint próprio de login, nenhuma senha é
 * armazenada ou registrada aqui, e não há contador de tentativas caseiro — o limite de
 * requisições é o nativo do Supabase, cujo 429 é traduzido em mensagem genérica.
 *
 * Nenhuma destas ações cria conta: não há signUp em lugar nenhum da aplicação.
 */

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const captchaToken = (formData: FormData) => {
  const token = String(formData.get("captchaToken") ?? "").trim();
  return token === "" ? null : token;
};

export async function signInAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = text(formData, "email");
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return errorState(AUTH_MESSAGES.missingFields);

  const token = captchaToken(formData);
  const captchaProblem = captchaGateMessage(token, CAPTCHA_ENABLED);
  if (captchaProblem) return errorState(captchaProblem);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: token ? { captchaToken: token } : undefined,
  });

  // Mensagem idêntica para senha errada, conta inexistente e e-mail não confirmado.
  if (error) return errorState(toSignInMessage(error));

  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  redirect(resolvePostSignInRedirect(data?.currentLevel === "aal2" ? "aal2" : "aal1"));
}

export async function requestPasswordResetAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = text(formData, "email");
  if (!email) return errorState(AUTH_MESSAGES.missingFields);

  const token = captchaToken(formData);
  const captchaProblem = captchaGateMessage(token, CAPTCHA_ENABLED);
  if (captchaProblem) return errorState(captchaProblem);

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/admin/redefinir-senha`,
    captchaToken: token ?? undefined,
  });

  // Resposta única: não revela se a conta existe. Redefinir senha não cria usuário
  // nem remove o segundo fator — o MFA continua sendo exigido no próximo acesso.
  return toRecoveryState(error);
}

/**
 * O link do e-mail de recuperação volta com `?code=` (fluxo PKCE). Trocar esse código
 * por uma sessão exige o verificador guardado em cookie no MESMO navegador que pediu a
 * recuperação, então o código sozinho não serve a ninguém de fora. A sessão que nasce
 * aqui é de primeiro fator (AAL1): com o segundo fator ativo, a troca de senha ainda pede
 * o código do autenticador.
 */
export async function exchangeRecoveryCodeAction(
  code: string,
): Promise<{ ok: true; needsMfaCode: boolean } | { ok: false }> {
  if (!code) return { ok: false };

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return { ok: false };

  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return { ok: true, needsMfaCode: data?.currentLevel === "aal1" && data?.nextLevel === "aal2" };
}

export async function updatePasswordAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("passwordConfirmation") ?? "");
  const code = text(formData, "code");
  if (!password || !confirmation) return errorState(AUTH_MESSAGES.missingFields);
  if (password !== confirmation) return errorState("As senhas não coincidem.");

  const supabase = await createClient();

  // Com o segundo fator ativo, a senha só muda numa sessão AAL2: o link do e-mail
  // sozinho não basta para tomar a conta.
  const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (nivel?.currentLevel === "aal1" && nivel?.nextLevel === "aal2") {
    if (!code) return errorState("Informe o código do aplicativo autenticador.");
    const { data: fatores } = await supabase.auth.mfa.listFactors();
    const fator = fatores?.totp?.find((factor) => factor.status === "verified");
    if (!fator) return errorState(AUTH_MESSAGES.generic);
    const { error: mfaError } = await supabase.auth.mfa.challengeAndVerify({ factorId: fator.id, code });
    if (mfaError) return errorState(toMfaMessage(mfaError));
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return errorState(toPasswordUpdateMessage(error));

  return successState(AUTH_MESSAGES.passwordUpdated);
}

export type MfaEnrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

/**
 * Prepara o segundo fator. Remove fatores TOTP não verificados antes de criar um novo,
 * para tentativas abandonadas não se acumularem na conta.
 */
export async function enrollMfaAction(): Promise<
  { ok: true; enrollment: MfaEnrollment } | { ok: false; message: string }
> {
  const supabase = await createClient();

  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const factor of factors?.all ?? []) {
    if (factor.factor_type === "totp" && factor.status !== "verified") {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
  if (error || !data) return { ok: false, message: toMfaMessage(error) };

  return {
    ok: true,
    enrollment: { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret },
  };
}

export async function verifyMfaAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const code = text(formData, "code");
  const providedFactorId = text(formData, "factorId");
  if (!code) return errorState(AUTH_MESSAGES.missingFields);

  const supabase = await createClient();

  let factorId = providedFactorId;
  if (!factorId) {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    factorId = factors?.totp?.[0]?.id ?? "";
  }
  if (!factorId) return errorState(AUTH_MESSAGES.generic);

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError || !challenge) return errorState(toMfaMessage(challengeError));

  // Código inválido não eleva o AAL: sem AAL2 o guarda continua barrando /admin.
  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });
  if (error) return errorState(toMfaMessage(error));

  redirect("/admin");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
