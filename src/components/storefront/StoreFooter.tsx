import Link from "next/link";
import type { StorefrontPaths } from "@/lib/storefront-paths";
import {
  getInstitutionalPagesByGroup,
  INSTITUTIONAL_GROUP_LABELS,
  type InstitutionalGroup,
} from "@/modules/storefront/institutional";
import type { Store } from "@/types/catalog";
import { Container } from "./Container";

// Links do rodapé: 44px de altura mínima. Dentro de uma lista com título o contexto já
// diz que são links; o sublinhado rosé aparece no hover e a cor clareia em 220ms.
const LINK =
  "focus-ring -mx-2 inline-flex min-h-11 items-center rounded-md px-2 text-pretty text-muted-foreground decoration-accent underline-offset-4 transition-colors duration-(--duracao-estado) ease-(--ease-saida) hover:text-foreground hover:underline";

const TITULO_GRUPO = "mb-1 text-sm font-medium text-foreground";

const GROUPS: InstitutionalGroup[] = ["ajuda", "politicas"];

export function StoreFooter({
  store,
  paths,
}: {
  store: Pick<Store, "name" | "description">;
  paths: StorefrontPaths;
}) {
  return (
    <footer className="mt-14 border-t border-border sm:mt-20">
      {/* O rodapé inteiro sobe e aparece ao entrar na tela, preso à rolagem. */}
      <div className="revelar">
        <Container className="grid gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16">
          <div className="flex max-w-[40ch] flex-col items-start gap-4">
            <Link href={paths.home} className="pressionavel focus-ring -ml-1 inline-flex rounded-md px-1">
              {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático, sem otimização a fazer */}
              <img
                src="/marca/logo-branco.svg"
                alt={store.name}
                width={1160}
                height={831}
                loading="lazy"
                // 48px é a menor altura em que a assinatura do logo continua legível.
                className="h-36 w-auto mt-8"
              />
            </Link>
            {store.description && (
              <p className="text-sm leading-[1.5] text-pretty text-muted-foreground">
                {store.description}
              </p>
            )}
          </div>

          {/* Duas colunas no celular, três a partir de sm: grupos lado a lado, sem caixas. */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3">
            <nav aria-label="Navegação" className="flex flex-col items-start">
              <p className={TITULO_GRUPO}>Navegação</p>
              <Link href={paths.home} className={LINK}>
                Início
              </Link>
              <Link href={paths.allProducts} className={LINK}>
                Todos os produtos
              </Link>
              <Link href={paths.search} className={LINK}>
                Buscar
              </Link>
              <Link href={paths.cart} className={LINK}>
                Carrinho
              </Link>
            </nav>

            {GROUPS.map((group) => (
              <nav
                key={group}
                aria-label={INSTITUTIONAL_GROUP_LABELS[group]}
                className="flex flex-col items-start"
              >
                <p className={TITULO_GRUPO}>{INSTITUTIONAL_GROUP_LABELS[group]}</p>
                {getInstitutionalPagesByGroup(group).map((page) => (
                  <Link key={page.slug} href={paths.institutional(page.slug)} className={LINK}>
                    {page.title}
                  </Link>
                ))}
              </nav>
            ))}
          </div>
        </Container>

        <div className="border-t border-border">
          <Container className="flex flex-col gap-3 py-6 text-xs leading-[1.4] tracking-[0.01em] text-muted-foreground sm:flex-row sm:items-end sm:justify-between sm:gap-8">
            {/* Dados da empresa exigidos no comércio eletrônico. */}
            <address className="flex flex-col gap-1 not-italic">
              <span>ANA CAROLINA DE OLIVEIRA BASILIO - ME</span>
              <span>CNPJ: 62.730.062/0001-06</span>
              <span>Rua Tercílio Celeste Pastore, 586</span>
            </address>
            <p>
              © {new Date().getFullYear()} {store.name}. Todos os direitos reservados.
            </p>
          </Container>
        </div>
      </div>
    </footer>
  );
}
