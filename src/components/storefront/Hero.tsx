import Link from "next/link";
import type { StoreHero } from "@/types/catalog";
import { Container } from "./Container";

export function Hero({ title, subtitle, actionLabel, actionHref }: StoreHero) {
  return (
    <section className="bg-muted">
      <Container className="flex flex-col items-start gap-4 py-12 sm:py-20">
        <h1 className="max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="max-w-xl text-muted-foreground">{subtitle}</p>}
        {actionLabel && actionHref && (
          <Link
            href={actionHref}
            className="focus-ring mt-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {actionLabel}
          </Link>
        )}
      </Container>
    </section>
  );
}
