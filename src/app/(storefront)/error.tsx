"use client";

import Link from "next/link";
import { Container } from "@/components/storefront/Container";
import { botaoVazado, botaoVinho, tituloDePagina } from "@/components/storefront/ProductGrid";
import { storefrontPaths } from "@/lib/storefront-paths";

/**
 * Falha inesperada numa página da loja (banco fora do ar, por exemplo).
 *
 * A mensagem técnica do erro NUNCA é exibida: ela serve ao log do servidor, não ao
 * visitante. `retry` busca e renderiza o trecho de novo, e a causa costuma ser passageira.
 * O layout da loja fica fora desta fronteira, então cabeçalho e rodapé continuam.
 */
export default function StoreError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const paths = storefrontPaths();

  return (
    <Container className="flex flex-col items-start gap-8 pt-14 pb-20 sm:pt-20 sm:pb-28">
      <div className="flex flex-col gap-5">
        <h1 className={tituloDePagina}>Não foi possível carregar esta página.</h1>
        <p className="max-w-[48ch] text-base leading-[1.55] text-pretty text-muted-foreground">
          Algo falhou do nosso lado, não do seu. Tente de novo em instantes.
        </p>
      </div>

      {/* Uma ação cheia (tentar de novo) e a saída vazada; empilhadas no celular. */}
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <button type="button" onClick={() => retry()} className={botaoVinho}>
          Tentar de novo
        </button>
        <Link href={paths.home} className={botaoVazado}>
          Voltar ao início
        </Link>
      </div>
    </Container>
  );
}
