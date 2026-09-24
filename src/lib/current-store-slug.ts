import "server-only";

/**
 * Loja deste deploy.
 *
 * Cada deploy serve uma única loja no próprio domínio (a vitrine mora na raiz do
 * domínio, sem slug de loja na URL). Qual loja é vem da variável de ambiente de servidor
 * `STORE_SLUG`, nunca da URL nem do navegador. Sem ela a vitrine não sabe o que mostrar,
 * então falha alto em vez de cair numa loja qualquer.
 */
export function getCurrentStoreSlug(): string {
  const slug = process.env.STORE_SLUG?.trim();
  if (!slug) {
    throw new Error(
      "STORE_SLUG não configurada: defina a variável de ambiente de servidor STORE_SLUG " +
        "com o slug da loja deste deploy (ex.: STORE_SLUG=permitaseprazer).",
    );
  }
  return slug;
}
