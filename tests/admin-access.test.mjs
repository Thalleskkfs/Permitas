import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  ADMIN_DENIAL_REDIRECTS,
  ADMIN_REQUIRED_AAL,
  createResolveAdminAccess,
} from "../src/lib/auth/admin-access.ts";
import {
  AUTH_MESSAGES,
  captchaGateMessage,
  isRateLimited,
  resolvePostSignInRedirect,
  toMfaMessage,
  toPasswordUpdateMessage,
  toRecoveryState,
  toSignInMessage,
} from "../src/lib/auth/admin-auth.ts";

const USER = { id: "user-1", email: "admin@exemplo.com" };
const OWNER = [{ storeId: "store-1", role: "owner" }];
const EDITOR = [{ storeId: "store-1", role: "editor" }];

/** Monta o guarda com dependências falsas e registra o que foi consultado. */
function guard({ user = null, level = null, memberships = [], requiredLevel } = {}) {
  const calls = [];
  const resolve = createResolveAdminAccess(
    {
      async getAuthenticatedUser() {
        calls.push("getAuthenticatedUser");
        return user;
      },
      async getAssuranceLevel() {
        calls.push("getAssuranceLevel");
        return level;
      },
      async getMemberships(userId) {
        calls.push(`getMemberships(${userId})`);
        return memberships;
      },
    },
    requiredLevel,
  );
  return { resolve, calls };
}

describe("política de acesso administrativo", () => {
  test("a área administrativa exige AAL2", () => {
    assert.equal(ADMIN_REQUIRED_AAL, "aal2");
  });

  test("cada recusa tem um destino próprio", () => {
    assert.deepEqual(ADMIN_DENIAL_REDIRECTS, {
      unauthenticated: "/admin/login",
      "mfa-required": "/admin/mfa",
      "no-membership": "/admin/sem-loja",
    });
  });
});

describe("usuário não autenticado", () => {
  test("é mandado para o login e nada mais é consultado", async () => {
    const { resolve, calls } = guard();
    const decision = await resolve();

    assert.equal(decision.allowed, false);
    assert.equal(decision.reason, "unauthenticated");
    assert.equal(decision.redirectTo, "/admin/login");
    assert.deepEqual(calls, ["getAuthenticatedUser"], "não deve consultar AAL nem vínculo");
  });
});

describe("sessão sem segundo fator", () => {
  test("AAL1 não entra no painel quando AAL2 é exigido", async () => {
    const { resolve, calls } = guard({ user: USER, level: "aal1", memberships: OWNER });
    const decision = await resolve();

    assert.equal(decision.allowed, false);
    assert.equal(decision.reason, "mfa-required");
    assert.equal(decision.redirectTo, "/admin/mfa");
    assert.ok(!calls.some((call) => call.startsWith("getMemberships")), "vínculo não é exposto em AAL1");
  });

  test("código MFA inválido mantém AAL1 e continua barrado", async () => {
    // Um verify recusado não eleva o nível: o guarda vê a mesma sessão AAL1.
    for (const level of ["aal1", null]) {
      const { resolve } = guard({ user: USER, level, memberships: OWNER });
      const decision = await resolve();
      assert.equal(decision.allowed, false, `nível ${level}`);
      assert.equal(decision.reason, "mfa-required");
    }
  });

  test("redefinir a senha não contorna o segundo fator", async () => {
    // Depois de trocar a senha, a sessão continua AAL1 até o TOTP ser verificado.
    const { resolve } = guard({ user: USER, level: "aal1", memberships: OWNER });
    assert.equal((await resolve()).redirectTo, "/admin/mfa");
  });
});

describe("autenticado sem vínculo", () => {
  test("mesmo com AAL2, sem membership não há acesso", async () => {
    const { resolve } = guard({ user: USER, level: "aal2", memberships: [] });
    const decision = await resolve();

    assert.equal(decision.allowed, false);
    assert.equal(decision.reason, "no-membership");
    assert.equal(decision.redirectTo, "/admin/sem-loja");
  });
});

describe("acesso liberado", () => {
  for (const [label, memberships] of [["owner", OWNER], ["editor", EDITOR]]) {
    test(`${label} com AAL2 e vínculo entra`, async () => {
      const { resolve, calls } = guard({ user: USER, level: "aal2", memberships });
      const decision = await resolve();

      assert.equal(decision.allowed, true);
      assert.equal(decision.userId, USER.id);
      assert.equal(decision.email, USER.email);
      assert.deepEqual(decision.memberships, memberships);
      assert.deepEqual(calls, [
        "getAuthenticatedUser",
        "getAssuranceLevel",
        `getMemberships(${USER.id})`,
      ]);
    });
  }

  test("a ordem é identidade, depois AAL, depois vínculo", async () => {
    const { resolve, calls } = guard({ user: USER, level: "aal2", memberships: OWNER });
    await resolve();
    assert.ok(calls.indexOf("getAuthenticatedUser") < calls.indexOf("getAssuranceLevel"));
    assert.ok(calls.indexOf("getAssuranceLevel") < calls.findIndex((c) => c.startsWith("getMemberships")));
  });

  test("com a exigência em AAL1, o vínculo continua obrigatório", async () => {
    const allowed = await guard({ user: USER, level: "aal1", memberships: OWNER, requiredLevel: "aal1" }).resolve();
    assert.equal(allowed.allowed, true);

    const denied = await guard({ user: USER, level: "aal1", memberships: [], requiredLevel: "aal1" }).resolve();
    assert.equal(denied.reason, "no-membership");
  });
});

