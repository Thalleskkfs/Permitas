import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/storefront/Breadcrumb";
import { Container } from "@/components/storefront/Container";
import { ChatIcon } from "@/components/storefront/icons";
import { getCurrentStoreSlug } from "@/lib/current-store-slug";
import { storefrontPaths } from "@/lib/storefront-paths";
import {
  getInstitutionalPage,
  PROVISIONAL,
  PROVISIONAL_NOTICE,
} from "@/modules/storefront/institutional";
import { getStore } from "@/modules/storefront/queries";
import { normalizeWhatsAppNumber } from "@/modules/storefront/whatsapp";
import { InstitutionalNav } from "../InstitutionalNav";

// Tipagem explícita: o tipo gerado da rota só aparece depois do typegen do Next.
export async function generateMetadata({
  params,
}: PageProps<"/institucional/[slug]">): Promise<Metadata> {
  const storeSlug = getCurrentStoreSlug();
  const { slug } = await params;
  const page = getInstitutionalPage(slug);
  const store = page ? await getStore(storeSlug) : null;
  if (!store || !page) return {};

  return {
    // Barra em vez de travessão: a direção não usa travessão em texto visível.
    // `absolute`: o layout da vitrine tem um `title.template` ("%s — Loja"); sem isso o
    // nome da loja apareceria duas vezes, uma com "|" e outra com "—".
    title: { absolute: `${page.title} | ${store.name}` },
    description: page.description,
    alternates: { canonical: storefrontPaths().institutional(page.slug) },
    // Página com marcador no lugar do texto não deve ser indexada. Sai quando o texto
    // definitivo entrar e `PROVISIONAL` virar falso no módulo de conteúdo.
    ...(PROVISIONAL ? { robots: { index: false } } : {}),
  };
}

/**
 * Página institucional: leitura longa, pensada para o celular.
 *
 * O cabeçalho da página leva o campo vinho (o único da página) com o título e o aviso
 * de texto provisório, que precisa ser a primeira coisa lida. Abaixo, o texto numa
 * medida confortável e, ao lado (ou ao fim, no celular), o índice das demais páginas.
 * Aqui só se cuida da forma: títulos e corpos vêm do módulo de conteúdo como estão.
 */
export default async function InstitutionalPage({
  params,
}: PageProps<"/institucional/[slug]">) {
  const storeSlug = getCurrentStoreSlug();
  const { slug } = await params;
  const page = getInstitutionalPage(slug);
  if (!page) notFound();

  const store = await getStore(storeSlug);
  if (!store) notFound();

  const paths = storefrontPaths();

  return (
    <>
      {/* `isolate` prende o fundo do campo vinho atrás do conteúdo desta faixa. */}
      <header className="relative isolate">
        <div aria-hidden className="campo-vinho absolute inset-0 -z-10" />
        <Container className="flex flex-col items-start pt-6 pb-10 sm:pt-8 sm:pb-14">
          <Breadcrumb items={[{ label: "Início", href: paths.home }, { label: page.title }]} />

          <h1 className="entrada mt-8 max-w-3xl font-display text-[length:var(--texto-titulo-1)] leading-[1.08] font-light tracking-[-0.02em] text-balance sm:mt-12">
            {page.title}
          </h1>
          <p className="entrada mt-4 max-w-[40ch] text-base leading-[1.55] text-pretty text-muted-foreground [--ordem:1] sm:mt-5 sm:text-lg">
            {page.description}
          </p>

          {PROVISIONAL && (
            <p
              role="note"
              className="entrada mt-8 flex max-w-[65ch] items-start gap-3 rounded-md border border-control-border bg-card px-4 py-3.5 text-sm leading-[1.5] font-medium text-foreground [--ordem:2]"
            >
              <PendingIcon />
              {PROVISIONAL_NOTICE}
            </p>
          )}
        </Container>
      </header>

      <Container className="grid gap-16 pt-12 sm:pt-14 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-x-16 xl:gap-x-24">
        {/* No celular o índice vem depois do texto; em telas largas, na coluna lateral. */}
        <div className="order-last border-t border-border pt-10 lg:order-first lg:border-t-0 lg:pt-1">
          <InstitutionalNav paths={paths} atual={page.slug} />
        </div>

        <article className="flex max-w-[65ch] flex-col gap-12 sm:gap-14">
          {page.slug === "contato" && <WhatsAppContact number={store.whatsappNumber} />}

          {page.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-display text-[length:var(--texto-titulo-2)] leading-[1.15] font-normal tracking-[-0.01em] text-balance">
                {section.heading}
              </h2>
              <div className="mt-4 flex flex-col gap-4 sm:mt-5">
                {section.body.map((paragraph, index) => (
                  <p
                    key={index}
                    className="text-base leading-[1.6] text-pretty text-foreground/90 sm:text-[1.0625rem]"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </article>
      </Container>
    </>
  );
}

/**
 * WhatsApp da loja na página de Contato. É dado real, vindo do cadastro da loja, e é a
 * ação principal da página: o botão verde da vitrine, com o número visível ao lado para
 * quem prefere anotar ou ligar.
 */
function WhatsAppContact({ number }: { number?: string | null }) {
  const digits = number ? normalizeWhatsAppNumber(number) : null;

  return (
    <section>
      <h2 className="font-display text-[length:var(--texto-titulo-2)] leading-[1.15] font-normal tracking-[-0.01em]">
        WhatsApp
      </h2>
      {number && digits ? (
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <a
            href={`https://wa.me/${digits}`}
            target="_blank"
            rel="noopener noreferrer"
            className="pressionavel focus-ring inline-flex min-h-12 items-center justify-center gap-2.5 rounded-full bg-whatsapp px-7 text-[0.9375rem] font-semibold whitespace-nowrap text-whatsapp-foreground hover:bg-[color-mix(in_oklab,var(--whatsapp)_86%,var(--foreground))]"
          >
            <ChatIcon />
            Falar no WhatsApp
          </a>
          <p className="text-base font-medium tabular-nums text-foreground sm:text-lg">{number}</p>
        </div>
      ) : (
        <p className="mt-4 text-base leading-[1.55] text-muted-foreground">
          WhatsApp da loja ainda não cadastrado.
        </p>
      )}
    </section>
  );
}

/** Documento com relógio: "aguardando revisão". Mesmo traço dos ícones da vitrine. */
function PendingIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-px size-5 shrink-0"
    >
      <path d="M13 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h4" />
      <path d="M13 3.5 18.5 9V11" />
      <path d="M13 3.5V9h5.5" />
      <circle cx="17" cy="17" r="4" />
      <path d="M17 15v2l1.25 1.25" />
    </svg>
  );
}
