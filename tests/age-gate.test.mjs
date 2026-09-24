/**
 * Portão de idade: o cookie gravado pela declaração e a decisão de mostrar o portão.
 * O portão é declaratório; o que se protege aqui é que só o valor gravado pela própria
 * action conta como declaração, e que o cookie dura 30 dias com os atributos certos.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  AGE_GATE_COOKIE,
  AGE_GATE_MAX_AGE,
  AGE_GATE_VALUE,
  buildAgeGateCookie,
  isSecureRequest,
  shouldShowAgeGate,
} from "../src/modules/storefront/age-gate.ts";

describe("cookie da declaração", () => {
  test("nome, valor e atributos", () => {
    const cookie = buildAgeGateCookie(true);
    assert.equal(cookie.name, AGE_GATE_COOKIE);
    assert.equal(cookie.name, "idade_declarada");
    assert.equal(cookie.value, AGE_GATE_VALUE);
    assert.equal(cookie.value, "1");
    assert.deepEqual(cookie.options, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
      secure: true,
    });
    assert.equal(AGE_GATE_MAX_AGE, 2_592_000);
  });

  test("Secure só em HTTPS", () => {
    assert.equal(buildAgeGateCookie(false).options.secure, false);
    assert.equal(isSecureRequest("https", null), true);
    assert.equal(isSecureRequest("https, http", null), true);
    assert.equal(isSecureRequest("http", "https://loja.exemplo.com"), false);
    assert.equal(isSecureRequest(null, "https://loja.exemplo.com"), true);
    assert.equal(isSecureRequest(null, "http://localhost:3000"), false);
    assert.equal(isSecureRequest(null, null), false);
  });
});

describe("mostrar o portão", () => {
  test("cookie ausente: mostra", () => {
    assert.equal(shouldShowAgeGate(undefined), true);
    assert.equal(shouldShowAgeGate(null), true);
  });

  test("valor errado: mostra", () => {
    for (const valor of ["", "0", "true", "sim", " 1", "11"]) {
      assert.equal(shouldShowAgeGate(valor), true, JSON.stringify(valor));
    }
  });

  test("valor gravado pela action: não mostra", () => {
    assert.equal(shouldShowAgeGate(buildAgeGateCookie(false).value), false);
  });
});
