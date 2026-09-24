"use client";

import Link from "next/link";
import { Container } from "@/components/storefront/Container";
import {
  botaoVazado,
  botaoVinho,
  campo,
  tituloDePagina,
} from "@/components/storefront/ProductGrid";
import { storefrontPaths } from "@/lib/storefront-paths";

/**
 * 404 dentro da vitrine: produto, categoria, coleção ou página que não existe (ou não
 * está publicada). Renderiza dentro do layout da loja, então cabeçalho e rodapé ficam.
 */
export default function StoreNotFound() {
  const paths = storefrontPaths();

  return (
    <Container className="flex flex-col items-start gap-10 pt-14 pb-20 sm:pt-20 sm:pb-28">
      <div className="entrada flex flex-col gap-5">
        <h1 className={tituloDePagina}>Esta página não está aqui.</h1>
        <p className="max-w-[48ch] text-base leading-[1.55] text-pretty text-muted-foreground">
          O endereço pode ter mudado, ou o produto saiu da vitrine. Busque pelo nome ou volte
          ao início.
        </p>
      </div>

      <form
        action={paths.search}
        method="get"
        role="search"
        className="entrada flex w-full max-w-xl flex-col gap-2 [--ordem:1]"
      >
        <label htmlFor="nao-encontrado-busca" className="text-sm font-medium">
          Nome do produto
        </label>
        <div className="flex gap-2">
          <input
            id="nao-encontrado-busca"
            name="q"
            type="search"
            maxLength={100}
            placeholder="Buscar pelo nome"
            enterKeyHint="search"
            className={`${campo} flex-1`}
          />
          {/* Vazado: o botão cheio da página é o "Voltar ao início". */}
          <button type="submit" className={`${botaoVazado} shrink-0 px-6`}>
            Buscar
          </button>
        </div>
      </form>

      <div className="entrada flex w-full flex-col [--ordem:2] sm:w-auto">
        <Link href={paths.home} className={botaoVinho}>
          Voltar ao início
        </Link>
      </div>
    </Container>
  );
}
