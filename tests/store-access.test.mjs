import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  STORE_ROLE_ACTIONS,
  StoreAccessError,
  createStoreAccess,
} from "../src/lib/auth/store-access.ts";
import { createCatalogImageOperations } from "../src/lib/storage/catalog-images-core.ts";

const S1 = "11111111-1111-4111-8111-111111111111";
const S2 = "22222222-2222-4222-8222-222222222222";
const P1 = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa"; // produto da loja 1
const P2 = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb"; // produto da loja 2

const A = "00000000-0000-4000-8000-00000000000a"; // owner da loja 1
const B = "00000000-0000-4000-8000-00000000000b"; // owner da loja 2
const C = "00000000-0000-4000-8000-00000000000c"; // sem vínculo
const D = "00000000-0000-4000-8000-00000000000d"; // editor da loja 1

const MEMBERSHIPS = [
  { storeId: S1, userId: A, role: "owner" },
  { storeId: S1, userId: D, role: "editor" },
  { storeId: S2, userId: B, role: "owner" },
];

const PRODUCTS = [
  { id: P1, storeId: S1 },
  { id: P2, storeId: S2 },
];

const FILE = "0d6f3c1a-7e5b-4a52-9c1d-2b8e6f4a7c10.webp";
const pathOf = (storeId, productId) => `${storeId}/${productId}/${FILE}`;

/**
 * Monta as operações com dependências falsas. Tudo que exigiria service_role é
 * registrado com o prefixo ADMIN, então dá para afirmar que nada privilegiado roda
 * antes (ou apesar) da autorização. Nenhuma chave real é usada.
 */
function harness(sessionUserId) {
  const calls = [];

  const requireStoreAccess = createStoreAccess({
    async getAuthenticatedUserId() {
      calls.push("session:getAuthenticatedUserId");
      return sessionUserId;
    },
    async getMembershipRole(storeId, userId) {
      calls.push(`session:getMembershipRole(${storeId},${userId})`);
      return MEMBERSHIPS.find((m) => m.storeId === storeId && m.userId === userId)?.role ?? null;
    },
  });

  const operations = createCatalogImageOperations({
    requireStoreAccess,
    async productBelongsToStore(storeId, productId) {
      calls.push(`ADMIN:productBelongsToStore(${storeId},${productId})`);
      return PRODUCTS.some((p) => p.id === productId && p.storeId === storeId);
    },
    async uploadObject(path) {
      calls.push(`ADMIN:uploadObject(${path})`);
    },
    async removeObject(path) {
      calls.push(`ADMIN:removeObject(${path})`);
    },
    async createSignedUrl(path) {
      calls.push(`ADMIN:createSignedUrl(${path})`);
      return `https://signed.test/${path}`;
    },
  });

  const privileged = () => calls.filter((call) => call.startsWith("ADMIN:"));
  return { calls, privileged, operations, requireStoreAccess };
}

const upload = (ops, storeId, productId) =>
  ops.uploadCatalogImage({ storeId, productId, contentType: "image/webp", body: new Uint8Array([1]) });

/** Executa as três operações contra a mesma loja/produto. */
const allOperations = (ops, storeId, productId) => [
  () => upload(ops, storeId, productId),
  () => ops.removeCatalogImage({ storeId, path: pathOf(storeId, productId) }),
  () => ops.createCatalogImageSignedUrl({ storeId, path: pathOf(storeId, productId) }),
];

async function expectDenied(run, reason) {
  await assert.rejects(run(), (error) => {
    assert.ok(error instanceof StoreAccessError, `esperava StoreAccessError, veio: ${error}`);
    assert.equal(error.reason, reason);
    return true;
  });
}

describe("regra de papéis", () => {
  test("owner e editor podem ler, escrever e apagar mídia", () => {
    for (const role of ["owner", "editor"]) {
      assert.deepEqual([...STORE_ROLE_ACTIONS[role]].sort(), [
        "storage:delete",
        "storage:read",
        "storage:write",
      ]);
    }
  });

  test("um papel sem a ação é recusado", async () => {
    const requireStoreAccess = createStoreAccess({
      getAuthenticatedUserId: async () => A,
      getMembershipRole: async () => "editor",
    });
    const original = STORE_ROLE_ACTIONS.editor;
    try {
      Object.defineProperty(STORE_ROLE_ACTIONS, "editor", { value: ["storage:read"], configurable: true });
      await expectDenied(() => requireStoreAccess(S1, "storage:delete"), "forbidden-action");
      assert.deepEqual(await requireStoreAccess(S1, "storage:read"), { userId: A, storeId: S1, role: "editor" });
    } finally {
      Object.defineProperty(STORE_ROLE_ACTIONS, "editor", { value: original, configurable: true });
    }
  });
});