describe("mensagens não revelam se a conta existe", () => {
  const errors = [
    { status: 400, code: "invalid_credentials", message: "Invalid login credentials" },
    { status: 400, code: "email_not_confirmed", message: "Email not confirmed" },
    { status: 400, code: "user_not_found", message: "User not found" },
    { status: 422, message: "anything else" },
  ];

  test("qualquer falha de login produz a mesma mensagem", () => {
    const messages = new Set(errors.map((error) => toSignInMessage(error)));
    assert.deepEqual([...messages], [AUTH_MESSAGES.invalidCredentials]);
    for (const error of errors) {
      const message = toSignInMessage(error);
      assert.doesNotMatch(message, /não encontrad|not found|não existe|confirmad/i);
      assert.doesNotMatch(message, new RegExp(error.message, "i"));
    }
  });

  test("a recuperação responde igual com e sem conta", () => {
    const withAccount = toRecoveryState(null);
    const withoutAccount = toRecoveryState({ status: 400, code: "user_not_found" });
    assert.deepEqual(withAccount, withoutAccount);
    assert.equal(withAccount.status, "success");
    assert.equal(withAccount.message, AUTH_MESSAGES.recoverySubmitted);
    assert.match(withAccount.message, /se existir/i);
  });
});

describe("excesso de tentativas (429 do Supabase)", () => {
  const rateLimitErrors = [
    { status: 429, message: "Too many requests" },
    { status: 400, code: "over_request_rate_limit", message: "x" },
    { status: 400, code: "over_email_send_rate_limit", message: "x" },
    { message: "Email rate limit exceeded" },
  ];

  test("são reconhecidos como limite de tentativas", () => {
    for (const error of rateLimitErrors) assert.equal(isRateLimited(error), true, JSON.stringify(error));
    assert.equal(isRateLimited({ status: 400, code: "invalid_credentials" }), false);
    assert.equal(isRateLimited(null), false);
  });

  test("login, MFA e troca de senha orientam a esperar, sem detalhar o limite", () => {
    for (const error of rateLimitErrors) {
      for (const message of [toSignInMessage(error), toMfaMessage(error), toPasswordUpdateMessage(error)]) {
        assert.equal(message, AUTH_MESSAGES.rateLimited);
        assert.doesNotMatch(message, /\d+\s*(tentativa|requisi|segundo|minuto por)/i);
      }
    }
  });

  test("a recuperação sinaliza erro no 429, em vez de fingir sucesso", () => {
    const state = toRecoveryState({ status: 429, message: "Too many requests" });
    assert.equal(state.status, "error");
    assert.equal(state.message, AUTH_MESSAGES.rateLimited);
  });
});

describe("captcha", () => {
  test("quando habilitado, token ausente ou vazio impede o envio", () => {
    assert.equal(captchaGateMessage(null, true), AUTH_MESSAGES.captchaRequired);
    assert.equal(captchaGateMessage("", true), AUTH_MESSAGES.captchaRequired);
    assert.equal(captchaGateMessage("   ", true), AUTH_MESSAGES.captchaRequired);
  });

  test("quando habilitado, token presente libera o envio", () => {
    assert.equal(captchaGateMessage("token-abc", true), null);
  });

  test("quando desabilitado, o fluxo segue sem token", () => {
    assert.equal(captchaGateMessage(null, false), null);
  });

  test("captcha recusado pelo Supabase vira mensagem de captcha, não de credencial", () => {
    assert.equal(
      toSignInMessage({ status: 400, code: "captcha_failed", message: "captcha protection: failed" }),
      AUTH_MESSAGES.captchaRequired,
    );
  });
});

describe("senha e destino pós-login", () => {
  test("senha fraca repassa a recusa da política do Supabase", () => {
    assert.equal(
      toPasswordUpdateMessage({ status: 422, code: "weak_password", message: "Password is too weak" }),
      AUTH_MESSAGES.weakPassword,
    );
  });

  test("AAL1 vai para o segundo fator e AAL2 entra no painel", () => {
    assert.equal(resolvePostSignInRedirect("aal1"), "/admin/mfa");
    assert.equal(resolvePostSignInRedirect(null), "/admin/mfa");
    assert.equal(resolvePostSignInRedirect("aal2"), "/admin");
  });
});