describe("membros operam a própria loja", () => {
  for (const [label, user] of [["owner A", A], ["editor D", D]]) {
    test(`${label} envia, remove e assina imagem da loja 1`, async () => {
      const { operations, privileged, calls } = harness(user);

      const { path } = await upload(operations, S1, P1);
      assert.match(path, new RegExp(`^${S1}/${P1}/[0-9a-f-]{36}\\.webp$`));

      await operations.removeCatalogImage({ storeId: S1, path: pathOf(S1, P1) });
      const url = await operations.createCatalogImageSignedUrl({ storeId: S1, path: pathOf(S1, P1) });
      assert.equal(url, `https://signed.test/${pathOf(S1, P1)}`);

      assert.deepEqual(privileged().map((call) => call.split("(")[0]), [
        "ADMIN:productBelongsToStore", "ADMIN:uploadObject",
        "ADMIN:productBelongsToStore", "ADMIN:removeObject",
        "ADMIN:productBelongsToStore", "ADMIN:createSignedUrl",
      ]);
      assert.ok(calls.includes(`session:getMembershipRole(${S1},${user})`));
    });
  }
});

describe("usuário de outra loja não alcança nada", () => {
  test("owner da loja 1 é recusado na loja 2, mesmo sabendo storeId e productId", async () => {
    for (const run of allOperations(harness(A).operations, S2, P2)) {
      await expectDenied(run, "not-a-member");
    }
    const { operations, privileged, calls } = harness(A);
    await expectDenied(() => upload(operations, S2, P2), "not-a-member");
    assert.deepEqual(privileged(), [], "nada privilegiado pode rodar");
    assert.ok(
      calls.includes(`session:getMembershipRole(${S2},${A})`),
      "o vínculo é buscado para o usuário da SESSÃO, não para um id do chamador",
    );
  });

  test("informar outro storeId não concede acesso", async () => {
    const { operations, privileged } = harness(A);
    await expectDenied(() => upload(operations, S2, P1), "not-a-member");
    await expectDenied(() => upload(operations, S2, P2), "not-a-member");
    assert.deepEqual(privileged(), []);
  });

  test("owner da loja 2 não opera um path da loja 1", async () => {
    const { operations, privileged } = harness(B);

    // storeId autorizado (S2), mas o path aponta para a loja 1
    await assert.rejects(
      operations.removeCatalogImage({ storeId: S2, path: pathOf(S1, P1) }),
      /Path pertence a outra loja/,
    );
    await assert.rejects(
      operations.createCatalogImageSignedUrl({ storeId: S2, path: pathOf(S1, P1) }),
      /Path pertence a outra loja/,
    );
    assert.deepEqual(privileged(), []);
  });
});

describe("sem vínculo e sem sessão", () => {
  test("usuário sem membership é recusado em qualquer loja", async () => {
    for (const storeId of [S1, S2]) {
      const { operations, privileged } = harness(C);
      for (const run of allOperations(operations, storeId, storeId === S1 ? P1 : P2)) {
        await expectDenied(run, "not-a-member");
      }
      assert.deepEqual(privileged(), []);
    }
  });

  test("usuário não autenticado é recusado antes de qualquer consulta", async () => {
    const { operations, privileged, calls } = harness(null);
    for (const run of allOperations(operations, S1, P1)) {
      await expectDenied(run, "unauthenticated");
    }
    assert.deepEqual(privileged(), []);
    assert.ok(!calls.some((call) => call.startsWith("session:getMembershipRole")));
  });
});

describe("produto e path continuam sendo verificados depois da autorização", () => {
  test("produto da loja 2 sob a loja 1 é bloqueado", async () => {
    const { operations, privileged } = harness(A);
    await assert.rejects(upload(operations, S1, P2), /Produto não pertence à loja informada/);
    await assert.rejects(
      operations.removeCatalogImage({ storeId: S1, path: pathOf(S1, P2) }),
      /Produto não pertence à loja informada/,
    );
    assert.ok(!privileged().some((call) => call.startsWith("ADMIN:upload") || call.startsWith("ADMIN:remove")));
  });

  test("path fora da convenção é recusado", async () => {
    const { operations, privileged } = harness(A);
    for (const path of [`${S1}/${P1}/../fora.webp`, `${S1}/${FILE}`, `${S1}/${P1}/x.gif`, ""]) {
      await assert.rejects(
        operations.removeCatalogImage({ storeId: S1, path }),
        /Path fora da convenção/,
        path,
      );
    }
    assert.deepEqual(privileged(), []);
  });
});

describe("ordem: autorização antes da operação privilegiada", () => {
  test("a sessão é consultada antes de qualquer chamada ADMIN", async () => {
    const { operations, calls } = harness(A);
    await upload(operations, S1, P1);

    const firstAdmin = calls.findIndex((call) => call.startsWith("ADMIN:"));
    const lastSession = calls.map((call) => call.startsWith("session:")).lastIndexOf(true);
    assert.ok(firstAdmin > lastSession, `ordem inesperada: ${calls.join(" -> ")}`);
    assert.deepEqual(calls.slice(0, 2), [
      "session:getAuthenticatedUserId",
      `session:getMembershipRole(${S1},${A})`,
    ]);
  });

  test("autorização falhando impede qualquer chamada ADMIN nas três operações", async () => {
    for (const user of [null, C, B]) {
      const { operations, privileged } = harness(user);
      for (const run of allOperations(operations, S1, P1)) {
        await assert.rejects(run());
      }
      assert.deepEqual(privileged(), [], `usuário ${user} alcançou operação privilegiada`);
    }
  });
});
